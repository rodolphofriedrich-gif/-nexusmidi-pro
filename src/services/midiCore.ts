import { getNoteName, toHex, clampInt, channelStatus } from '../lib/midiMath';
import { parseMidiBytes } from '../lib/midiParser';
import type { StorageLike } from '../lib/storeCore';
import type { MidiLearn } from '../lib/midiLearn';
import type { MidiDestination, MidiLogEntry, MidiMessage, MidiRoute } from '../types/midi';
import type { NativeBleDevice, NativeMidiPlugin } from './nativeMidi';
import { MidiMonitor, type MidiTap } from './midi/midiMonitor';
import { MidiSendQueue } from './midi/midiSendQueue';
import { MidiRoutingEngine } from './midi/midiRoutingEngine';
import { MidiConnectionManager, type DisconnectReason } from './midi/midiConnectionManager';
import { bleServerDestination } from './midi/midiDestinations';
import { BLE_SERVER_ID, VIRTUAL_ID } from './midi/midiConstants';
import { withTimeout } from './midi/midiTimeout';

export { getNoteName };
export type { MidiMessage };
export type { MidiTap } from './midi/midiMonitor';
export type { DisconnectReason } from './midi/midiConnectionManager';
export { BLE_SERVER_ID, VIRTUAL_ID };

const PANIC_TIMEOUT_MS = 30000; // timeout global do panic
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

export interface PanicResult {
  /** Nomes dos dispositivos que não receberam todas as mensagens do panic. */
  failed: string[];
}

export class MidiService {
  private readonly native: NativeMidiPort;
  private readonly synth: SynthPort;
  private readonly now: () => number;

  /** Log, listeners de mensagem, taps, VU e MIDI Learn. Fase 1. */
  private readonly monitor: MidiMonitor;

  /** Fila FIFO por device e envio urgent. Fase 2. */
  private readonly sendQueue: MidiSendQueue;

  /** Rotas: persistência, CRUD e aplicação. Fase 3. */
  private readonly routing: MidiRoutingEngine;

  /** Conexões USB/BLE, reconnect, BLE server. Fase 4. */
  private readonly connections: MidiConnectionManager;

  private onRefreshCallback?: (destinations?: MidiDestination[]) => void;
  private onDisconnectCallback?: (destination: MidiDestination, reason?: DisconnectReason) => void;
  private listenersReady: Promise<void>;

  constructor(deps: MidiServiceDeps) {
    this.native = deps.native;
    this.synth = deps.synth;
    this.now = deps.now ?? Date.now;

    this.monitor = new MidiMonitor({ now: this.now });

    // onDeviceFailed do sendQueue → dropDevice do manager.
    // Referência lazy: `this.connections` ainda não existe, mas o callback
    // só é chamado em runtime, depois do construtor.
    this.sendQueue = new MidiSendQueue({
      native: this.native,
      onDeviceFailed: (dest) => this.connections.dropDevice(dest, 'failed'),
    });

    // Manager não conhece routing/sendQueue — recebe callbacks.
    // `ensureDefaultRoute` é lazy (usa this.routing, que ainda não existe).
    // `onRefresh`/`onDisconnect` são lazy também: leem os callbacks atuais
    // do core, refletindo eventuais `setCallbacks()` posteriores.
    this.connections = new MidiConnectionManager({
      native: this.native,
      sendQueue: this.sendQueue,
      ensureDefaultRoute: (dest) => this.routing.ensureDefaultRoute(dest),
      onRefresh: (destinations) => this.onRefreshCallback?.(destinations),
      onDisconnect: (dest, reason) => this.onDisconnectCallback?.(dest, reason),
    });

    // Routing depende de connections (para saber se destino está conectado)
    // e de sendQueue (para enviar). Ambas resolvidas por closure lazy.
    this.routing = new MidiRoutingEngine({
      storage: deps.storage,
      getDestination: (id) => this.connections.getConnectedDestination(id),
      send: (dest, bytes) => void this.sendQueue.sendToDevice(dest, bytes),
    });

    this.listenersReady = this.installNativeListeners();
  }

  private async installNativeListeners(): Promise<void> {
    try {
      await this.native.addListener('midiMessage', (event) => {
        if (!event || !Array.isArray(event.data)) return;
        this.handleIncomingBytes(event.data, event.sourceId != null ? String(event.sourceId) : undefined);
      });
      await this.native.addListener('devicesChanged', () => void this.connections.handleDevicesChanged());
      await this.native.addListener('bleServerChanged', (status) => this.connections.handleBleServerChanged(status));
    } catch (error) {
      console.error('Não foi possível registrar os listeners MIDI nativos:', error);
    }
  }

  public setCallbacks(
    onRefresh: (destinations?: MidiDestination[]) => void,
    onDisconnect: (destination: MidiDestination, reason?: DisconnectReason) => void,
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

  // ---- Descoberta (delegação para o ConnectionManager) -----------------

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    return this.connections.getAvailableDestinations();
  }

  public async refreshDevices(): Promise<MidiDestination[]> {
    return this.connections.refreshDevices();
  }

  public async scanBleDevice(): Promise<NativeBleDevice[]> {
    return this.connections.scanBleDevice();
  }

  public getDestinations(): MidiDestination[] {
    return this.connections.getDestinations();
  }

  // ---- Conexão (delegação para o ConnectionManager) --------------------

  public async connectOutput(destination: MidiDestination, opts?: { isReconnect?: boolean }): Promise<void> {
    return this.connections.connectOutput(destination, opts);
  }

  public async disconnectOutput(id: string): Promise<void> {
    return this.connections.disconnectOutput(id);
  }

  public getConnectedDestinations(): MidiDestination[] {
    return this.connections.getConnectedDestinations();
  }

  public async connectInput(inputId: string): Promise<void> {
    return this.connections.connectInput(inputId);
  }

  public async disconnectInput(inputId: string): Promise<void> {
    return this.connections.disconnectInput(inputId);
  }

  // ---- Rotas (delegação para o RoutingEngine) --------------------------

  public getRoutes = (): MidiRoute[] => this.routing.getRoutes();
  public subscribeRoutes = (listener: () => void): (() => void) => this.routing.subscribeRoutes(listener);

  public addRoute(route: Partial<MidiRoute> & { destinationId: string }): MidiRoute {
    return this.routing.addRoute(route);
  }

  public updateRoute(id: string, updates: Partial<MidiRoute>): void {
    this.routing.updateRoute(id, updates);
  }

  public removeRoute(id: string): void {
    this.routing.removeRoute(id);
  }

  // ---- BLE server (delegação para o ConnectionManager) -----------------

  public getBleServerActive(): boolean {
    return this.connections.getBleServerActive();
  }

  public async isBleServerRunning(): Promise<boolean> {
    return this.connections.isBleServerRunning();
  }

  public async startBleServer(): Promise<boolean> {
    return this.connections.startBleServer();
  }

  public async stopBleServer(): Promise<void> {
    return this.connections.stopBleServer();
  }

  // ---- Monitor (delegação) ---------------------------------------------

  public addActivityListener(listener: (velocity: number) => void): void {
    this.monitor.addActivityListener(listener);
  }
  public removeActivityListener(listener: (velocity: number) => void): void {
    this.monitor.removeActivityListener(listener);
  }
  public addMessageListener(listener: (message: MidiMessage) => void): void {
    this.monitor.addMessageListener(listener);
  }
  public removeMessageListener(listener: (message: MidiMessage) => void): void {
    this.monitor.removeMessageListener(listener);
  }
  public addTap(tap: MidiTap): () => void {
    return this.monitor.addTap(tap);
  }
  public setLearn(learn: MidiLearn | null): void {
    this.monitor.setLearn(learn);
  }
  public getLog = (): MidiLogEntry[] => this.monitor.getLog();
  public subscribeLog = (listener: () => void): (() => void) => this.monitor.subscribeLog(listener);
  public clearLog(): void {
    this.monitor.clearLog();
  }

  // ---- API de envio ----------------------------------------------------

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

  /**
   * MIDI Panic: silencia o synth interno e todos os dispositivos conectados.
   * Retorna os destinos que NÃO conseguiram receber todas as mensagens — o App
   * pode usar isso para avisar o usuário (em vez de mostrar sucesso falso).
   *
   * `sendQueue.panicToDevice` usa `sendUrgent` (bypass da fila) para devices
   * externos — o panic precisa chegar ANTES de clocks/CCs acumulados na FIFO.
   *
   * Protegido por timeout global (PANIC_TIMEOUT_MS): se um dispositivo travar,
   * o panic retorna em vez de travar o app. Devices que não completaram antes
   * do timeout são reportados como failed.
   */
  public async sendPanic(channels: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1)): Promise<PanicResult> {
    this.synth.allNotesOff();
    const targets = this.connections.getConnectedDestinations().filter((d) => d.id !== VIRTUAL_ID);
    if (this.connections.getBleServerActive()) targets.push(bleServerDestination());

    for (const channel of channels) {
      for (const [c, v] of [[64, 0], [120, 0], [123, 0]] as const) {
        this.synth.controlChange(c, v, channel);
      }
    }

    if (targets.length === 0) return { failed: [] };

    const okSet = new Set<string>();

    const tasks = targets.map(async (dest) => {
      try {
        const ok = await this.sendQueue.panicToDevice(dest, channels);
        if (ok) okSet.add(dest.id);
      } catch {
        // Erro individual do device: reportado como failed pela ausência no okSet.
      }
    });

    try {
      await withTimeout(Promise.all(tasks), PANIC_TIMEOUT_MS, 'sendPanic');
    } catch (error) {
      console.warn('MIDI Panic: timeout global atingido', error);
    }

    const failed = targets.filter((d) => !okSet.has(d.id)).map((d) => d.displayName);
    return { failed };
  }

  public async broadcastRealtime(status: number): Promise<void> {
    if (status < 0xf8) return;
    const targets = this.connections.getConnectedDestinations().filter((d) => d.id !== VIRTUAL_ID);
    if (this.connections.getBleServerActive()) targets.push(bleServerDestination());
    await Promise.all(targets.map((d) => this.sendQueue.sendToDevice(d, [status])));
  }

  public async allNotesOffForDevice(destination: MidiDestination): Promise<void> {
    await this.sendQueue.allNotesOff(destination);
  }

  public routeMessage(status: number, data1: number, data2: number, sourceId?: string): void {
    const command = status & 0xf0;
    const inputChannel = (status & 0x0f) + 1;
    const fromApp = sourceId === VIRTUAL_ID;

    this.monitor.pushLog(status, data1, data2, sourceId, fromApp ? 'TX' : 'RX');
    if (command === 0x90 && data2 > 0) this.monitor.notifyActivity(data2);
    this.monitor.notifyTap({ status, data1, data2, sourceId });

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

    if (fromApp && this.connections.getBleServerActive()) {
      void this.sendQueue.sendToDevice(bleServerDestination(), this.encode(command, inputChannel, data1, data2));
    }

    this.routing.dispatch(status, data1, data2, sourceId);
  }

  private encode(command: number, channel: number, data1: number, data2: number): number[] {
    const status = command + channel - 1;
    return command === 0xc0 || command === 0xd0 ? [status, data1] : [status, data1, data2];
  }

  public handleIncomingBytes(bytes: number[], rawSourceId?: string): void {
    if (!Array.isArray(bytes) || bytes.length === 0) return;
    const sourceId = this.connections.normalizeSource(rawSourceId);

    for (const parsed of parseMidiBytes(bytes)) {
      if (parsed.kind === 'sysex') continue;

      if (parsed.kind === 'realtime') {
        this.forwardRealtime(parsed.status, sourceId);
        continue;
      }

      const { status, data1, data2 } = parsed;
      const message: MidiMessage = { status, data1, data2, timestamp: this.now(), sourceId };
      this.monitor.notifyMessage(message);

      if (this.monitor.tryHandleLearn(status, data1, data2)) {
        this.monitor.pushLog(status, data1, data2, sourceId, 'RX');
        continue;
      }
      this.routeMessage(status, data1, data2, sourceId);
    }
  }

  private forwardRealtime(status: number, sourceId?: string): void {
    if (!CLOCK_OR_SENSING.has(status)) this.monitor.pushLog(status, 0, 0, sourceId, 'RX');
    if (status === 0xfe) return;
    this.routing.dispatchRealtime(status, sourceId);
  }
}
