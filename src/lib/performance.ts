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

interface SoundingEntry {
  notes: number[];
  viaArp: boolean;
  channel: number;
  sourceId?: string;
}

export class PerformanceEngine {
  private readonly sounding = new Map<string, SoundingEntry>();
  private arpChannel = 1;

  constructor(private readonly deps: PerformanceDeps) {}

  /**
   * @param sourceId Identificador do "toque" de origem (ex: 'keyboard', 'pad-3').
   *                 Permite rastrear a mesma nota em fontes diferentes sem colisão.
   *                 Se omitido, cai no comportamento antigo (chave = canal:nota).
   */
  noteOn(channel: number, note: number, baseVelocity: number, sourceId?: string): void {
    const s = this.deps.getSettings();
    const velocity = applyVelocityCurve(baseVelocity, s.velocityCurve, s.fixedVelocity);
    const key = this.makeKey(channel, note, sourceId);
    this.releaseKey(key);

    const isDrum = channel === DRUM_CHANNEL;
    const base = isDrum ? note : quantizeToScale(note, s.scaleRoot, s.scale);
    const notes = isDrum ? [base] : buildChord(base, s.chord, s.chordInversion);
    const viaArp = !isDrum && this.deps.arp.getConfig().enabled;

    this.sounding.set(key, { notes, viaArp, channel, sourceId });

    if (viaArp) {
      this.arpChannel = channel;
      for (const n of notes) this.deps.arp.hold(n, velocity);
      return;
    }
    for (const n of notes) this.deps.send(channel, n, velocity, true);
  }

  /**
   * Solta a nota. Estratégia em 3 etapas:
   *   1. Match EXATO (`sourceId:canal:nota`): caso normal.
   *   2. Match por `sourceId + nota` (qualquer canal): canal mudou, mas a fonte é a mesma.
   *   3. Fallback (qualquer source, qualquer canal): proteção contra nota presa.
   */
  noteOff(channel: number, note: number, sourceId?: string): void {
    const exactKey = this.makeKey(channel, note, sourceId);
    if (this.sounding.has(exactKey)) {
      this.releaseKey(exactKey);
      return;
    }

    // 2. Mesmo sourceId, qualquer canal (canal mudou durante o toque)
    for (const [key, entry] of this.sounding) {
      if (entry.sourceId === sourceId && key.endsWith(`:${note}`)) {
        this.releaseKey(key);
        return;
      }
    }

    // 3. Último recurso (mesma nota em qualquer fonte/canal)
    for (const key of this.sounding.keys()) {
      if (key.endsWith(`:${note}`)) {
        this.releaseKey(key);
        return;
      }
    }
  }

  releaseAll(): void {
    for (const key of [...this.sounding.keys()]) this.releaseKey(key);
    this.deps.arp.stop();
  }

  getArpChannel(): number {
    return this.arpChannel;
  }

  private makeKey(channel: number, note: number, sourceId?: string): string {
    return `${sourceId ?? '_'}:${channel}:${note}`;
  }

  private releaseKey(key: string): void {
    const entry = this.sounding.get(key);
    if (!entry) return;
    this.sounding.delete(key);

    if (entry.viaArp) {
      for (const n of entry.notes) this.deps.arp.release(n);
      return;
    }
    for (const n of entry.notes) this.deps.send(entry.channel, n, 0, false);
  }
}
