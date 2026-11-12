import { WorkletSynthesizer } from 'spessasynth_lib';
import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import type { SynthBackend, SynthEngine } from '../synthTypes';
import { FxChain } from './fxChain';
import { recordAudioDiagnostic, startAudioDiagnostic } from './audioDiagnostics';

/**
 * Superfície do WorkletSynthesizer que o app usa. Declarada aqui para que mudanças de tipagem
 * entre versões menores da biblioteca não quebrem o build — e para tolerar métodos ausentes.
 */
interface SpessaSynthLike {
  connect(node: AudioNode): unknown;
  noteOn(channel: number, note: number, velocity: number): void;
  noteOff(channel: number, note: number): void;
  controllerChange(channel: number, controller: number, value: number): void;
  programChange(channel: number, program: number): void;
  /** Marca o canal como percussão (ou melódico). */
  setDrums?(channel: number, isDrum: boolean): void;
  pitchWheel?(channel: number, value14: number): void;
  channelPressure?(channel: number, pressure: number): void;
  polyPressure?(channel: number, note: number, pressure: number): void;
  stopAll?(force?: boolean): void;
  destroy?(): void;
  isReady?: Promise<unknown>;
  soundBankManager: {
    addSoundBank(buffer: ArrayBuffer, id: string, bankOffset?: number): unknown;
    deleteSoundBank?(id: string): unknown;
    /** Reordena os bancos (o primeiro da lista tem a maior prioridade). */
    rearrangeSoundBanks?(ids: string[]): unknown;
  };
}

const DEFAULT_DRUM_CHANNEL = 9; // canal 10 (GM) começa como percussão

class SpessaEngine implements SynthEngine {
  /** Canais atualmente em modo percussão (kits de bateria). */
  private readonly drumChannels = new Set<number>([DEFAULT_DRUM_CHANNEL]);

  constructor(private readonly synth: SpessaSynthLike) {}

  noteOn(channel: number, note: number, velocity: number): void {
    this.synth.noteOn(channel, note, velocity);
  }
  noteOff(channel: number, note: number): void {
    this.synth.noteOff(channel, note);
  }
  controlChange(channel: number, controller: number, value: number): void {
    this.synth.controllerChange(channel, controller, value);
  }
  programChange(channel: number, program: number, bank = 0): void {
    if (bank >= 128) {
      // Kit de bateria: o canal vira percussão e o programa escolhe o kit.
      this.synth.setDrums?.(channel, true);
      this.drumChannels.add(channel);
    } else {
      if (this.drumChannels.has(channel) && channel !== DEFAULT_DRUM_CHANNEL) {
        this.synth.setDrums?.(channel, false);
        this.drumChannels.delete(channel);
      }
      // Seleção de banco (CC 0 / CC 32) antes do program change. Em percussão não se aplica.
      if (!this.drumChannels.has(channel)) {
        this.synth.controllerChange(channel, 0, Math.min(bank, 127));
        this.synth.controllerChange(channel, 32, 0);
      }
    }
    this.synth.programChange(channel, program);
  }
  pitchBend(channel: number, value14: number): void {
    this.synth.pitchWheel?.(channel, value14);
  }
  channelPressure(channel: number, pressure: number): void {
    this.synth.channelPressure?.(channel, pressure);
  }
  polyPressure(channel: number, note: number, pressure: number): void {
    this.synth.polyPressure?.(channel, note, pressure);
  }
  allSoundOff(): void {
    this.synth.stopAll?.(true);
  }

  async addSoundBank(id: string, buffer: ArrayBuffer, _name: string): Promise<void> {
    await this.synth.soundBankManager.addSoundBank(buffer, id);
  }

  async removeSoundBank(id: string): Promise<void> {
    try {
      await this.synth.soundBankManager.deleteSoundBank?.(id);
    } catch {
      /* o banco já pode ter sido removido */
    }
  }

  setSoundBankOrder(ids: string[]): void {
    if (ids.length > 1) this.synth.soundBankManager.rearrangeSoundBanks?.(ids);
  }

  dispose(): void {
    try {
      this.synth.destroy?.();
    } catch {
      /* ignora */
    }
  }
}

/** Cria o backend real: AudioContext + SpessaSynth + cadeia de efeitos. Carregado sob demanda. */
export async function createWebAudioBackend(): Promise<SynthBackend> {
  const Ctor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  // Sem sampleRate fixo: usa a taxa nativa do aparelho, evitando reamostragem (mais latência/CPU).
  const finishContext = startAudioDiagnostic('audioContext.create');
  const ctx = new Ctor({ latencyHint: 'interactive' });
  finishContext();
  recordAudioDiagnostic('audioContext.created', {
    state: ctx.state,
    sampleRate: ctx.sampleRate,
    baseLatency: ctx.baseLatency ?? null,
    outputLatency: 'outputLatency' in ctx ? (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? null : null,
  });
  ctx.addEventListener('statechange', () => recordAudioDiagnostic('audioContext.statechange', { state: ctx.state }));
  // Carrega o worklet com o contexto ainda suspenso. No Chromium, retomar o
  // AudioContext antes de addModule() pode fazer o currentTime inicial do
  // AudioWorklet ficar defasado permanentemente (SpessaSynth issue #39).
  const finishWorkletModule = startAudioDiagnostic('audioWorklet.addModule');
  await ctx.audioWorklet.addModule(workletUrl);
  finishWorkletModule();

  // Workaround documentado pelo mantenedor: dar tempo ao Chromium para
  // estabilizar o relógio do AudioWorklet antes de criar o sintetizador.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
  recordAudioDiagnostic('audioWorklet.stabilized', { state: ctx.state, currentTime: ctx.currentTime });

  // Retoma somente depois de o módulo estar carregado e o intervalo de
  // estabilização ter passado. Se o navegador exigir gesto do usuário,
  // o resume() chamado no primeiro noteOn continuará tentando novamente.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  const finishSynth = startAudioDiagnostic('spessaSynth.initialize');
  const synth = new WorkletSynthesizer(ctx) as unknown as SpessaSynthLike;
  if (synth.isReady) await synth.isReady;
  finishSynth();
  recordAudioDiagnostic('spessaSynth.ready', { state: ctx.state, currentTime: ctx.currentTime });

  const finishFx = startAudioDiagnostic('fxChain.create');
  const fx = new FxChain(ctx, ctx.destination);
  finishFx();
  synth.connect(fx.input);

  const engine = new SpessaEngine(synth);
  return {
    engine,
    fx,
    resume: async () => {
      if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    },
    dispose: () => {
      recordAudioDiagnostic('audioBackend.dispose', { state: ctx.state });
      engine.dispose();
      fx.dispose();
      void ctx.close().catch(() => undefined);
    },
  };
}
