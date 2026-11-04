import { clampInt } from '../lib/midiMath';
import type { BackendFactory, SynthBackend, SynthSettings } from './synthTypes';

export interface SynthSnapshot {
  ready: boolean;
  loading: boolean;
  /** Resumo dos SoundFonts ativos: "a.sf2" ou "a.sf2 +2". */
  fileName: string | null;
  /** Quantos SoundFonts estão carregados no motor. */
  bankCount: number;
}

const DRUM_CHANNEL_INDEX = 9; // canal 10 (GM): percussão não deve ser transposta
const DRUM_BANK = 128;

interface ChannelProgram {
  program: number;
  bank: number;
}
const toCc = (percent: number): number => clampInt(Math.round(percent * 1.27), 0, 127);

/**
 * Orquestra o sintetizador: controle de polifonia (com "voice stealing"), transposição segura,
 * aplicação de configurações e recarga de SoundFonts — sem conhecer Web Audio/SpessaSynth.
 */
export class SynthService {
  private backend: SynthBackend | null = null;
  private backendPromise: Promise<SynthBackend> | null = null;
  private snapshot: SynthSnapshot = { ready: false, loading: false, fileName: null, bankCount: 0 };
  private readonly listeners = new Set<() => void>();

  /** `canal:nota` tocada → nota realmente enviada ao motor (mantém a ordem de chegada). */
  private readonly active = new Map<string, number>();
  private readonly channelPrograms = new Map<number, ChannelProgram>();
  /** SoundFonts carregados no motor, em ordem de prioridade (id → nome). */
  private readonly banks = new Map<string, string>();
  private maxPolyphony = 64;
  private transpose = 0;

  constructor(private readonly factory: BackendFactory) {}

  // ---- estado observável (useSyncExternalStore) ----
  getSnapshot = (): SynthSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<SynthSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  getIsReady(): boolean {
    return this.snapshot.ready;
  }

  getCurrentFileName(): string | null {
    return this.snapshot.fileName;
  }

  // ---- ciclo de vida ----
  private ensureBackend(): Promise<SynthBackend> {
    if (this.backend) return Promise.resolve(this.backend);
    if (!this.backendPromise) {
      this.backendPromise = this.factory().then(
        (backend) => {
          this.backend = backend;
          return backend;
        },
        (error: unknown) => {
          this.backendPromise = null; // permite tentar de novo
          throw error;
        },
      );
    }
    return this.backendPromise;
  }

  /** Retoma o AudioContext (navegadores exigem um gesto do usuário). */
  async resume(): Promise<void> {
    await this.backend?.resume();
  }

  /** Resumo exibido na interface: o nome do primeiro SoundFont e quantos mais estão ativos. */
  private bankSummary(): string | null {
    const names = [...this.banks.values()];
    if (names.length === 0) return null;
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
  }

  private publishBanks(patch: Partial<SynthSnapshot> = {}): void {
    this.update({ ready: this.banks.size > 0, fileName: this.bankSummary(), bankCount: this.banks.size, ...patch });
  }

  /** Reaplica os programas por canal (o motor perde a seleção quando os bancos mudam). */
  private reapplyPrograms(backend: SynthBackend): void {
    for (const [channel, { program, bank }] of this.channelPrograms) backend.engine.programChange(channel, program, bank);
  }

  /** Adiciona um SoundFont. Vários podem ficar ativos ao mesmo tempo. */
  async addSoundBank(id: string, buffer: ArrayBuffer, name: string): Promise<boolean> {
    this.update({ loading: true });
    try {
      const backend = await this.ensureBackend();
      this.allNotesOff();
      await backend.engine.addSoundBank(id, buffer, name);
      this.banks.set(id, name);
      this.reapplyPrograms(backend);
      this.publishBanks({ loading: false });
      return true;
    } catch (error) {
      console.error('Erro ao carregar SoundFont:', error);
      this.update({ loading: false });
      return false;
    }
  }

  async removeSoundBank(id: string): Promise<void> {
    if (!this.banks.has(id)) return;
    this.allNotesOff();
    this.banks.delete(id);
    try {
      await this.backend?.engine.removeSoundBank(id);
    } catch (error) {
      console.error('Erro ao remover SoundFont:', error);
    }
    if (this.backend) this.reapplyPrograms(this.backend);
    this.publishBanks();
  }

  /** Define a prioridade dos SoundFonts carregados (o primeiro vence em instrumentos repetidos). */
  setSoundBankOrder(ids: string[]): void {
    const loaded = ids.filter((id) => this.banks.has(id));
    if (loaded.length === 0) return;
    const reordered = new Map<string, string>();
    for (const id of loaded) reordered.set(id, this.banks.get(id) as string);
    for (const [id, name] of this.banks) if (!reordered.has(id)) reordered.set(id, name);
    this.banks.clear();
    for (const [id, name] of reordered) this.banks.set(id, name);
    this.backend?.engine.setSoundBankOrder([...this.banks.keys()]);
    if (this.backend) this.reapplyPrograms(this.backend);
    this.publishBanks();
  }

  dispose(): void {
    this.allNotesOff();
    this.backend?.dispose();
    this.backend = null;
    this.backendPromise = null;
    this.banks.clear();
    this.update({ ready: false, loading: false, fileName: null, bankCount: 0 });
  }

  // ---- notas ----
  private index(channel: number): number {
    return clampInt(channel - 1, 0, 15);
  }

  /** Percussão não é transposta: vale para o canal 10 e para qualquer canal com kit de bateria. */
  private isDrumChannel(ch: number): boolean {
    return ch === DRUM_CHANNEL_INDEX || (this.channelPrograms.get(ch)?.bank ?? 0) >= DRUM_BANK;
  }

  noteOn(note: number, velocity: number, channel = 1): void {
    const engine = this.backend?.engine;
    if (!this.snapshot.ready || !engine) return;
    void this.backend?.resume();

    const ch = this.index(channel);
    const original = clampInt(note, 0, 127);
    const key = `${ch}:${original}`;

    // Retoque da mesma nota: encerra a anterior para não deixar voz presa.
    const previous = this.active.get(key);
    if (previous !== undefined) {
      engine.noteOff(ch, previous);
      this.active.delete(key);
    }

    // Polifonia cheia: "rouba" a voz mais antiga em vez de ignorar a nota nova.
    while (this.active.size >= this.maxPolyphony) {
      const oldest = this.active.entries().next().value as [string, number] | undefined;
      if (!oldest) break;
      const [oldKey, oldSounding] = oldest;
      engine.noteOff(Number(oldKey.split(':')[0]), oldSounding);
      this.active.delete(oldKey);
    }

    const shift = this.isDrumChannel(ch) ? 0 : this.transpose;
    const sounding = clampInt(original + shift, 0, 127);
    this.active.set(key, sounding);
    engine.noteOn(ch, sounding, clampInt(velocity, 1, 127));
  }

  noteOff(note: number, channel = 1): void {
    const engine = this.backend?.engine;
    if (!this.snapshot.ready || !engine) return;
    const ch = this.index(channel);
    const original = clampInt(note, 0, 127);
    const key = `${ch}:${original}`;
    // Usa a nota registrada no noteOn: se a transposição mudou no meio, a nota certa é desligada.
    const sounding = this.active.get(key) ?? original;
    this.active.delete(key);
    engine.noteOff(ch, sounding);
  }

  allNotesOff(): void {
    this.active.clear();
    if (this.snapshot.ready) this.backend?.engine.allSoundOff();
  }

  // ---- mensagens de canal ----
  controlChange(controller: number, value: number, channel = 1): void {
    const engine = this.backend?.engine;
    if (!this.snapshot.ready || !engine) return;
    const ch = this.index(channel);
    if (controller === 120 || controller === 123) {
      for (const key of [...this.active.keys()]) if (key.startsWith(`${ch}:`)) this.active.delete(key);
    }
    engine.controlChange(ch, clampInt(controller, 0, 127), clampInt(value, 0, 127));
  }

  /** `bank`: 0–127 melódico; 128 = kit de bateria. */
  programChange(program: number, channel = 1, bank = 0): void {
    const ch = this.index(channel);
    const p = clampInt(program, 0, 127);
    const b = clampInt(bank, 0, DRUM_BANK);
    this.channelPrograms.set(ch, { program: p, bank: b });
    if (this.snapshot.ready) this.backend?.engine.programChange(ch, p, b);
  }

  /** `value14`: 0–16383 (8192 = centro). */
  pitchBend(value14: number, channel = 1): void {
    if (!this.snapshot.ready) return;
    this.backend?.engine.pitchBend(this.index(channel), clampInt(value14, 0, 16383));
  }

  channelPressure(pressure: number, channel = 1): void {
    if (!this.snapshot.ready) return;
    this.backend?.engine.channelPressure(this.index(channel), clampInt(pressure, 0, 127));
  }

  polyPressure(note: number, pressure: number, channel = 1): void {
    if (!this.snapshot.ready) return;
    this.backend?.engine.polyPressure(this.index(channel), clampInt(note, 0, 127), clampInt(pressure, 0, 127));
  }

  /** Reaplica programas salvos (ex.: restaurados do armazenamento) sem exigir SoundFont carregado. */
  setChannelPrograms(assignments: Record<number, number>, banks: Record<number, number> = {}): void {
    for (const [ch, program] of Object.entries(assignments)) {
      this.programChange(program, Number(ch), banks[Number(ch)] ?? 0);
    }
  }

  // ---- parâmetros (CC) ----
  setMasterVolume(volumePercent: number, channel = 1): void { this.controlChange(7, toCc(volumePercent), channel); }
  setPan(percent: number, channel = 1): void { this.controlChange(10, toCc(percent), channel); }
  setReverb(percent: number, channel = 1): void { this.controlChange(91, toCc(percent), channel); }
  setChorus(percent: number, channel = 1): void { this.controlChange(93, toCc(percent), channel); }
  // Attack/Release/Cutoff/Resonance/Vibrato já usam a escala de CC (0–127) nos sliders.
  setAttack(cc: number, channel = 1): void { this.controlChange(73, cc, channel); }
  setRelease(cc: number, channel = 1): void { this.controlChange(72, cc, channel); }
  setFilterCutoff(cc: number, channel = 1): void { this.controlChange(74, cc, channel); }
  setFilterResonance(cc: number, channel = 1): void { this.controlChange(71, cc, channel); }
  setVibratoDepth(cc: number, channel = 1): void { this.controlChange(1, cc, channel); }

  /** Afinação fina em centésimos (-100…+100) via RPN 1. */
  setFineTuning(cents: number, channel = 1): void {
    const value = clampInt(Math.round(((cents + 100) / 200) * 16383), 0, 16383);
    this.sendRpn(1, (value >> 7) & 0x7f, value & 0x7f, channel);
  }

  /** Alcance do pitch bend em semitons via RPN 0. */
  setPitchBendRange(semitones: number, channel = 1): void {
    this.sendRpn(0, clampInt(semitones, 0, 24), 0, channel);
  }

  private sendRpn(parameter: number, msb: number, lsb: number, channel: number): void {
    this.controlChange(101, 0, channel);
    this.controlChange(100, parameter, channel);
    this.controlChange(6, msb, channel);
    this.controlChange(38, lsb, channel);
    this.controlChange(101, 127, channel); // encerra o RPN para não capturar CCs seguintes
    this.controlChange(100, 127, channel);
  }

  // ---- efeitos globais ----
  setDelay(timeMs: number, feedback: number, mix: number): void { this.backend?.fx.setDelay(timeMs, feedback, mix); }
  setEQ(low: number, mid: number, high: number): void { this.backend?.fx.setEQ(low, mid, high); }
  setCompressor(threshold: number, ratio: number): void { this.backend?.fx.setCompressor(threshold, ratio); }
  setTranspose(semitones: number): void { this.transpose = clampInt(semitones, -24, 24); }
  setMaxPolyphony(max: number): void { this.maxPolyphony = clampInt(max, 1, 256); }

  /**
   * Aplica as configurações do painel. Com `previous`, só reenvia o que mudou
   * (arrastar um slider não gera 144 mensagens por movimento).
   */
  applySettings(next: SynthSettings, previous?: SynthSettings): void {
    if (!this.snapshot.ready) return;
    const changed = (...keys: Array<keyof SynthSettings>): boolean =>
      !previous || keys.some((k) => previous[k] !== next[k]);

    if (changed('transpose')) this.setTranspose(next.transpose);
    if (changed('maxPolyphony')) this.setMaxPolyphony(next.maxPolyphony);
    if (changed('delayTime', 'delayFeedback', 'delayMix')) this.setDelay(next.delayTime, next.delayFeedback, next.delayMix);
    if (changed('eqLow', 'eqMid', 'eqHigh')) this.setEQ(next.eqLow, next.eqMid, next.eqHigh);
    if (changed('compThreshold')) this.setCompressor(next.compThreshold, 4);

    for (let ch = 1; ch <= 16; ch++) {
      if (changed('reverb')) this.setReverb(next.reverb, ch);
      if (changed('chorus')) this.setChorus(next.chorus, ch);
      if (changed('attack')) this.setAttack(next.attack, ch);
      if (changed('release')) this.setRelease(next.release, ch);
      if (changed('cutoff')) this.setFilterCutoff(next.cutoff, ch);
      if (changed('resonance')) this.setFilterResonance(next.resonance, ch);
      if (changed('vibrato')) this.setVibratoDepth(next.vibrato, ch);
      if (changed('fineTune')) this.setFineTuning(next.fineTune, ch);
      if (changed('pitchBendRange')) this.setPitchBendRange(next.pitchBendRange, ch);
    }
  }

  /** Mute/solo por canal usando o volume (CC 7). */
  applyMix(volumePercent: number, muted: Record<number, boolean>, solo: number | null): void {
    if (!this.snapshot.ready) return;
    for (let ch = 1; ch <= 16; ch++) {
      const silenced = muted[ch] === true || (solo !== null && solo !== ch);
      this.setMasterVolume(silenced ? 0 : volumePercent, ch);
    }
  }
}

/** Instância usada pelo app. O backend real (SpessaSynth) só é carregado no primeiro uso. */
export const synthService = new SynthService(async () => {
  const { createWebAudioBackend } = await import('./audio/spessaEngine');
  return createWebAudioBackend();
});
