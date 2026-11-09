import { Arpeggiator } from './arpeggiator';
import { applyVelocityCurve, type VelocityCurve } from './velocity';
import { buildChord, quantizeToScale, type ChordId, type ScaleId } from './scales';

const DRUM_CHANNEL = 10;

export interface PerformanceSettings {
  velocityCurve: VelocityCurve;
  fixedVelocity: number;
  scale: ScaleId;
  scaleRoot: number;
  chord: ChordId;
  chordInversion: number;
}

interface PerformanceDeps {
  send: (channel: number, note: number, velocity: number, on: boolean) => void;
  getSettings: () => PerformanceSettings;
  arp: Arpeggiator;
}

/**
 * Camada entre o teclado/pads e o MIDI: curva de velocity → escala → acorde → arpejo.
 * Guarda as notas efetivamente enviadas por tecla, então soltar uma tecla sempre desliga
 * exatamente o que ela ligou — mesmo que escala/acorde/canal tenham mudado nesse meio-tempo.
 */
export class PerformanceEngine {
  // Chave = `${channel}:${note}`. Guarda o canal original para o NoteOff usar o correto.
  private readonly sounding = new Map<string, { notes: number[]; viaArp: boolean; channel: number }>();
  private arpChannel = 1;

  constructor(private readonly deps: PerformanceDeps) {}

  noteOn(channel: number, note: number, baseVelocity: number): void {
    const s = this.deps.getSettings();
    const velocity = applyVelocityCurve(baseVelocity, s.velocityCurve, s.fixedVelocity);
    const key = `${channel}:${note}`;
    this.releaseKey(key);

    // Percussão (canal 10) não passa por escala/acorde/arpejo.
    const isDrum = channel === DRUM_CHANNEL;
    const base = isDrum ? note : quantizeToScale(note, s.scaleRoot, s.scale);
    const notes = isDrum ? [base] : buildChord(base, s.chord, s.chordInversion);

    const viaArp = !isDrum && this.deps.arp.getConfig().enabled;
    
    // Salva o canal original junto para o Note Off usar o correto
    this.sounding.set(key, { notes, viaArp, channel });

    if (viaArp) {
      this.arpChannel = channel;
      for (const n of notes) this.deps.arp.hold(n, velocity);
      return;
    }
    for (const n of notes) this.deps.send(channel, n, velocity, true);
  }

  /**
   * Solta a nota. Estratégia em duas etapas:
   *   1. Match EXATO (`canal:nota`): o caso normal (não mudou de canal).
   *   2. Fallback (qualquer canal): a UI pode ter mudado de canal no meio do toque,
   *      então soltamos a nota que estiver em qualquer canal para não ficar presa.
   *
   * Se a mesma nota está em 2 canais diferentes (ex.: C4 no 1 e no 2), o match exato
   * garante que só a do canal tocado seja solta.
   */
  noteOff(channel: number, note: number): void {
    const exactKey = `${channel}:${note}`;
    if (this.sounding.has(exactKey)) {
      this.releaseKey(exactKey);
      return;
    }
    // Fallback: canal mudou durante o toque. Solta qualquer nota correspondente.
    for (const key of this.sounding.keys()) {
      if (key.endsWith(`:${note}`)) {
        this.releaseKey(key);
        return;
      }
    }
  }

  /** Solta tudo (troca de aba, perda de foco, pânico). */
  releaseAll(): void {
    for (const key of [...this.sounding.keys()]) this.releaseKey(key);
    this.deps.arp.stop();
  }

  /** Canal usado pelas notas geradas pelo arpejador. */
  getArpChannel(): number {
    return this.arpChannel;
  }

  private releaseKey(key: string): void {
    const entry = this.sounding.get(key);
    if (!entry) return;
    this.sounding.delete(key);
    
    if (entry.viaArp) {
      for (const n of entry.notes) this.deps.arp.release(n);
      return;
    }
    // Usa o `channel` que foi salvo no NoteOn, não o que veio pelo NoteOff
    for (const n of entry.notes) this.deps.send(entry.channel, n, 0, false);
  }
}
