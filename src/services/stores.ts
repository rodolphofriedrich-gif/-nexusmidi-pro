import { clampInt } from '../lib/midiMath';
import { createMemoryStorage, createStore } from '../lib/storeCore';
import type { ArpConfig } from '../lib/arpeggiator';
import { DEFAULT_ARP_CONFIG } from '../lib/arpeggiator';
import type { CcMapping } from '../lib/midiLearn';
import type { ChordId, ScaleId } from '../lib/scales';
import type { VelocityCurve } from '../lib/velocity';
import { DEFAULT_SYNTH_SETTINGS, type SynthSettings } from './synthTypes';

export type Language = 'pt-BR' | 'en';
const CURVES: VelocityCurve[] = ['linear', 'soft', 'hard', 'fixed'];

// ---------------------------------------------------------------- preferências
export interface Prefs {
  paletteId: string;
  velocity: number;
  velocityCurve: VelocityCurve;
  channel: number;
  language: Language;
}

export const DEFAULT_PREFS: Prefs = {
  paletteId: 'custom-blue',
  velocity: 64,
  velocityCurve: 'linear',
  channel: 1,
  language: 'pt-BR',
};

export const prefsStore = createStore<Prefs>('nexusmidi.prefs', DEFAULT_PREFS, {
  // Migra as chaves soltas da versão anterior do app.
  legacy: (storage) => {
    const out: Partial<Prefs> = {};
    const palette = storage.getItem('midi_palette_id');
    const velocity = Number(storage.getItem('midi_velocity'));
    if (palette) out.paletteId = palette;
    if (Number.isFinite(velocity) && velocity > 0) out.velocity = velocity;
    return out;
  },
  sanitize: (p) => ({
    paletteId: typeof p.paletteId === 'string' ? p.paletteId : DEFAULT_PREFS.paletteId,
    velocity: clampInt(p.velocity, 1, 127),
    velocityCurve: CURVES.includes(p.velocityCurve) ? p.velocityCurve : 'linear',
    channel: clampInt(p.channel, 1, 16),
    language: p.language === 'en' ? 'en' : 'pt-BR',
  }),
});

// ------------------------------------------------------------------- sintetizador
// Mesma chave da versão anterior: as configurações do usuário são preservadas.
export const synthSettingsStore = createStore<SynthSettings>('nexus_synth_settings', DEFAULT_SYNTH_SETTINGS);

export interface ChannelState {
  assignments: Record<number, number>; // canal → programa (0–127)
  banks: Record<number, number>; // canal → banco do SF2 (128 = bateria). Ausente = 0
  muted: Record<number, boolean>;
  solo: number | null;
}

const parseJson = <T>(raw: string | null, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const channelsStore = createStore<ChannelState>(
  'nexusmidi.channels',
  { assignments: {}, banks: {}, muted: {}, solo: null },
  {
    legacy: (storage) => ({
      assignments: parseJson<Record<number, number>>(storage.getItem('nexus_sf_channels'), {}),
      muted: parseJson<Record<number, boolean>>(storage.getItem('nexus_sf_mutes'), {}),
    }),
  },
);

// ----------------------------------------------------------------------- ferramentas
export interface ToolsState {
  bpm: number;
  arp: Omit<ArpConfig, 'enabled' | 'bpm'>;
  chord: ChordId;
  chordInversion: number;
  scale: ScaleId;
  scaleRoot: number; // 0 = C … 11 = B
  metronomeVolume: number; // 0–100
  beatsPerBar: number;
  fixedVelocity: number;
}

const ARP_DEFAULTS: ToolsState['arp'] = {
  pattern: DEFAULT_ARP_CONFIG.pattern,
  rate: DEFAULT_ARP_CONFIG.rate,
  octaves: DEFAULT_ARP_CONFIG.octaves,
  gate: DEFAULT_ARP_CONFIG.gate,
  latch: DEFAULT_ARP_CONFIG.latch,
};

export const DEFAULT_TOOLS: ToolsState = {
  bpm: 120,
  arp: ARP_DEFAULTS,
  chord: 'off',
  chordInversion: 0,
  scale: 'chromatic',
  scaleRoot: 0,
  metronomeVolume: 70,
  beatsPerBar: 4,
  fixedVelocity: 100,
};

export const toolsStore = createStore<ToolsState>('nexusmidi.tools', DEFAULT_TOOLS, {
  sanitize: (t) => ({
    ...t,
    bpm: clampInt(t.bpm, 20, 300),
    beatsPerBar: clampInt(t.beatsPerBar, 1, 12),
    metronomeVolume: clampInt(t.metronomeVolume, 0, 100),
    scaleRoot: clampInt(t.scaleRoot, 0, 11),
    chordInversion: clampInt(t.chordInversion, 0, 3),
    fixedVelocity: clampInt(t.fixedVelocity, 1, 127),
    arp: { ...DEFAULT_TOOLS.arp, ...t.arp },
  }),
});

/** Estado de execução (não persiste: o app sempre abre com arpejo, metrônomo e clock desligados). */
export interface RuntimeState {
  arpEnabled: boolean;
  metronomeOn: boolean;
  clockOut: boolean;
}

export const runtimeStore = createStore<RuntimeState>(
  'nexusmidi.runtime',
  { arpEnabled: false, metronomeOn: false, clockOut: false },
  { storage: createMemoryStorage() },
);

export const learnStore = createStore<{ mappings: CcMapping[] }>('nexusmidi.learn', { mappings: [] });
