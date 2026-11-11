import { channelStatus } from '../../lib/midiMath';
import type { MidiDestination } from '../../types/midi';
import type { NativeMidiPlugin } from '../nativeMidi';
import { BLE_SERVER_ID, VIRTUAL_ID } from './midiConstants';
import { withTimeout } from './midiTimeout';

const MAX_SEND_FAILURES = 3;
const MAX_QUEUE_DEPTH = 200;
const DROP_THRESHOLD = 400;
const MAX_TOTAL_QUEUE_DEPTH = 1500; // limite absoluto de segurança
const SEND_TIMEOUT_MS = 5000; // timeout por mensagem individual (fila normal)
const URGENT_TIMEOUT_MS = 3000; // timeout por mensagem no panic (bypass)

export interface MidiSendQueueDeps {
  /** Precisa só de `sendTo` — evita acoplar o módulo ao contrato inteiro do plugin. */
  native: Pick<NativeMidiPlugin, 'sendTo'>;
  /**
   * Chamado quando um device atinge `MAX_SEND_FAILURES` falhas consecutivas,
   * OU quando a fila satura acima de `MAX_TOTAL_QUEUE_DEPTH + 500`.
   * No `MidiService`, isso está ligado a `dropDevice(dest, 'failed')`.
   */
  onDeviceFailed: (destination: MidiDestination) => void;
}

function resolveTarget(destination: MidiDestination): string {
  return destination.id === BLE_SERVER_ID ? BLE_SERVER_ID : destination.bleAddress || destination.id;
}

/**
 * Fila FIFO por dispositivo. Limites (do menos para o mais restritivo):
 *   - Depth < 200:              tudo passa normalmente.
 *   - Depth >= 200:             clocks são descartados.
 *   - Depth >= 400:             também CC, program, pitch bend, poly pressure, etc.
 *   - Depth >= 1500:            limite ABSOLUTO. Tudo é descartado, EXCETO Note Off.
 *   - Depth >= 2000 (1500+500): força `onDeviceFailed` (o MidiService dropa).
 *
 * Cada `native.sendTo` é envolvido em `withTimeout(SEND_TIMEOUT_MS)`: se o
 * dispositivo travar, a mensagem falha após 5s, incrementa `sendFailures` e,
 * após `MAX_SEND_FAILURES`, dispara `onDeviceFailed`.
 *
 * `sendToDevice` retorna `true` se a mensagem foi aceita na fila, `false` se
 * foi descartada (por saturação ou se o envio nativo falhou).
 *
 * `sendUrgent` bypassa a fila (usado pelo MIDI Panic e por
 * `allNotesOffForDevice`) — precisa furar a FIFO quando há centenas de
 * clocks/CCs acumulados.
 */
export class MidiSendQueue {
  private readonly native: Pick<NativeMidiPlugin, 'sendTo'>;
  private readonly onDeviceFailed: (destination: MidiDestination) => void;

  private readonly sendQueues = new Map<string, Promise<void>>();
  private readonly queueDepths = new Map<string, number>();
  private readonly sendFailures = new Map<string, number>();

  constructor(deps: MidiSendQueueDeps) {
    this.native = deps.native;
    this.onDeviceFailed = deps.onDeviceFailed;
  }

  public async sendToDevice(destination: MidiDestination, bytes: number[]): Promise<boolean> {
    if (destination.id === VIRTUAL_ID) return true;
    const target = resolveTarget(destination);

    const isClock = bytes.length === 1 && bytes[0] >= 0xf8;
    const isNoteOn = (bytes[0] & 0xf0) === 0x90 && (bytes[2] ?? 0) > 0;
    const isNoteOff = (bytes[0] & 0xf0) === 0x80 || ((bytes[0] & 0xf0) === 0x90 && (bytes[2] ?? 0) === 0);
    const depth = this.queueDepths.get(target) ?? 0;

    // Limite absoluto de segurança
    if (depth >= MAX_TOTAL_QUEUE_DEPTH) {
      if (isNoteOff) {
        // Note Off SEMPRE entra (evita nota presa), até um teto de segurança
        if (depth >= MAX_TOTAL_QUEUE_DEPTH + 500) {
          console.warn(`Fila MIDI saturada (${depth}). Forçando reconexão de ${destination.displayName}.`);
          this.onDeviceFailed(destination);
          return false;
        }
      } else {
        // Descarta tudo o mais (inclui Note On — o Panic vai liberar a nota depois)
        return false;
      }
    } else if (depth >= MAX_QUEUE_DEPTH) {
      // Saturação alta: descarta clocks e mensagens não-essenciais
      if (isClock || (depth >= DROP_THRESHOLD && !isNoteOn && !isNoteOff)) {
        return false;
      }
    }

    this.queueDepths.set(target, depth + 1);
    const previous = this.sendQueues.get(target) ?? Promise.resolve();

    let accepted = true;
    const current = previous.then(async () => {
      try {
        await withTimeout(
          this.native.sendTo({ id: target, data: bytes }),
          SEND_TIMEOUT_MS,
          `sendTo(${destination.displayName})`,
        );
        this.sendFailures.delete(destination.id);
      } catch (error) {
        accepted = false;
        const failures = (this.sendFailures.get(destination.id) ?? 0) + 1;
        this.sendFailures.set(destination.id, failures);
        if (failures >= MAX_SEND_FAILURES && destination.id !== BLE_SERVER_ID) {
          console.warn(`Destino ${destination.displayName} não responde:`, error);
          this.onDeviceFailed(destination);
        }
      }
    });

    this.sendQueues.set(target, current);

    current.finally(() => {
      const newDepth = (this.queueDepths.get(target) ?? 1) - 1;
      if (newDepth <= 0) {
        this.queueDepths.delete(target);
        if (this.sendQueues.get(target) === current) {
          this.sendQueues.delete(target);
        }
      } else {
        this.queueDepths.set(target, newDepth);
      }
    });

    await current;
    return accepted;
  }

  public async sendUrgent(destination: MidiDestination, bytes: number[]): Promise<boolean> {
    if (destination.id === VIRTUAL_ID) return true;
    const target = resolveTarget(destination);
    try {
      await withTimeout(
        this.native.sendTo({ id: target, data: bytes }),
        URGENT_TIMEOUT_MS,
        `sendUrgent(${destination.displayName})`,
      );
      this.sendFailures.delete(destination.id);
      return true;
    } catch (error) {
      const failures = (this.sendFailures.get(destination.id) ?? 0) + 1;
      this.sendFailures.set(destination.id, failures);
      if (failures >= MAX_SEND_FAILURES && destination.id !== BLE_SERVER_ID) {
        console.warn(`Destino ${destination.displayName} não responde (urgent):`, error);
        this.onDeviceFailed(destination);
      }
      return false;
    }
  }

  /**
   * Limpa TODO o estado associado ao destino (fila, profundidade, contador de
   * falhas). Chamado quando um device é desconectado (`disconnectOutput`) ou
   * dropado (`dropDevice`).
   *
   * Não cancela promises pendentes — o `.finally` delas já lida bem com
   * entradas ausentes nos mapas (checa `get(...) === current` antes de deletar).
   * Note que o `sendFailures` é indexado por `dest.id` (não por `target`),
   * mantendo consistência com o restante do módulo.
   */
  public reset(destination: MidiDestination): void {
    const target = resolveTarget(destination);
    this.sendQueues.delete(target);
    this.queueDepths.delete(target);
    this.sendFailures.delete(destination.id);
  }
}
