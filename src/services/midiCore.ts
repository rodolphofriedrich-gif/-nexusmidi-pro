import { dedupeDestinations } from '../lib/destinations';
import { getNoteName, toHex, clampInt, describeMessage, channelStatus, channelMessageLength } from '../lib/midiMath';
import { parseMidiBytes } from '../lib/midiParser';
import { createStore, type StorageLike, type Store } from '../lib/storeCore';
import { uid } from '../lib/id';
import type { MidiLearn } from '../lib/midiLearn';
import type { MidiDestination, MidiLogEntry, MidiMessage, MidiRoute } from '../types/midi';
import type { NativeBleDevice, NativeMidiPlugin } from './nativeMidi';

export { getNoteName };
export type { MidiMessage };

export const VIRTUAL_ID = 'virtual-main';
export const BLE_SERVER_ID = 'ble-server';
const MAX_SEND_FAILURES = 3;
const MAX_QUEUE_DEPTH = 200;
const DROP_THRESHOLD = 400;
const LOG_LIMIT = 300;
const CLOCK_OR_SENSING = new Set([0xf8, 0xfe]);

export type NativeMidiPort = Pick<
  NativeMidiPlugin,
  | 'initialize'
  | 'getDevices'
  | 'connectOutput'
  | 'connectInput'
  | 'disconnectOutput'
  | 'disconnectInput'
  | 'sendTo'
  | 'scanBleDevices'
  | 'connectBleMidi'
  | 'startBleServer'
  | 'stopBleServer'
  | 'isBleServerRunning'
  | 'addListener'
>;

export interface SynthPort {
  getIsReady(): boolean;
  noteOn(note: number, velocity: number, channel?: number): void;
  noteOff(note: number, channel?: number): void;
  controlChange(controller: number, value: number, channel?: number): void;
  programChange(program: number, channel?: number): void;
  pitchBend(value14: number, channel?: number): void;
  channelPressure(pressure: number, channel?: number): void;
  polyPressure(note: number, pressure: number, channel?: number): void;
  allNotesOff(): void;
}

export interface MidiServiceDeps {
  native: NativeMidiPort;
  synth: SynthPort;
  storage?: StorageLike;
  now?: () => number;
}

export interface MidiTap {
  (event: { status: number; data1: number; data2: number; sourceId?: string }): void;
}

export class MidiService {
  private readonly native: NativeMidiPort;
  private readonly synth: SynthPort;
  private readonly now: () => number;
  private readonly sendQueues = new Map<string, Promise<void>>();
  private readonly queueDepths = new Map<string, number>();
  private readonly routesStore: Store<{ routes: MidiRoute[] }>;

  private destinations: MidiDestination[] = [];
  private scannedBleDevices: MidiDestination[] = [];
  private readonly connectedOutputs = new Map<string, MidiDestination>();
  private readonly connectedInputs = new Set<string>();
  private readonly bleAddressToId = new Map<string, string>();
  private readonly sendFailures = new Map<string, number>();
  private readonly reconnectAttempts = new Map<string, number>();
  
  // NOVO: Fila de transmissão FIFO por destino para evitar troca de ordem das mensagens MIDI
  private readonly sendQueues = new Map<string, Promise<void>>();

  private bleServerActive = false;

  private messageListeners = new Set<(message: MidiMessage) => void>();
  private activityListeners = new Set<(velocity: number) => void>();
  private taps = new Set<MidiTap>();
  private logListeners = new Set<() => void>();
  private logEntries: MidiLogEntry[] = [];
  private logSeq = 0;
  private learn: MidiLearn | null = null;

  private onRefreshCallback?: (destinations?: MidiDestination[]) => void;
  private onDisconnectCallback?: (destination: MidiDestination, reason?: 'lost' | 'reconnecting' | 'failed') => void;
  private listenersReady: Promise<void>;

  constructor(deps: MidiServiceDeps) {
    this.native = deps.native;
    this.synth = deps.synth;
    this.now = deps.now ?? Date.now;
    this.routesStore = createStore('nexusmidi.routes', { routes: [] as MidiRoute[] }, { storage: deps.storage, persistDelayMs: 0 });
    this.listenersReady = this.installNativeListeners();
  }

  private async installNativeListeners(): Promise<void> {
    try {
      await this.native.addListener('midiMessage', (event) => {
        if (!event || !Array.isArray(event.data)) return;
        this.handleIncomingBytes(event.data, event.sourceId != null ? String(event.sourceId) : undefined);
      });
      await this.native.addListener('devicesChanged', () => void this.onDevicesChanged());
      await this.native.addListener('bleServerChanged', (status) => {
        this.bleServerActive = status?.active === true;
        this.onRefreshCallback?.(this.destinations);
      });
    } catch (error) {
      console.error('Não foi possível registrar os listeners MIDI nativos:', error);
    }
  }

  public setCallbacks(
    onRefresh: (destinations?: MidiDestination[]) => void,
    onDisconnect: (destination: MidiDestination, reason?: 'lost' | 'reconnecting' | 'failed') => void,
  ): void {
    this.onRefreshCallback = onRefresh;
    this.onDisconnectCallback = onDisconnect;
  }

  public clearCallbacks(): void {
    this.onRefreshCallback = undefined;
    this.onDisconnectCallback = undefined;
  }

  public async initWebMidi(): Promise<void> {
    await this.listenersReady;
    await this.native.initialize();
  }

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    return this.refreshDevices();
  }

  public async refreshDevices(): Promise<MidiDestination[]> {
    try {
      const result = await this.native.getDevices();
      const nativeDevices: MidiDestination[] = (result.devices || []).map((device) => ({
        id: String(device.id),
        name: device.name,
        displayName: device.displayName || device.name,
        type:
          device.type === 'usb' || device.type === 'ble' || device.type === 'virtual' || device.type === 'local'
            ? device.type
            : 'usb',
        manufacturer: device.manufacturer,
        inputPortCount: device.inputPortCount,
        outputPortCount: device.outputPortCount,
      }));

      const virtualKeyboard: MidiDestination = {
        id: VIRTUAL_ID,
        name: 'Teclado Virtual',
        displayName: 'Teclado Virtual (NexusMIDI Pro)',
        type: 'virtual',
        inputPortCount: 0,
        outputPortCount: 0,
      };

      const merged = [virtualKeyboard, ...nativeDevices.filter((d) => d.id !== VIRTUAL_ID)];
      for (const ble of this.scannedBleDevices) {
        if (!merged.some((d) => d.bleAddress === ble.bleAddress || d.id === ble.id)) merged.push(ble);
      }

      this.destinations = dedupeDestinations(merged);
      this.onRefreshCallback?.(this.destinations);
      return this.destinations;
    } catch (error) {
      console.error('Erro ao atualizar dispositivos MIDI:', error);
      return this.destinations;
    }
  }

  public async scanBleDevice(): Promise<NativeBleDevice[]> {
    try {
      const result = await this.native.scanBleDevices({ durationMs: 10000 });
      const devices = result.devices || [];

      this.scannedBleDevices = devices.map((dev) => ({
        id: `ble-${dev.address}`,
        name: dev.name,
        displayName: `${dev.name} (BLE)`,
        type: 'ble' as const,
        bleAddress: dev.address,
        inputPortCount: 1,
        outputPortCount: 1,
      }));
      this.scannedBleDevices.forEach((d) => d.bleAddress && this.bleAddressToId.set(d.bleAddress, d.id));

      await this.refreshDevices();
      return devices;
    } catch (error) {
      console.error('Erro ao procurar dispositivos BLE:', error);
      throw error;
    }
  }

  public getDestinations(): MidiDestination[] {
    return [...this.destinations];
  }

  private async onDevicesChanged(): Promise<void> {
    const list = await this.refreshDevices();
    const present = new Set(list.map((d) => d.id));
    for (const dest of [...this.connectedOutputs.values()]) {
      if (dest.id === VIRTUAL_ID || dest.type === 'ble') continue;
      if (!present.has(dest.id)) this.dropDevice(dest, 'lost');
    }
  }

   private dropDevice(dest: MidiDestination, reason: 'lost' | 'failed' = 'lost'): void {
    if (!this.connectedOutputs.delete(dest.id)) return;
    this.connectedInputs.delete(dest.id);
    this.sendFailures.delete(dest.id);
    this.reconnectAttempts.delete(dest.id);
    this.sendQueues.delete(dest.bleAddress || dest.id);
    this.queueDepths.delete(dest.bleAddress || dest.id); // NOVO
    this.onDisconnectCallback?.(dest, reason);
    this.onRefreshCallback?.(this.destinations);

    if (reason === 'failed' && dest.type === 'ble') {
      void this.attemptBleReconnect(dest);
    }
  }

  private async attemptBleReconnect(dest: MidiDestination): Promise<void> {
    if (!dest.bleAddress) return;
    const attempts = (this.reconnectAttempts.get(dest.id) ?? 0) + 1;
    this.reconnectAttempts.set(dest.id, attempts);

    if (attempts > 3) {
      this.reconnectAttempts.delete(dest.id);
      this.onDisconnectCallback?.(dest, 'failed');
      return;
    }

    this.onDisconnectCallback?.(dest, 'reconnecting');

    // Backoff exponencial: 2s, 4s, 8s
    const delay = 2000 * Math.pow(2, attempts - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Se o usuário desconectou manualmente nesse meio tempo, aborta
    if (!this.scannedBleDevices.some((d) => d.id === dest.id)) return;

    try {
      await this.connectOutput(dest);
      this.reconnectAttempts.delete(dest.id);
      this.onRefreshCallback?.(this.destinations);
    } catch {
      void this.attemptBleReconnect(dest);
    }
  }

  public async connectOutput(destination: MidiDestination): Promise<void> {
    if (this.connectedOutputs.has(destination.id)) return;

    let canSend = destination.id === VIRTUAL_ID;
    if (destination.id !== VIRTUAL_ID) {
      if (destination.type === 'ble' && destination.bleAddress) {
        await this.native.connectBleMidi({ address: destination.bleAddress, outputPortIndex: 0, inputPortIndex: 0 });
        this.bleAddressToId.set(destination.bleAddress, destination.id);
        this.connectedInputs.add(destination.id);
        canSend = true;
      } else {
        const hasOutputPort = (destination.inputPortCount ?? 1) > 0;
        const hasInputPort = (destination.outputPortCount ?? 0) > 0;
        let firstError: unknown;
        let anyOk = false;
        if (hasOutputPort) {
          try {
            await this.native.connectOutput({ id: destination.id, portIndex: 0 });
            canSend = true;
            anyOk = true;
          } catch (error) {
            firstError = error;
          }
        }
        if (hasInputPort) {
          try {
            await this.native.connectInput({ id: destination.id, portIndex: 0 });
            this.connectedInputs.add(destination.id);
            anyOk = true;
          } catch (error) {
            firstError ??= error;
          }
        }
        if (!anyOk) throw firstError instanceof Error ? firstError : new Error('Dispositivo sem portas MIDI utilizáveis.');
      }
    }

    this.connectedOutputs.set(destination.id, destination);
    if (canSend && destination.id !== VIRTUAL_ID) this.ensureDefaultRoute(destination);
  }

  public async disconnectOutput(id: string): Promise<void> {
    const dest = this.connectedOutputs.get(id);
    if (!dest) return;
    this.reconnectAttempts.delete(id);
    await this.allNotesOffForDevice(dest);
    if (id !== VIRTUAL_ID) {
      const nativeId = dest.bleAddress || dest.id;
      try {
        await this.native.disconnectOutput({ id: nativeId });
        if (this.connectedInputs.has(id)) await this.native.disconnectInput({ id: nativeId });
      } catch (error) {
        console.warn('Falha ao desconectar no plugin nativo:', error);
      }
    }
    this.connectedInputs.delete(id);
    this.connectedOutputs.delete(id);
    this.sendFailures.delete(id);
    this.sendQueues.delete(dest.bleAddress || dest.id);
    this.onDisconnectCallback?.(dest, 'lost');
  }

  public getConnectedDestinations(): MidiDestination[] {
    return Array.from(this.connectedOutputs.values());
  }

  public async connectInput(inputId: string): Promise<void> {
    if (inputId === VIRTUAL_ID || this.connectedInputs.has(inputId)) return;
    await this.native.connectInput({ id: String(inputId), portIndex: 0 });
    this.connectedInputs.add(inputId);
  }

  public async disconnectInput(inputId: string): Promise<void> {
    if (inputId === VIRTUAL_ID || !this.connectedInputs.has(inputId)) return;
    await this.native.disconnectInput({ id: String(inputId) });
    this.connectedInputs.delete(inputId);
  }

  public getRoutes = (): MidiRoute[] => this.routesStore.get().routes;

  public subscribeRoutes = (listener: () => void): (() => void) => this.routesStore.subscribe(listener);

  public addRoute(route: Partial<MidiRoute> & { destinationId: string }): MidiRoute {
    const full: MidiRoute = {
      id: route.id ?? uid('route-'),
      enabled: route.enabled ?? true,
      sourceId: route.sourceId === undefined ? VIRTUAL_ID : route.sourceId,
      destinationId: route.destinationId,
      inputChannel: route.inputChannel ?? 0,
      outputChannel: route.outputChannel ?? 0,
      transpose: route.transpose ?? 0,
    };
    this.routesStore.set((s) => ({ routes: [...s.routes, full] }));
    return full;
  }

  public updateRoute(id: string, updates: Partial<MidiRoute>): void {
    this.routesStore.set((s) => ({ routes: s.routes.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
  }

  public removeRoute(id: string): void {
    this.routesStore.set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
  }

  private ensureDefaultRoute(dest: MidiDestination): void {
    if (this.getRoutes().some((r) => r.destinationId === dest.id)) return;
    this.addRoute({ sourceId: VIRTUAL_ID, destinationId: dest.id });
  }

  public getBleServerActive(): boolean {
    return this.bleServerActive;
  }

  public async isBleServerRunning(): Promise<boolean> {
    try {
      this.bleServerActive = (await this.native.isBleServerRunning()).active === true;
    } catch {
      this.bleServerActive = false;
    }
    return this.bleServerActive;
  }

  public async startBleServer(): Promise<boolean> {
    this.bleServerActive = (await this.native.startBleServer()).active === true;
    return this.bleServerActive;
  }

  public async stopBleServer(): Promise<void> {
    await this.native.stopBleServer();
    this.bleServerActive = false;
  }

  public addActivityListener(listener: (velocity: number) => void): void {
    this.activityListeners.add(listener);
  }
  public removeActivityListener(listener: (velocity: number) => void): void {
    this.activityListeners.delete(listener);
  }
  public addMessageListener(listener: (message: MidiMessage) => void): void {
    this.messageListeners.add(listener);
  }
  public removeMessageListener(listener: (message: MidiMessage) => void): void {
    this.messageListeners.delete(listener);
  }
  public addTap(tap: MidiTap): () => void {
    this.taps.add(tap);
    return () => this.taps.delete(tap);
  }
  public setLearn(learn: MidiLearn | null): void {
    this.learn = learn;
  }

  public getLog = (): MidiLogEntry[] => this.logEntries;
  public subscribeLog = (listener: () => void): (() => void) => {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  };
  public clearLog(): void {
    this.logEntries = [];
    this.logListeners.forEach((l) => l());
  }

  private pushLog(status: number, data1: number, data2: number, sourceId: string | undefined, direction: 'RX' | 'TX'): void {
    const command = status & 0xf0;
    const type = describeMessage(status, data2);
    const length = channelMessageLength(status);
    const bytes = length === 0 ? [status] : length === 2 ? [status, data1] : [status, data1, data2];
    const entry: MidiLogEntry = {
      id: `${this.now()}-${this.logSeq++}`,
      timestamp: new Date(this.now()).toLocaleTimeString(),
      type,
      channel: command >= 0xf0 ? 0 : (status & 0x0f) + 1,
      note: data1,
      noteName: command === 0x80 || command === 0x90 || command === 0xa0 ? getNoteName(data1) : '--',
      velocity: data2,
      bytesHex: toHex(bytes),
      direction,
      source: sourceId,
    };
    this.logEntries = [entry, ...this.logEntries].slice(0, LOG_LIMIT);
    this.logListeners.forEach((l) => l());
  }

  public async sendKeyboardNote(channel: number, note: number, velocity: number, isNoteOn: boolean): Promise<{ hex: string }> {
    const safeNote = clampInt(note, 0, 127);
    const safeVelocity = clampInt(velocity, 0, 127);
    const on = isNoteOn && safeVelocity > 0;
    const status = channelStatus(on ? 0x90 : 0x80, channel);
    this.routeMessage(status, safeNote, safeVelocity, VIRTUAL_ID);
    return { hex: toHex([status, safeNote, safeVelocity]) };
  }

  public async sendControlChange(channel: number, controller: number, value: number): Promise<{ hex: string }> {
    const status = channelStatus(0xb0, channel);
    const cc = clampInt(controller, 0, 127);
    const v = clampInt(value, 0, 127);
    this.routeMessage(status, cc, v, VIRTUAL_ID);
    return { hex: toHex([status, cc, v]) };
  }

  public async sendProgramChange(channel: number, program: number): Promise<{ hex: string }> {
    const status = channelStatus(0xc0, channel);
    const p = clampInt(program, 0, 127);
    this.routeMessage(status, p, 0, VIRTUAL_ID);
    return { hex: toHex([status, p]) };
  }

  public async sendPitchBend(channel: number, value: number): Promise<{ hex: string }> {
    const status = channelStatus(0xe0, channel);
    const v = clampInt(value, 0, 16383);
    const lsb = v & 0x7f;
    const msb = (v >> 7) & 0x7f;
    this.routeMessage(status, lsb, msb, VIRTUAL_ID);
    return { hex: toHex([status, lsb, msb]) };
  }

  public async sendChannelPressure(channel: number, pressure: number): Promise<{ hex: string }> {
    const status = channelStatus(0xd0, channel);
    const p = clampInt(pressure, 0, 127);
    this.routeMessage(status, p, 0, VIRTUAL_ID);
    return { hex: toHex([status, p]) };
  }

  public async sendPanic(channels: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1)): Promise<void> {
    this.synth.allNotesOff();
    const targets = [...this.connectedOutputs.values()].filter((d) => d.id !== VIRTUAL_ID);
    if (this.bleServerActive) targets.push(this.bleServerDestination());
    
    // Silencia o sintetizador interno no app
    for (const channel of channels) {
      for (const [c, v] of [[64, 0], [120, 0], [123, 0]] as const) {
        this.synth.controlChange(c, v, channel);
      }
    }

    // Envia a tríade de emergência para todos os dispositivos externos
    await Promise.all(targets.map((dest) => this.sendPanicToDevice(dest, channels)));
  }

  private async sendPanicToDevice(dest: MidiDestination, channels: readonly number[]): Promise<void> {
    for (const channel of channels) {
      const status = channelStatus(0xb0, channel);
      await this.sendToDevice(dest, [status, 64, 0]);  // Sustain Off
      await this.sendToDevice(dest, [status, 120, 0]); // All Sound Off
      await this.sendToDevice(dest, [status, 123, 0]); // All Notes Off
    }
  }

  public async broadcastRealtime(status: number): Promise<void> {
    if (status < 0xf8) return;
    const targets = [...this.connectedOutputs.values()].filter((d) => d.id !== VIRTUAL_ID);
    if (this.bleServerActive) targets.push(this.bleServerDestination());
    await Promise.all(targets.map((d) => this.sendToDevice(d, [status])));
  }

  private bleServerDestination(): MidiDestination {
    return { id: BLE_SERVER_ID, name: 'BLE MIDI (visível)', displayName: 'BLE MIDI (visível)', type: 'ble' };
  }

  public routeMessage(status: number, data1: number, data2: number, sourceId?: string): void {
    const command = status & 0xf0;
    const inputChannel = (status & 0x0f) + 1;
    const fromApp = sourceId === VIRTUAL_ID;

    this.pushLog(status, data1, data2, sourceId, fromApp ? 'TX' : 'RX');
    if (command === 0x90 && data2 > 0) this.activityListeners.forEach((l) => safe(() => l(data2)));
    this.taps.forEach((tap) => safe(() => tap({ status, data1, data2, sourceId })));

    if (this.synth.getIsReady()) {
      switch (command) {
        case 0x90:
          if (data2 > 0) this.synth.noteOn(data1, data2, inputChannel);
          else this.synth.noteOff(data1, inputChannel);
          break;
        case 0x80:
          this.synth.noteOff(data1, inputChannel);
          break;
        case 0xa0:
          this.synth.polyPressure(data1, data2, inputChannel);
          break;
        case 0xb0:
          this.synth.controlChange(data1, data2, inputChannel);
          break;
        case 0xc0:
          this.synth.programChange(data1, inputChannel);
          break;
        case 0xd0:
          this.synth.channelPressure(data1, inputChannel);
          break;
        case 0xe0:
          this.synth.pitchBend((data2 << 7) | data1, inputChannel);
          break;
        default:
          break;
      }
    }

    if (fromApp && this.bleServerActive) {
      void this.sendToDevice(this.bleServerDestination(), this.encode(command, inputChannel, data1, data2));
    }

    for (const route of this.getRoutes()) {
      if (!route.enabled) continue;
      if (route.sourceId && route.sourceId !== sourceId) continue;
      if (route.inputChannel > 0 && inputChannel !== route.inputChannel) continue;

      let out1 = clampInt(data1, 0, 127);
      const out2 = clampInt(data2, 0, 127);
      if (command === 0x90 || command === 0x80 || command === 0xa0) out1 = clampInt(out1 + route.transpose, 0, 127);

      const outputChannel = route.outputChannel > 0 ? clampInt(route.outputChannel, 1, 16) : inputChannel;
      const dest = this.connectedOutputs.get(route.destinationId);
      if (dest) void this.sendToDevice(dest, this.encode(command, outputChannel, out1, out2));
    }
  }

  private encode(command: number, channel: number, data1: number, data2: number): number[] {
    const status = command + channel - 1;
    return command === 0xc0 || command === 0xd0 ? [status, data1] : [status, data1, data2];
  }

  // NOVO: Fila FIFO por dispositivo para garantir a ordem exata das mensagens MIDI
  private async sendToDevice(destination: MidiDestination, bytes: number[]): Promise<void> {
    if (destination.id === VIRTUAL_ID) return;
    const target = destination.id === BLE_SERVER_ID ? BLE_SERVER_ID : destination.bleAddress || destination.id;

    // Pega a promessa anterior na fila (ou uma já resolvida)
    const previous = this.sendQueues.get(target) ?? Promise.resolve();

    // Cria a nova tarefa encadeada
    const current = previous.then(async () => {
      try {
        await this.native.sendTo({ id: target, data: bytes });
        this.sendFailures.delete(destination.id);
      } catch (error) {
        const failures = (this.sendFailures.get(destination.id) ?? 0) + 1;
        this.sendFailures.set(destination.id, failures);
        if (failures >= MAX_SEND_FAILURES && destination.id !== BLE_SERVER_ID) {
          console.warn(`Destino ${destination.displayName} não responde:`, error);
          this.dropDevice(destination, 'failed');
        }
      }
    });

    // Salva a nova promessa no mapa
    this.sendQueues.set(target, current);

    // Limpa o mapa se esta foi a última mensagem da fila
    current.finally(() => {
      if (this.sendQueues.get(target) === current) {
        this.sendQueues.delete(target);
      }
    });

    return current;
  }

  public async allNotesOffForDevice(destination: MidiDestination): Promise<void> {
    if (destination.id === VIRTUAL_ID) return;
    await this.sendPanicToDevice(destination, Array.from({ length: 16 }, (_, i) => i + 1));
  }

  private normalizeSource(sourceId?: string): string | undefined {
    if (!sourceId) return sourceId;
    return this.bleAddressToId.get(sourceId) ?? sourceId;
  }

  public handleIncomingBytes(bytes: number[], rawSourceId?: string): void {
    if (!Array.isArray(bytes) || bytes.length === 0) return;
    const sourceId = this.normalizeSource(rawSourceId);

    for (const parsed of parseMidiBytes(bytes)) {
      if (parsed.kind === 'sysex') continue;

      if (parsed.kind === 'realtime') {
        this.forwardRealtime(parsed.status, sourceId);
        continue;
      }

      const { status, data1, data2 } = parsed;
      const message: MidiMessage = { status, data1, data2, timestamp: this.now(), sourceId };
      this.messageListeners.forEach((l) => safe(() => l(message), 'Erro em listener MIDI:'));

      if (this.learn?.handle(status, data1, data2)) {
        this.pushLog(status, data1, data2, sourceId, 'RX');
        continue;
      }
      this.routeMessage(status, data1, data2, sourceId);
    }
  }

  private forwardRealtime(status: number, sourceId?: string): void {
    if (!CLOCK_OR_SENSING.has(status)) this.pushLog(status, 0, 0, sourceId, 'RX');
    if (status === 0xfe) return;
    for (const route of this.getRoutes()) {
      if (!route.enabled) continue;
      if (route.sourceId && route.sourceId !== sourceId) continue;
      const dest = this.connectedOutputs.get(route.destinationId);
      if (dest) void this.sendToDevice(dest, [status]);
    }
  }
}

function safe(fn: () => void, message = 'Erro em listener:'): void {
  try {
    fn();
  } catch (error) {
    console.error(message, error);
  }
}
