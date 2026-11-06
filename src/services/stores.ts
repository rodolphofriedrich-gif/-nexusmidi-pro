import { clampInt } from '../lib/midiMath';
import { createMemoryStorage, createStore } from '../lib/storeCore';
import type { ArpConfig } from '../lib/arpeggiator';
import { DEFAULT_ARP_CONFIG } from '../lib/arpeggiator';
import type { CcMapping } from '../lib/midiLearn';
import type { ChordId, ScaleId } from '../lib/scales';
import type { VelocityCurve } from '../lib/velocity';
import { CHANNEL_SETTING_KEYS, DEFAULT_CHANNEL_SETTINGS, DEFAULT_SYNTH_SETTINGS, type ChannelSettings, type SynthSettings } from './synthTypes';

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
    padsChannel: clampInt(p.padsChannel, 1, 16),
    language: p.language === 'en' ? 'en' : 'pt-BR',
    theme: ['dark', 'light', 'system'].includes(p.theme) ? p.theme : 'dark',
    sustain: Boolean(p.sustain),
  }),
});

// ------------------------------------------------------------------- sintetizador
export const synthSettingsStore = createStore<SynthSettings>('nexus_synth_settings', DEFAULT_SYNTH_SETTINGS);

// Configurações GLOBAIS (delay, EQ, compressor, polifonia). Os ajustes de cada canal ficam em `channelSettingsStore`.
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

/** Ajustes independentes por canal MIDI (1–16). Canal sem entrada usa `DEFAULT_CHANNEL_SETTINGS`. */
export interface ChannelSettingsState {
  channels: Record<number, ChannelSettings>;
}

export const channelSettingsOf = (state: ChannelSettingsState, channel: number): ChannelSettings =>
  state.channels[channel] ?? DEFAULT_CHANNEL_SETTINGS;

/** Altera só alguns ajustes de UM canal; os outros canais não são tocados. */
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
    // Migra o que a tela do sintetizador guardava na chave solta da versão anterior.
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
