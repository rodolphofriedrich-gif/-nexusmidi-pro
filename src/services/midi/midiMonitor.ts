import { describeMessage, getNoteName, toHex, channelMessageLength } from '../../lib/midiMath';
import type { MidiLearn } from '../../lib/midiLearn';
import type { MidiLogEntry, MidiMessage } from '../../types/midi';

const LOG_LIMIT = 300;

export interface MidiTap {
  (event: { status: number; data1: number; data2: number; sourceId?: string }): void;
}

export interface MidiMonitorDeps {
  now: () => number;
}

function safe(fn: () => void, message = 'Erro em listener:'): void {
  try {
    fn();
  } catch (error) {
    console.error(message, error);
  }
}

/**
 * Centraliza tudo o que é "observação" do fluxo MIDI:
 *   - Log de mensagens (histórico curto em memória, com limite de 300).
 *   - Listeners de mensagens recebidas.
 *   - Listeners de atividade (VU meter).
 *   - Taps (usado pelo gravador).
 *   - MIDI Learn (consumo de CC/Note mapeados).
 *
 * Não conhece rotas, filas, conexões nem panic. Quem quiser notificar
 * o monitor, chama um dos métodos `notify*` / `pushLog` / `tryHandleLearn`.
 */
export class MidiMonitor {
  private readonly now: () => number;

  private logEntries: MidiLogEntry[] = [];
  private logSeq = 0;
  private logListeners = new Set<() => void>();

  private messageListeners = new Set<(message: MidiMessage) => void>();
  private activityListeners = new Set<(velocity: number) => void>();
  private taps = new Set<MidiTap>();
  private learn: MidiLearn | null = null;

  constructor(deps: MidiMonitorDeps) {
    this.now = deps.now;
  }

  public pushLog(
    status: number,
    data1: number,
    data2: number,
    sourceId: string | undefined,
    direction: 'RX' | 'TX',
  ): void {
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

  public getLog = (): MidiLogEntry[] => this.logEntries;

  public subscribeLog = (listener: () => void): (() => void) => {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  };

  public clearLog(): void {
    this.logEntries = [];
    this.logListeners.forEach((l) => l());
  }

  public addMessageListener(listener: (message: MidiMessage) => void): void {
    this.messageListeners.add(listener);
  }

  public removeMessageListener(listener: (message: MidiMessage) => void): void {
    this.messageListeners.delete(listener);
  }

  public notifyMessage(message: MidiMessage): void {
    this.messageListeners.forEach((l) => safe(() => l(message), 'Erro em listener MIDI:'));
  }

  public addActivityListener(listener: (velocity: number) => void): void {
    this.activityListeners.add(listener);
  }

  public removeActivityListener(listener: (velocity: number) => void): void {
    this.activityListeners.delete(listener);
  }

  public notifyActivity(velocity: number): void {
    this.activityListeners.forEach((l) => safe(() => l(velocity)));
  }

  public addTap(tap: MidiTap): () => void {
    this.taps.add(tap);
    return () => this.taps.delete(tap);
  }

  public notifyTap(event: { status: number; data1: number; data2: number; sourceId?: string }): void {
    this.taps.forEach((tap) => safe(() => tap(event)));
  }

  public setLearn(learn: MidiLearn | null): void {
    this.learn = learn;
  }

  /**
   * Tenta aplicar o MIDI Learn. Retorna `true` se a mensagem foi consumida
   * (nesse caso o chamador deve pular o roteamento normal).
   */
  public tryHandleLearn(status: number, data1: number, data2: number): boolean {
    return this.learn?.handle(status, data1, data2) === true;
  }
}
