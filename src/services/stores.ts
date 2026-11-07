import { clampInt } from '../lib/midiMath';import { createMemoryStorage, createStore } from '../lib/storeCore';import type { ArpConfig } from '../lib/arpeggiator';import { DEFAULT_ARP_CONFIG } from '../lib/arpeggiator';import type { CcMapping } from '../lib/midiLearn';
import type { ChordId, ScaleId } from '../lib/scales';
import type { VelocityCurve } from '../lib/velocity';
import { CHANNEL_SETTING_KEYS, DEFAULT_CHANNEL_SETTINGS, DEFAULT_SYNTH_SETTINGS, type ChannelSettings, type SynthSettings } from './synthTypes';
import type { ChordType } from '../constants/chords'; // NOVO IMPORT

export type Language = 'pt-BR' | 'en';
const CURVES: VelocityCurve[] = ['linear', 'soft', 'hard', 'fixed'];

// ---------------------------------------------------------------- preferências
export interface Prefs {
  paletteId: string;
  velocity: number;
  velocityCurve: VelocityCurve;
  channel: number;
  padsChannel: number;
  language: Language;
  theme: 'dark' | 'light' | 'system';
  sustain: boolean;
  wakeLock: boolean; // NOVO
}

export const DEFAULT_PREFS: Prefs = {
  paletteId: 'custom-blue',
  velocity: 64,
  velocityCurve: 'linear',
  channel: 1,
  padsChannel: 10,
  language: 'pt-BR',
  theme: 'dark',
  sustain: false,
  wakeLock: true, // NOVO
};

export const prefsStore = createStore<Prefs>('nexusmidi.prefs', DEFAULT_PREFS, {
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
    padsChannel: clampInt(p.padsChannel, 1, 16),
    language: p.language === 'en' ? 'en' : 'pt-BR',
    theme: ['dark', 'light', 'system'].includes(p.theme) ? p.theme : 'dark',
    sustain: Boolean(p.sustain),
    wakeLock: typeof p.wakeLock === 'boolean' ? p.wakeLock : true, // NOVO
  }),
});

// ------------------------------------------------------------------- sintetizador
export const synthSettingsStore = createStore<SynthSettings>('nexus_synth_settings', DEFAULT_SYNTH_SETTINGS);

export interface ChannelState {
  assignments: Record<number, number>;
  banks: Record<number, number>;
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

export interface ChannelSettingsState {
  channels: Record<number, ChannelSettings>;
}

export const channelSettingsOf = (state: ChannelSettingsState, channel: number): ChannelSettings =>
  state.channels[channel] ?? DEFAULT_CHANNEL_SETTINGS;

export function updateChannelSettings(channel: number, patch: Partial<ChannelSettings>): void {
  channelSettingsStore.set((prev) => ({
    channels: { ...prev.channels, [channel]: { ...channelSettingsOf(prev, channel), ...patch } },
  }));
}

function cleanChannelSettings(raw: unknown): ChannelSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ChannelSettings, unknown>>;
  const out: ChannelSettings = { ...DEFAULT_CHANNEL_SETTINGS };
  for (const key of CHANNEL_SETTING_KEYS) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export const channelSettingsStore = createStore<ChannelSettingsState>(
  'nexusmidi.channelSettings',
  { channels: {} },
  {
    legacy: (storage) => ({
      channels: parseJson<Record<number, ChannelSettings>>(storage.getItem('nexusmidi_channel_settings'), {}),
    }),
    sanitize: (state) => {
      const channels: Record<number, ChannelSettings> = {};
      for (const [key, value] of Object.entries(state.channels ?? {})) {
        const channel = Number(key);
        if (Number.isInteger(channel) && channel >= 1 && channel <= 16) channels[channel] = cleanChannelSettings(value);
      }
      return { channels };
    },
  },
);

// ----------------------------------------------------------------------- ferramentas
export interface ToolsState {
  bpm: number;
  arp: Omit<ArpConfig, 'enabled' | 'bpm'>;
  chord: ChordId;
  chordInversion: number;
  scale: ScaleId;
  scaleRoot: number;
  metronomeVolume: number;
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

// ----------------------------------------------------------------------- PADS
export interface PadData {
  note: number;
  label: string;
  color: string;
  velocity?: number;
  chordType?: ChordType;
  chordIntervals?: number[];
}

const DEFAULT_BANKS: PadData[][] = [
  [
    { note: 36, label: 'Bumbo', color: 'bg-blue-500', velocity: 100 },
    { note: 38, label: 'Caixa', color: 'bg-red-500', velocity: 100 },
    { note: 42, label: 'Chimbal F.', color: 'bg-yellow-500', velocity: 100 },
    { note: 46, label: 'Chimbal A.', color: 'bg-yellow-400', velocity: 100 },
    { note: 41, label: 'Tom Grave', color: 'bg-green-500', velocity: 100 },
    { note: 45, label: 'Tom Médio', color: 'bg-green-400', velocity: 100 },
    { note: 48, label: 'Tom Agudo', color: 'bg-green-300', velocity: 100 },
    { note: 50, label: 'Tom Alto', color: 'bg-teal-500', velocity: 100 },
    { note: 49, label: 'Prato Ataque', color: 'bg-cyan-500', velocity: 100 },
    { note: 51, label: 'Prato Cond.', color: 'bg-cyan-400', velocity: 100 },
    { note: 39, label: 'Palmas', color: 'bg-orange-500', velocity: 100 },
    { note: 56, label: 'Cabaça', color: 'bg-amber-500', velocity: 100 },
    { note: 54, label: 'Pandeiro', color: 'bg-pink-500', velocity: 100 },
    { note: 60, label: 'Bongo A.', color: 'bg-purple-500', velocity: 100 },
    { note: 61, label: 'Bongo G.', color: 'bg-purple-400', velocity: 100 },
    { note: 76, label: 'Bloco Mad.', color: 'bg-stone-500', velocity: 100 },
  ],
  [...Array(16)].map((_, i) => ({ note: 60 + i, label: `Nota ${60 + i}`, color: 'bg-slate-600', velocity: 100 })),
  [...Array(16)].map((_, i) => ({ note: 72 + i, label: `Nota ${72 + i}`, color: 'bg-slate-500', velocity: 100 })),
  [...Array(16)].map((_, i) => ({ note: 84 + i, label: `Nota ${84 + i}`, color: 'bg-slate-400', velocity: 100 })),
];

export interface PadsState {
  banks: PadData[][];
}

export const padsStore = createStore<PadsState>('nexusmidi.pads', { banks: DEFAULT_BANKS }, {
  legacy: (storage) => {
    // Migra a versão antiga do localStorage para a store central
    const saved = storage.getItem('nexus_pads_data_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return { banks: parsed };
      } catch { /* ignora */ }
    }
    return { banks: DEFAULT_BANKS };
  },
  sanitize: (state) => {
    if (!Array.isArray(state.banks) || state.banks.length === 0) return { banks: DEFAULT_BANKS };
    return { banks: state.banks };
  }
});
