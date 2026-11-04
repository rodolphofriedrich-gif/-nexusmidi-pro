import { useEffect, useMemo, useState } from 'react';
import { Play, Save, Trash2, ShieldAlert, RotateCcw } from 'lucide-react';
import { tr } from '../i18n';
import { uid } from '../lib/id';
import { midiManager } from '../services/midiService';
import { useStore } from '../hooks/useStore';
import { prefsStore } from '../services/stores';
import { StudioFader } from './StudioFader';

type MidiPreset = {
  id: string;
  name: string;
  modWheel: number;
  volume: number;
  expression: number;
  pan: number;
  sustain: boolean;
  program: number;
  pitchBend: number;
  pressure: number;
};

const PRESETS_KEY = 'nexusmidi_controls_presets_v1';
const STATE_KEY = 'nexusmidi_mixer_state';
const DEFAULT_CONTROLS = {
  modWheel: 0,
  volume: 100,
  expression: 127,
  pan: 64,
  program: 1,
  pitchBend: 8192,
  pressure: 0,
  reverb: 40,
  chorus: 15,
  cutoff: 127,
  resonance: 64,
};

interface Props {
  channel: number;
  isConnected: boolean;
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

function loadPresets(): MidiPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
  } catch {
    return [];
  }
}

const errorText = (error: unknown): string => (error instanceof Error && error.message ? error.message : tr('erro desconhecido'));

export function MidiControlsScreen({ channel, isConnected, onStatus }: Props) {
  const prefs = useStore(prefsStore);

  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      return saved ? { ...DEFAULT_CONTROLS, ...JSON.parse(saved) } : DEFAULT_CONTROLS;
    } catch {
      return DEFAULT_CONTROLS;
    }
  });

  const { modWheel, volume, expression, pan, program, pitchBend, reverb, chorus, cutoff, resonance } = state;

  const updateState = <K extends keyof typeof state>(key: K, value: typeof state[K]) => 
    setState((s) => ({ ...s, [key]: value }));

  const [presetName, setPresetName] = useState(() => tr('Meu preset'));
  const [presets, setPresets] = useState<MidiPreset[]>(loadPresets);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* */ }
  }, [state]);

  useEffect(() => {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* */ }
  }, [presets]);

  const resetControls = () => {
    setState(DEFAULT_CONTROLS);
    onStatus(tr('Controles redefinidos localmente.'), 'info');
  };

  useEffect(() => {
    const handleReset = () => resetControls();
    window.addEventListener('resetMixer', handleReset);
    return () => window.removeEventListener('resetMixer', handleReset);
  }, []);

  const controls = useMemo(() => state, [state]);

  const sendAction = async (action: () => Promise<unknown>, successMessage: string) => {
    if (!isConnected) {
      onStatus(tr('Conecte um destino MIDI ou carregue um SoundFont antes de enviar controles.'), 'warn');
      return;
    }
    try {
      await action();
      onStatus(successMessage, 'success');
    } catch (error) {
      onStatus(tr('Falha ao enviar MIDI: {message}', { message: errorText(error) }), 'error');
    }
  };

  const sendCC = (controller: number, value: number, label: string) =>
    sendAction(() => midiManager.sendControlChange(channel, controller, value), tr('{label}: {value} • Canal {channel}', { label, value, channel }));

  const applyPreset = async (preset: MidiPreset) => {
    if (!isConnected) {
      onStatus(tr('Conecte um destino MIDI ou carregue um SoundFont antes de aplicar um preset.'), 'warn');
      return;
    }
    setBusy(true);
    try {
      setState((s) => ({ ...s, ...preset }));
      await midiManager.sendControlChange(channel, 1, preset.modWheel);
      await midiManager.sendControlChange(channel, 7, preset.volume);
      await midiManager.sendControlChange(channel, 11, preset.expression);
      await midiManager.sendControlChange(channel, 10, preset.pan);
      await midiManager.sendControlChange(channel, 64, preset.sustain ? 127 : 0);
      await midiManager.sendProgramChange(channel, preset.program - 1);
      await midiManager.sendPitchBend(channel, preset.pitchBend);
      await midiManager.sendChannelPressure(channel, preset.pressure);
      
      onStatus(tr('Preset “{name}” aplicado no canal {channel}.', { name: preset.name, channel }), 'success');
    } catch (error) {
      onStatus(tr('Não foi possível aplicar o preset: {message}', { message: errorText(error) }), 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { onStatus(tr('Digite um nome para o preset.'), 'warn'); return; }
    const preset: MidiPreset = { id: uid('preset-'), name, sustain: prefs.sustain, ...controls };
    setPresets((current) => [preset, ...current]);
    onStatus(tr('Preset “{name}” salvo neste dispositivo.', { name }), 'success');
  };

  const toggleSustain = () => {
    const next = !prefs.sustain;
    prefsStore.set({ sustain: next });
    void sendCC(64, next ? 127 : 0, next ? tr('Sustain ligado') : tr('Sustain desligado'));
  };

  const panic = async () => {
    if (!isConnected) { onStatus(tr('Conecte um destino MIDI ou carregue um SoundFont antes de executar o MIDI Panic.'), 'warn'); return; }
    setBusy(true);
    try {
      await midiManager.sendPanic([channel]);
      prefsStore.set({ sustain: false });
      onStatus(tr('MIDI Panic enviado ao canal {channel}.', { channel }), 'success');
    } catch (error) {
      onStatus(tr('Falha no MIDI Panic: {message}', { message: errorText(error) }), 'error');
    } finally { setBusy(false); }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto custom-scrollbar bg-[var(--bg-app)] p-2 sm:p-3 md:flex-row md:overflow-hidden">
      
      {/* MESA DE MIXAGEM */}
      <div className="grid grid-cols-4 gap-2 bg-[var(--bg-app)] p-2 rounded-2xl border border-[var(--border-color)] shadow-inner h-[240px] sm:h-[280px] shrink-0 md:h-auto md:min-h-0 md:min-w-0 md:flex-1 md:shrink md:grid-cols-8 md:grid-rows-1">
        <StudioFader label="MOD" sublabel="CC 1" value={modWheel} onChange={(v) => updateState('modWheel', v)} onCommit={(v) => void sendCC(1, v, 'Modulação')} />
        <StudioFader tone="level" label="VOL" sublabel="CC 7" value={volume} onChange={(v) => updateState('volume', v)} onCommit={(v) => void sendCC(7, v, 'Volume')} />
        <StudioFader label="EXP" sublabel="CC 11" value={expression} onChange={(v) => updateState('expression', v)} onCommit={(v) => void sendCC(11, v, 'Expressão')} />
        <StudioFader label="PAN" sublabel="CC 10" value={pan} onChange={(v) => updateState('pan', v)} onCommit={(v) => void sendCC(10, v, 'Panorama')} />
        
        <StudioFader label="REV" sublabel="CC 91" value={reverb} onChange={(v) => updateState('reverb', v)} onCommit={(v) => void sendCC(91, v, 'Reverb')} />
        <StudioFader label="CHO" sublabel="CC 93" value={chorus} onChange={(v) => updateState('chorus', v)} onCommit={(v) => void sendCC(93, v, 'Chorus')} />
        <StudioFader label="CUT" sublabel="CC 74" value={cutoff} onChange={(v) => updateState('cutoff', v)} onCommit={(v) => void sendCC(74, v, 'Cutoff')} />
        <StudioFader label="RES" sublabel="CC 71" value={resonance} onChange={(v) => updateState('resonance', v)} onCommit={(v) => void sendCC(71, v, 'Ressonância')} />
      </div>

      <div className="flex shrink-0 flex-col gap-3 md:min-h-0 md:w-[340px] md:overflow-y-auto md:pr-1 custom-scrollbar">
        
        {/* CARD PERFORMANCE */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-3 space-y-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span> {tr('Performance')}
          </h3>
          
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="flex flex-col justify-between gap-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] p-3">
              <div>
                <div className="text-xs font-semibold text-[var(--text-main)]">Sustain • CC64</div>
              </div>
              <button 
                disabled={busy || !isConnected} 
                onClick={toggleSustain} 
                className={`w-full h-11 rounded-lg border px-2 text-xs font-bold transition-all disabled:opacity-40 ${prefs.sustain ? 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-panel)]'}`}
              >
                {prefs.sustain ? tr('Ligado') : tr('Desligado')}
              </button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] p-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)]">Program (1–128)</label>
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" min="1" max="128" value={program} 
                  onChange={(event) => updateState('program', Math.max(1, Math.min(128, Number(event.target.value) || 1)))} 
                  className="min-w-0 w-12 h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] px-1 font-mono text-sm text-center text-cyan-500 outline-none focus:border-cyan-500" 
                />
                <button 
                  disabled={busy || !isConnected} 
                  onClick={() => void sendAction(() => midiManager.sendProgramChange(channel, program - 1), tr('Program {program} enviado • Canal {channel}', { program, channel }))} 
                  className="flex-1 h-11 rounded-lg bg-cyan-700 px-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-cyan-600 transition"
                >
                  {tr('Enviar')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD PITCH BEND E PANIC */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-3 space-y-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span> {tr('Pitch Bend')}
          </h3>
          
          <div className="rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] p-3 flex flex-col justify-center gap-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-muted)]">
              <span>{tr('Grave (-)')}</span>
              <span className="font-mono text-cyan-500 text-sm">{pitchBend - 8192 > 0 ? '+' : ''}{pitchBend - 8192}</span>
              <span>{tr('Agudo (+)')}</span>
            </div>
            
            <div className="relative w-full h-10 flex items-center group select-none">
              <div className="absolute inset-x-0 h-4 bg-[var(--bg-panel)] rounded-full border border-[var(--border-color)] shadow-inner overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--border-color)] shadow-[0_0_4px_rgba(255,255,255,0.2)] z-0" />
                <div 
                  className="absolute top-0 bottom-0 bg-cyan-600/30 z-0 transition-all duration-75 ease-out"
                  style={{
                    left: pitchBend > 8192 ? '50%' : `${(pitchBend / 8192) * 50}%`,
                    right: pitchBend < 8192 ? '50%' : `${100 - ((pitchBend - 8192) / 8192) * 50}%`
                  }}
                />
              </div>

              <input 
                aria-label="Pitch Bend" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" 
                type="range" min="0" max="16383" value={pitchBend} 
                onChange={(event) => updateState('pitchBend', Number(event.target.value))} 
                onPointerUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), tr('Pitch Bend enviado • Canal {channel}', { channel }))} 
                onKeyUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), tr('Pitch Bend enviado • Canal {channel}', { channel }))} 
              />

              <div 
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 border border-slate-400/50 rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.6)] z-10 pointer-events-none flex flex-col items-center justify-center gap-[2px] transition-all duration-75 ease-out"
                style={{ left: `${(pitchBend / 16383) * 100}%` }}
              >
                <div className="w-6 h-[2px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                <div className="w-6 h-[2px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
              </div>
            </div>

            <button 
              disabled={busy || !isConnected} 
              onClick={() => { updateState('pitchBend', 8192); void sendAction(() => midiManager.sendPitchBend(channel, 8192), tr('Pitch Bend centralizado • Canal {channel}', { channel })); }} 
              className="flex w-full h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 text-xs font-bold text-[var(--text-main)] disabled:opacity-40 hover:bg-[var(--bg-panel)] transition"
            >
              <RotateCcw size={14} /> {tr('Centralizar')}
            </button>
          </div>

          <button 
            disabled={busy || !isConnected} 
            onClick={() => void panic()} 
            className="flex w-full h-11 items-center justify-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-2 text-xs font-bold uppercase tracking-wide text-red-400 hover:bg-red-900/60 transition shadow-[inset_0_0_15px_rgba(220,38,38,0.1)] disabled:opacity-40"
          >
            <ShieldAlert size={16} /> {tr('MIDI Panic')}
          </button>
        </div>

        {/* PRESETS COMPACTOS */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-3 space-y-3 shadow-sm shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Save size={16} className="text-cyan-500" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{tr('Presets Salvos')}</h3>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              aria-label={tr('Nome do preset')} value={presetName} onChange={(event) => setPresetName(event.target.value)} 
              maxLength={40} placeholder={tr('Nome do preset')} 
              className="min-w-0 flex-1 h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-cyan-500 transition" 
            />
            <button onClick={savePreset} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-bold text-white hover:bg-cyan-600 transition">
              <Save size={14} /> {tr('Salvar')}
            </button>
          </div>
          
          {presets.length === 0 ? (
            <div className="py-4 text-center border border-dashed border-[var(--border-color)] rounded-lg">
              <p className="text-xs text-[var(--text-muted)]">{tr('Nenhum preset salvo.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-2 hover:border-slate-500 transition group">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-[var(--text-main)]">{preset.name}</div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      title={tr('Aplicar')} disabled={busy || !isConnected} onClick={() => void applyPreset(preset)} 
                      className="rounded bg-cyan-900/40 p-2 text-cyan-500 hover:bg-cyan-800/60 disabled:opacity-40 transition-colors"
                    >
                      <Play size={14} />
                    </button>
                    <button 
                      title={tr('Excluir')} onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))} 
                      className="rounded border border-transparent p-2 text-[var(--text-muted)] hover:bg-red-950/50 hover:text-red-500 hover:border-red-900/50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
