import { MidiLearn, type LearnTarget } from '../lib/midiLearn';
import { midiService } from './midiService';
import { learnStore, prefsStore, synthSettingsStore, toolsStore, updateChannelSettings } from './stores';

const percent = (v: number): number => Math.round((v / 127) * 100);

/** Os knobs do controlador mexem no canal MIDI ativo; os outros canais ficam como estão. */
const onActiveChannel = (patch: Parameters<typeof updateChannelSettings>[1]): void =>
  updateChannelSettings(prefsStore.get().channel, patch);

/** Parâmetros que um controlador físico pode assumir. O texto exibido vem do i18n pelo `id`. */
export const LEARN_TARGETS: LearnTarget[] = [
  { id: 'synth.volume', label: 'Volume do sintetizador', apply: (v) => onActiveChannel({ volume: percent(v) }) },
  { id: 'synth.reverb', label: 'Reverb', apply: (v) => onActiveChannel({ reverb: percent(v) }) },
  { id: 'synth.chorus', label: 'Chorus', apply: (v) => onActiveChannel({ chorus: percent(v) }) },
  { id: 'synth.cutoff', label: 'Filtro (cutoff)', apply: (v) => onActiveChannel({ cutoff: v }) },
  { id: 'synth.resonance', label: 'Ressonância', apply: (v) => onActiveChannel({ resonance: v }) },
  { id: 'synth.attack', label: 'Attack', apply: (v) => onActiveChannel({ attack: v }) },
  { id: 'synth.release', label: 'Release', apply: (v) => onActiveChannel({ release: v }) },
  { id: 'synth.delayMix', label: 'Delay (mix)', apply: (v) => synthSettingsStore.set({ delayMix: percent(v) }) },
  { id: 'tools.bpm', label: 'BPM (60–240)', apply: (v) => toolsStore.set({ bpm: Math.round(60 + (v / 127) * 180) }) },
];

export const midiLearn = new MidiLearn(LEARN_TARGETS, learnStore.get().mappings, (mappings) =>
  learnStore.set({ mappings }),
);
midiService.setLearn(midiLearn);
