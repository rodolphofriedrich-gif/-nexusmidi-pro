import { dedupeDestinations } from '../../lib/destinations';
import type { MidiDestination } from '../../types/midi';
import type { NativeBleDevice, NativeBleServerStatus, NativeMidiPlugin } from '../nativeMidi';
import { VIRTUAL_ID } from './midiConstants';
import type { MidiSendQueue } from './midiSendQueue';

type NativeMidiPort = Pick<
  NativeMidiPlugin,
  | 'getDevices'
  | 'connectOutput'
  | 'connectInput'
  | 'disconnectOutput'
  | 'disconnectInput'
  | 'scanBleDevices'
  | 'connectBleMidi'
  | 'startBleServer'
  | 'stopBleServer'
  | 'isBleServerRunning'
>;

/**
 * Razão de uma desconexão reportada via `onDisconnect`:
 *   - `lost`:          o device sumiu (USB removido, devicesChanged).
 *   - `manual`:        o usuário desconectou pela UI (`disconnectOutput`).
 *   - `reconnecting`:  falha de BLE; o manager está tentando reconectar.
 *   - `failed`:        esgotou as tentativas de reconexão (ou falha de envio).
 *
 * `manual` foi adicionado na Fase 4 (decisão 3) para o App poder distinguir
 * "usuário desconectou" de "sinal caiu". Se o App tem switch exaustivo sobre
 * esse tipo, troque `'manual'` de volta por `'lost'` no `disconnectOutput`.
 */
export type DisconnectReason = 'lost' | 'manual' | 'reconnecting' | 'failed';

export interface MidiConnectionManagerDeps {
  native: NativeMidiPort;
  sendQueue: MidiSendQueue;
  /** Chamado por `connectOutput` quando o destino tem porta de saída. */
  ensureDefaultRoute: (dest: MidiDestination) => void;
  /** Repassa para a UI sempre que a lista de destinos muda. */
  onRefresh: (destinations: MidiDestination[]) => void;
  /** Repassa para a UI quando um device é perdido/desconectado/reconectando. */
  onDisconnect: (dest: MidiDestination, reason: DisconnectReason) => void;
}

/**
 * Concentra TODAS as operações de conexão:
 *   - Descoberta (`refreshDevices`, `scanBleDevice`).
 *   - Conexão/desconexão USB e BLE (`connectOutput` etc).
 *   - Reconnect automático de BLE com backoff exponencial e 3 guards contra
 *     reconectar após desconexão manual.
 *   - Estado do servidor BLE visível (peripheral).
 *
 * Extraído do `midiCore.ts` na Fase 4 (feedback item 3). O core permanece
 * apenas como orquestrador (routeMessage/sendPanic/handleIncomingBytes).
 *
 * Dependências resolvidas no construtor via callbacks — não conhece rotas,
 * monitor nem panic. Só o que precisa: envio (sendQueue), criação de rota
 * padrão (ensureDefaultRoute) e avisos para a UI (onRefresh/onDisconnect).
 */
export class MidiConnectionManager {
  private readonly native: NativeMidiPort;
  private readonly sendQueue: MidiSendQueue;
  private readonly ensureDefaultRoute: (dest: MidiDestination) => void;
  private readonly onRefresh: (destinations: MidiDestination[]) => void;
  private readonly onDisconnect: (dest: MidiDestination, reason: DisconnectReason) => void;

  private destinations: MidiDestination[] = [];
  private scannedBleDevices: MidiDestination[] = [];
  private readonly connectedOutputs = new Map<string, MidiDestination>();
  private readonly connectedInputs = new Set<string>();
  private readonly bleAddressToId = new Map<string, string>();
  private readonly reconnectAttempts = new Map<string, number>();
  private readonly manuallyDisconnected = new Set<string>();
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private bleServerActive = false;

  constructor(deps: MidiConnectionManagerDeps) {
    this.native = deps.native;
    this.sendQueue = deps.sendQueue;
    this.ensureDefaultRoute = deps.ensureDefaultRoute;
    this.onRefresh = deps.onRefresh;
    this.onDisconnect = deps.onDisconnect;
  }

  // ---- Descoberta ------------------------------------------------------

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
      this.onRefresh(this.destinations);
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

  public async handleDevicesChanged(): Promise<void> {
    const list = await this.refreshDevices();
    const present = new Set(list.map((d) => d.id));
    for (const dest of [...this.connectedOutputs.values()]) {
      if (dest.id === VIRTUAL_ID || dest.type === 'ble') continue;
      if (!present.has(dest.id)) this.dropDevice(dest, 'lost');
    }
  }

  public handleBleServerChanged(status: NativeBleServerStatus | undefined): void {
    this.bleServerActive = status?.active === true;
    this.onRefresh(this.destinations);
  }

  // ---- Conexão ---------------------------------------------------------

  public async connectOutput(destination: MidiDestination, opts?: { isReconnect?: boolean }): Promise<void> {
    if (this.connectedOutputs.has(destination.id)) return;

    // Reconnect automático nunca deve reverter uma desconexão manual.
    if (opts?.isReconnect) {
      if (this.manuallyDisconnected.has(destination.id)) return;
    } else {
      this.manuallyDisconnected.delete(destination.id);
    }

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

    // Desconexão manual: suprime reconnect automático de BLE e cancela timer.
    this.manuallyDisconnected.add(id);
    this.reconnectAttempts.delete(id);
    this.clearReconnectTimer(id);

    await this.sendQueue.allNotesOff(dest);
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
    this.sendQueue.reset(dest);
    // Decisão 3: usa 'manual' para o App distinguir de perda de sinal.
    this.onDisconnect(dest, 'manual');
  }

  public getConnectedDestinations(): MidiDestination[] {
    return Array.from(this.connectedOutputs.values());
  }

  public getConnectedDestination(id: string): MidiDestination | undefined {
    return this.connectedOutputs.get(id);
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

  // ---- Drop e reconnect BLE --------------------------------------------

  /**
   * Remove um destino conectado. Chamado por:
   *   - `handleDevicesChanged` (device sumiu do sistema → 'lost').
   *   - `sendQueue.onDeviceFailed` (falha de envio → 'failed').
   *
   * Para BLE com `'failed'`, agenda reconnect automático (3 tentativas com
   * backoff exponencial), a menos que o usuário tenha desconectado.
   */
  public dropDevice(dest: MidiDestination, reason: 'lost' | 'failed' = 'lost'): void {
    if (!this.connectedOutputs.delete(dest.id)) return;
    this.connectedInputs.delete(dest.id);
    this.reconnectAttempts.delete(dest.id);
    this.clearReconnectTimer(dest.id);
    this.sendQueue.reset(dest);
    this.onDisconnect(dest, reason);
    this.onRefresh(this.destinations);

    if (reason === 'failed' && dest.type === 'ble') {
      void this.attemptBleReconnect(dest);
    }
  }

  private clearReconnectTimer(id: string): void {
    const timer = this.reconnectTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.reconnectTimers.delete(id);
    }
  }

  private async attemptBleReconnect(dest: MidiDestination): Promise<void> {
    if (!dest.bleAddress) return;
    // Guard 1: usuário desconectou manualmente — não reconectar.
    if (this.manuallyDisconnected.has(dest.id)) return;
    const attempts = (this.reconnectAttempts.get(dest.id) ?? 0) + 1;
    this.reconnectAttempts.set(dest.id, attempts);

    if (attempts > 3) {
      this.reconnectAttempts.delete(dest.id);
      this.onDisconnect(dest, 'failed');
      return;
    }

    this.onDisconnect(dest, 'reconnecting');

    const delay = 2000 * Math.pow(2, attempts - 1);
    // Guard 2: agenda via timer controlável para poder cancelar em disconnectOutput.
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(dest.id);
      void this.runReconnectAttempt(dest);
    }, delay);
    this.reconnectTimers.set(dest.id, timer);
  }

  private async runReconnectAttempt(dest: MidiDestination): Promise<void> {
    // Guard 3: re-checa manuallyDisconnected (pode ter mudado durante a espera).
    if (this.manuallyDisconnected.has(dest.id)) return;
    if (!this.scannedBleDevices.some((d) => d.id === dest.id)) return;

    try {
      await this.connectOutput(dest, { isReconnect: true });
      this.reconnectAttempts.delete(dest.id);
      this.onRefresh(this.destinations);
    } catch {
      void this.attemptBleReconnect(dest);
    }
  }

  // ---- BLE server ------------------------------------------------------

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

  // ---- Helpers ---------------------------------------------------------

  public normalizeSource(sourceId?: string): string | undefined {
    if (!sourceId) return sourceId;
    return this.bleAddressToId.get(sourceId) ?? sourceId;
  }
}
