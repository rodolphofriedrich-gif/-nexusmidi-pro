import { useEffect, useMemo, useState } from 'react';
import { Play, Save, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';
import { tr } from '../i18n';
import { uid } from '../lib/id';
import { midiManager } from '../services/midiService';
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
  sustain: false,
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
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      return saved ? { ...DEFAULT_CONTROLS, ...JSON.parse(saved) } : DEFAULT_CONTROLS;
    } catch {
      return DEFAULT_CONTROLS;
    }
  });

  const { modWheel, volume, expression, pan, sustain, program, pitchBend, reverb, chorus, cutoff, resonance } = state;

  const updateState = (key: string, value: any) => setState((s: any) => ({ ...s, [key]: value }));

  const [presetName, setPresetName] = useState(() => tr('Meu preset'));
  const [presets, setPresets] = useState<MidiPreset[]>(loadPresets);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* */ }
  }, [state]);

  useEffect(() => {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* */ }
  }, [presets]);

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
      setState((s: any) => ({ ...s, ...preset }));
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
    const preset: MidiPreset = { id: uid('preset-'), name, ...controls };
    setPresets((current) => [preset, ...current]);
    onStatus(tr('Preset “{name}” salvo neste dispositivo.', { name }), 'success');
  };

  const resetControls = () => {
    setState(DEFAULT_CONTROLS);
    onStatus(tr('Controles redefinidos localmente.'), 'info');
  };

  const panic = async () => {
    if (!isConnected) { onStatus(tr('Conecte um destino MIDI ou carregue um SoundFont antes de executar o MIDI Panic.'), 'warn'); return; }
    setBusy(true);
    try {
      await midiManager.sendPanic([channel]);
      updateState('sustain', false);
      onStatus(tr('MIDI Panic enviado ao canal {channel}.', { channel }), 'success');
    } catch (error) {
      onStatus(tr('Falha no MIDI Panic: {message}', { message: errorText(error) }), 'error');
    } finally { setBusy(false); }
  };

  return (
    <section className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#0a0f1c] p-2 sm:p-3 space-y-3 flex flex-col">
      
      {/* HEADER COMPACTO: Canal e Reset */}
      <header className="flex items-center justify-between gap-3 border-b border-[#1e293b] pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono bg-[#0f172a] border border-[#1e293b] px-2 py-1 rounded">CH {String(channel).padStart(2, '0')}</span>
        </div>
        <button onClick={resetControls} className="text-[10px] text-slate-400 hover:text-white transition flex items-center gap-1 bg-[#0f172a] border border-[#1e293b] rounded px-2 py-1">
          <RotateCcw size={12} /> Reset
        </button>
      </header>

      {/* MESA DE MIXAGEM - Aumentada */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 sm:gap-2 bg-[#0a0f1c] p-1.5 sm:p-2 rounded-2xl border border-[#1e293b] shadow-inner h-[340px] sm:h-[380px] shrink-0">
        <StudioFader label="MOD" sublabel="CC 1" value={modWheel} onChange={(v: any) => updateState('modWheel', v)} onCommit={(v) => void sendCC(1, v, 'Modulação')} />
        <StudioFader label="VOL" sublabel="CC 7" value={volume} onChange={(v: any) => updateState('volume', v)} onCommit={(v) => void sendCC(7, v, 'Volume')} />
        <StudioFader label="EXP" sublabel="CC 11" value={expression} onChange={(v: any) => updateState('expression', v)} onCommit={(v) => void sendCC(11, v, 'Expressão')} />
        <StudioFader label="PAN" sublabel="CC 10" value={pan} onChange={(v: any) => updateState('pan', v)} onCommit={(v) => void sendCC(10, v, 'Panorama')} />
        
        <StudioFader label="REV" sublabel="CC 91" value={reverb} onChange={(v: any) => updateState('reverb', v)} onCommit={(v) => void sendCC(91, v, 'Reverb')} />
        <StudioFader label="CHO" sublabel="CC 93" value={chorus} onChange={(v: any) => updateState('chorus', v)} onCommit={(v) => void sendCC(93, v, 'Chorus')} />
        <StudioFader label="CUT" sublabel="CC 74" value={cutoff} onChange={(v: any) => updateState('cutoff', v)} onCommit={(v) => void sendCC(74, v, 'Cutoff')} />
        <StudioFader label="RES" sublabel="CC 71" value={resonance} onChange={(v: any) => updateState('resonance', v)} onCommit={(v) => void sendCC(71, v, 'Ressonância')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
        
        {/* CARD PERFORMANCE */}
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3 space-y-2 shadow-sm flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-2 border-b border-[#1e293b] pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> {tr('Performance')}
          </h3>
          
          <div className="grid grid-cols-2 gap-2 flex-1">
            <div className="flex flex-col justify-between gap-2 rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-2">
              <div>
                <div className="text-[10px] font-semibold text-slate-200">Sustain • CC64</div>
              </div>
              <button 
                disabled={busy || !isConnected} 
                onClick={() => { const next = !sustain; updateState('sustain', next); void sendCC(64, next ? 127 : 0, next ? tr('Sustain ligado') : tr('Sustain desligado')); }} 
                className={`w-full rounded-lg border px-2 py-2 text-[10px] font-bold transition-all disabled:opacity-40 ${sustain ? 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {sustain ? tr('Ligado') : tr('Desligado')}
              </button>
            </div>

            <div className="flex flex-col justify-between gap-2 rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-200">Program (1–128)</label>
              </div>
              <div className="flex gap-1">
                <input 
                  type="number" min="1" max="128" value={program} 
                  onChange={(event) => updateState('program', Math.max(1, Math.min(128, Number(event.target.value) || 1)))} 
                  className="min-w-0 w-10 rounded-lg border border-slate-700 bg-[#0f172a] px-1 py-2 font-mono text-xs text-center text-cyan-300 outline-none focus:border-cyan-500" 
                />
                <button 
                  disabled={busy || !isConnected} 
                  onClick={() => void sendAction(() => midiManager.sendProgramChange(channel, program - 1), tr('Program {program} enviado • Canal {channel}', { program, channel }))} 
                  className="flex-1 rounded-lg bg-cyan-700 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40 hover:bg-cyan-600 transition"
                >
                  {tr('Enviar')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD PITCH BEND E PANIC */}
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3 space-y-2 shadow-sm flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-2 border-b border-[#1e293b] pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span> {tr('Pitch Bend')}
          </h3>
          
          <div className="rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-2 flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              <span>{tr('Grave (-)')}</span>
              <span className="font-mono text-cyan-400">{pitchBend - 8192 > 0 ? '+' : ''}{pitchBend - 8192}</span>
              <span>{tr('Agudo (+)')}</span>
            </div>
            
            <div className="relative w-full h-8 flex items-center group select-none">
              <div className="absolute inset-x-0 h-3 bg-[#05080f] rounded-full border border-[#1e293b] shadow-inner overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 shadow-[0_0_4px_rgba(255,255,255,0.2)] z-0" />
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
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 border border-slate-400/50 rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.6)] z-10 pointer-events-none flex flex-col items-center justify-center gap-[2px] transition-all duration-75 ease-out"
                style={{ left: `${(pitchBend / 16383) * 100}%` }}
              >
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
              </div>
            </div>

            <button 
              disabled={busy || !isConnected} 
              onClick={() => { updateState('pitchBend', 8192); void sendAction(() => midiManager.sendPitchBend(channel, 8192), tr('Pitch Bend centralizado • Canal {channel}', { channel })); }} 
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
            >
              <RotateCcw size={12} /> {tr('Centralizar')}
            </button>
          </div>

          <button 
            disabled={busy || !isConnected} 
            onClick={() => void panic()} 
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-2 py-2 text-[10px] font-extrabold uppercase tracking-wide text-red-400 hover:bg-red-900/60 transition shadow-[inset_0_0_15px_rgba(220,38,38,0.1)] disabled:opacity-40"
          >
            <ShieldAlert size={14} /> {tr('MIDI Panic')}
          </button>
        </div>
      </div>

      {/* PRESETS COMPACTOS */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3 space-y-2 shadow-sm shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save size={14} className="text-cyan-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{tr('Presets Salvos')}</h3>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input 
            aria-label={tr('Nome do preset')} value={presetName} onChange={(event) => setPresetName(event.target.value)} 
            maxLength={40} placeholder={tr('Nome do preset')} 
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0a0f1c] px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-cyan-500 transition" 
          />
          <button onClick={savePreset} className="flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-cyan-600 transition">
            <Save size={12} /> {tr('Salvar')}
          </button>
        </div>
        
        {presets.length === 0 ? (
          <div className="py-3 text-center border border-dashed border-slate-800 rounded-lg">
            <p className="text-[10px] text-slate-500">{tr('Nenhum preset salvo.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex min-w-0 items-center gap-1 rounded-lg border border-[#1e293b] bg-[#0a0f1c] p-1.5 hover:border-slate-600 transition group">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-bold text-slate-200">{preset.name}</div>
                </div>
                <div className="flex gap-1">
                  <button 
                    title={tr('Aplicar')} disabled={busy || !isConnected} onClick={() => void applyPreset(preset)} 
                    className="rounded bg-cyan-900/40 p-1 text-cyan-400 hover:bg-cyan-800/60 disabled:opacity-40 transition-colors"
                  >
                    <Play size={10} />
                  </button>
                  <button 
                    title={tr('Excluir')} onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))} 
                    className="rounded border border-slate-800 p-1 text-slate-500 hover:bg-red-950/50 hover:text-red-400 hover:border-red-900/50 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
