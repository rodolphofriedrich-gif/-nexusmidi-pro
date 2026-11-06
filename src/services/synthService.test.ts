import { beforeEach, describe, expect, it } from 'vitest';
import { SynthService } from './synthService';
import { DEFAULT_CHANNEL_SETTINGS, DEFAULT_SYNTH_SETTINGS, type SynthBackend } from './synthTypes';

function makeBackend() {
  const calls: string[] = [];
  const backend: SynthBackend = {
    engine: {
      noteOn: (c, n, v) => calls.push(`on:${c}:${n}:${v}`),
      noteOff: (c, n) => calls.push(`off:${c}:${n}`),
      controlChange: (c, cc, v) => calls.push(`cc:${c}:${cc}:${v}`),
      programChange: (c, p, b) => calls.push(b ? `pc:${c}:${p}:b${b}` : `pc:${c}:${p}`),
      pitchBend: (c, v) => calls.push(`pb:${c}:${v}`),
      channelPressure: (c, v) => calls.push(`cp:${c}:${v}`),
      polyPressure: (c, n, v) => calls.push(`pp:${c}:${n}:${v}`),
      allSoundOff: () => calls.push('panic'),
      addSoundBank: async (id) => void calls.push(`add:${id}`),
      removeSoundBank: async (id) => void calls.push(`remove:${id}`),
      setSoundBankOrder: (ids) => void calls.push(`order:${ids.join(',')}`),
      dispose: () => calls.push('dispose'),
    },
    fx: {
      setDelay: (t, f, m) => calls.push(`delay:${t}:${f}:${m}`),
      setEQ: (l, m, h) => calls.push(`eq:${l}:${m}:${h}`),
      setCompressor: (t, r) => calls.push(`comp:${t}:${r}`),
    },
    resume: async () => undefined,
    dispose: () => calls.push('backend-dispose'),
  };
  return { backend, calls };
}

describe('SynthService', () => {
  let calls: string[];
  let synth: SynthService;
  let factoryCalls: number;

  beforeEach(async () => {
    const made = makeBackend();
    calls = made.calls;
    factoryCalls = 0;
    synth = new SynthService(async () => {
      factoryCalls++;
      return made.backend;
    });
    await synth.addSoundBank('a', new ArrayBuffer(8), 'a.sf2');
    calls.length = 0;
  });

  it('ignora notas até um SoundFont carregar', async () => {
    const made = makeBackend();
    const cold = new SynthService(async () => made.backend);
    cold.noteOn(60, 100);
    expect(made.calls).toEqual([]);
  });

  it('publica o estado (ready, fileName) para a interface', () => {
    expect(synth.getSnapshot()).toEqual({ ready: true, loading: false, fileName: 'a.sf2', bankCount: 1 });
  });

  it('cria o backend uma única vez, mesmo carregando vários SoundFonts', async () => {
    await synth.addSoundBank('b', new ArrayBuffer(8), 'b.sf2');
    expect(factoryCalls).toBe(1);
    expect(synth.getSnapshot()).toMatchObject({ ready: true, bankCount: 2, fileName: 'a.sf2 +1' });
  });

  it('remover o último SoundFont deixa o sintetizador sem som (ready=false)', async () => {
    await synth.removeSoundBank('a');
    expect(synth.getSnapshot()).toMatchObject({ ready: false, bankCount: 0, fileName: null });
    expect(calls).toContain('remove:a');
  });

  it('a ordem de prioridade muda o resumo e é repassada ao motor', async () => {
    await synth.addSoundBank('b', new ArrayBuffer(8), 'b.sf2');
    calls.length = 0;
    synth.setSoundBankOrder(['b', 'a']);
    expect(calls).toContain('order:b,a');
    expect(synth.getCurrentFileName()).toBe('b.sf2 +1');
  });

  it('reaplica os programas por canal ao mudar os SoundFonts', async () => {
    synth.programChange(24, 3);
    calls.length = 0;
    await synth.addSoundBank('b', new ArrayBuffer(8), 'b.sf2');
    expect(calls).toContain('pc:2:24');
  });

  it('bateria (banco 128) é enviada com o banco e não é transposta em qualquer canal', () => {
    synth.programChange(0, 4, 128);
    expect(calls).toContain('pc:3:0:b128');
    synth.setTranspose(5);
    calls.length = 0;
    synth.noteOn(36, 100, 4);
    expect(calls).toEqual(['on:3:36:100']);
  });

  it('falha de carregamento não derruba o app e libera o estado de loading', async () => {
    const failing = new SynthService(async () => {
      throw new Error('sem áudio');
    });
    expect(await failing.addSoundBank('x', new ArrayBuffer(1), 'x.sf2')).toBe(false);
    expect(failing.getSnapshot().loading).toBe(false);
    expect(failing.getIsReady()).toBe(false);
  });

  it('toca e solta com os canais em base 0 no motor', () => {
    synth.noteOn(60, 100, 1);
    synth.noteOff(60, 1);
    expect(calls).toEqual(['on:0:60:100', 'off:0:60']);
  });

  it('transpõe, mas desliga a nota que realmente ligou se a transposição mudar', () => {
    synth.setTranspose(2);
    synth.noteOn(60, 100);
    synth.setTranspose(-5);
    synth.noteOff(60);
    expect(calls).toEqual(['on:0:62:100', 'off:0:62']);
  });

  it('não transpõe a percussão (canal 10)', () => {
    synth.setTranspose(5);
    synth.noteOn(36, 100, 10);
    expect(calls).toEqual(['on:9:36:100']);
  });

  it('polifonia cheia: encerra a nota MAIS ANTIGA e toca a nova', () => {
    synth.setMaxPolyphony(2);
    synth.noteOn(60, 100);
    synth.noteOn(62, 100);
    synth.noteOn(64, 100);
    expect(calls).toEqual(['on:0:60:100', 'on:0:62:100', 'off:0:60', 'on:0:64:100']);
  });

  it('retocar a mesma nota encerra a anterior (sem voz presa)', () => {
    synth.noteOn(60, 100);
    synth.noteOn(60, 100);
    expect(calls).toEqual(['on:0:60:100', 'off:0:60', 'on:0:60:100']);
  });

  it('allNotesOff limpa o controle de notas ativas', () => {
    synth.setMaxPolyphony(1);
    synth.noteOn(60, 100);
    synth.allNotesOff();
    calls.length = 0;
    synth.noteOn(62, 100);
    expect(calls).toEqual(['on:0:62:100']); // não "rouba" uma voz que já foi limpa
  });

  it('CC 123 limpa só as notas do canal', () => {
    synth.setMaxPolyphony(2);
    synth.noteOn(60, 100, 1);
    synth.noteOn(62, 100, 2);
    synth.controlChange(123, 0, 1);
    calls.length = 0;
    synth.noteOn(64, 100, 1); // cabe: só havia a nota do canal 2
    expect(calls).toEqual(['on:0:64:100']);
  });

  it('repassa pitch bend, pressure e poly pressure', () => {
    synth.pitchBend(8192, 1);
    synth.channelPressure(50, 2);
    synth.polyPressure(60, 40, 3);
    expect(calls).toEqual(['pb:0:8192', 'cp:1:50', 'pp:2:60:40']);
  });

  it('limita valores fora da faixa', () => {
    synth.noteOn(300, 500, 99);
    synth.pitchBend(99999);
    expect(calls).toEqual(['on:15:127:127', 'pb:0:16383']);
  });

  it('Attack/Cutoff usam a escala de CC (0–127) sem multiplicar', () => {
    synth.setFilterCutoff(127, 1);
    synth.setAttack(64, 1);
    expect(calls).toEqual(['cc:0:74:127', 'cc:0:73:64']);
  });

  it('Reverb/Volume convertem de porcentagem para CC', () => {
    synth.setReverb(100, 1);
    synth.setMasterVolume(50, 1);
    expect(calls).toEqual(['cc:0:91:127', 'cc:0:7:64']);
  });

  it('applySettings com "previous" só reenvia o que mudou', () => {
    synth.applySettings({ ...DEFAULT_SYNTH_SETTINGS, reverb: 80 }, DEFAULT_SYNTH_SETTINGS);
    const ccs = calls.filter((c) => c.startsWith('cc:'));
    expect(ccs).toHaveLength(16); // só o reverb, nos 16 canais
    expect(ccs.every((c) => c.includes(':91:'))).toBe(true);
  });

  it('applySettings sem "previous" aplica tudo (efeitos globais + CCs)', () => {
    synth.applySettings(DEFAULT_SYNTH_SETTINGS);
    expect(calls.some((c) => c.startsWith('delay:'))).toBe(true);
    expect(calls.some((c) => c.startsWith('eq:'))).toBe(true);
    expect(calls.some((c) => c.startsWith('comp:'))).toBe(true);
  });

  it('fine tuning e pitch bend range enviam RPN e fecham o RPN', () => {
    synth.setPitchBendRange(12, 1);
    expect(calls).toEqual(['cc:0:101:0', 'cc:0:100:0', 'cc:0:6:12', 'cc:0:38:0', 'cc:0:101:127', 'cc:0:100:127']);
  });

  it('applyMix: mute e solo', () => {
    synth.applyMix(100, { 2: true }, null);
    expect(calls.find((c) => c === 'cc:1:7:0')).toBeDefined();
    expect(calls.find((c) => c === 'cc:0:7:127')).toBeDefined();
    calls.length = 0;
    synth.applyMix(100, {}, 3);
    expect(calls.filter((c) => c === 'cc:2:7:127')).toHaveLength(1);
    expect(calls.filter((c) => c === 'cc:0:7:0')).toHaveLength(1);
  });

  it('applyChannelSettings: o ajuste de um canal não toca nos outros', () => {
    synth.applyChannelSettings(2, { ...DEFAULT_CHANNEL_SETTINGS, reverb: 80 }, DEFAULT_CHANNEL_SETTINGS);
    expect(calls).toEqual(['cc:1:91:102']);
  });

  it('a transposição é independente por canal', () => {
    synth.applyChannelSettings(1, { ...DEFAULT_CHANNEL_SETTINGS, transpose: 5 }, DEFAULT_CHANNEL_SETTINGS);
    synth.noteOn(60, 100, 1);
    synth.noteOn(60, 100, 2);
    expect(calls).toEqual(['on:0:65:100', 'on:1:60:100']);
  });

  it('applyMix aceita um volume diferente para cada canal', () => {
    synth.applyMix((ch) => (ch === 2 ? 50 : 100), {}, null);
    expect(calls).toContain('cc:1:7:64');
    expect(calls).toContain('cc:0:7:127');
  });

  it('applyChannelMix mexe só no canal pedido e respeita mute/solo', () => {
    synth.applyChannelMix(3, 80, {}, null);
    expect(calls).toEqual(['cc:2:7:102']);
    calls.length = 0;
    synth.applyChannelMix(3, 80, { 3: true }, null);
    expect(calls).toEqual(['cc:2:7:0']);
  });

  it('dispose libera o backend', () => {
    synth.dispose();
    expect(calls).toContain('backend-dispose');
    expect(synth.getIsReady()).toBe(false);
  });
});
