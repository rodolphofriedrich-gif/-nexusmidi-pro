import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, Library, List, UploadCloud, X, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';
import { GM_PRESETS } from '../constants/gm';
import { useStore } from '../hooks/useStore';
import type { ToastType } from '../hooks/useToast';
import { tr } from '../i18n';
import { soundFontLibrary } from '../services/soundFontLibrary';
import { channelsStore, prefsStore, synthSettingsStore } from '../services/stores';
import type { SynthSettings } from '../services/synthTypes';
import { synthService } from '../services/synthService';
import type { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontLibraryPanel } from './soundfont/SoundFontLibraryPanel';
import { SoundFontList } from './soundfont/SoundFontList';
import { SynthSettingsPanel } from './soundfont/SynthSettingsPanel';

interface Props {
  onStatus: (message: string, type?: ToastType) => void;
}

type ViewMode = 'presets' | 'library';

const SCENES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SCENES_KEY = 'nexusmidi_studio_scenes';

function Popup({ title, onClose, children, widthClass = 'max-w-2xl' }: { title: string; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#0a0f1c] text-slate-400 transition hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

export function SoundFontScreen({ onStatus }: Props) {
  const settings = useStore(synthSettingsStore);
  const channels = useStore(channelsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  const [viewMode, setViewMode] = useState<ViewMode>('presets');
  const [activeChannel, setActiveChannel] = useState(() => prefsStore.get().channel);
  const [channelGroup, setChannelGroup] = useState(0); // 0: 1-4 e 5-8, 1: 9-12 e 13-16
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = library.busy || synth.loading;

  // Sistema de Cenas
  const [scenes, setScenes] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem(SCENES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [activeScene, setActiveScene] = useState('A');

  useEffect(() => {
    if (library.error) onStatus(library.error, 'error');
  }, [library.error, onStatus]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onStatus(tr('Carregando e salvando SoundFont...'), 'info');
    if (await soundFontLibrary.importFile(file)) {
      channelsStore.set({ assignments: {}, muted: {}, solo: null });
      onStatus(tr('SoundFont "{name}" carregado!', { name: file.name }), 'success');
    }
  };

  const handleActivate = async (id: string) => {
    if (await soundFontLibrary.activate(id)) onStatus(tr('SoundFont carregado!'), 'success');
  };

  const handleRemove = async (id: string) => {
    await soundFontLibrary.remove(id);
    onStatus(tr('SoundFont removido da biblioteca.'), 'info');
  };

  const handleAssignProgram = (preset: SoundFontPreset) => {
    if (!synth.ready) {
      onStatus(tr('Importe um arquivo SF2 primeiro.'), 'warn');
      return;
    }
    synthService.programChange(preset.programNumber, activeChannel);
    channelsStore.set((s) => ({ ...s, assignments: { ...s.assignments, [activeChannel]: preset.programNumber } }));
  };

  const updateSetting = (key: keyof SynthSettings, value: number) => synthSettingsStore.set({ [key]: value });

  const handleReset = () => {
    synthSettingsStore.reset();
    onStatus(tr('Configurações restauradas para o padrão.'), 'info');
  };

  const toggleMute = (ch: number) => channelsStore.set((s) => ({ ...s, muted: { ...s.muted, [ch]: !s.muted[ch] } }));
  const toggleSolo = (ch: number) => channelsStore.set((s) => ({ ...s, solo: s.solo === ch ? null : ch }));

  const activePreset = (): SoundFontPreset =>
    GM_PRESETS.find((p) => p.programNumber === channels.assignments[activeChannel]) ?? GM_PRESETS[0];

  const handleAudition = () => {
    if (!synth.ready) {
      onStatus(tr('Carregue um arquivo .sf2 primeiro.'), 'warn');
      return;
    }
    const chord = [60, 64, 67, 72];
    chord.forEach((note) => synthService.noteOn(note, 100, activeChannel));
    setTimeout(() => chord.forEach((note) => synthService.noteOff(note, activeChannel)), 1000);
  };

  // Funções de Cena
  const loadScene = (scene: string) => {
    setActiveScene(scene);
    if (scenes[scene]) {
      channelsStore.set(scenes[scene].channels);
      synthSettingsStore.set(scenes[scene].settings);
      onStatus(tr('Cena {scene} carregada.', { scene }), 'info');
    } else {
      onStatus(tr('Cena {scene} está vazia.', { scene }), 'warn');
    }
  };

  const saveScene = () => {
    const newScenes = { ...scenes, [activeScene]: { channels: channelsStore.get(), settings: synthSettingsStore.get() } };
    setScenes(newScenes);
    localStorage.setItem(SCENES_KEY, JSON.stringify(newScenes));
    onStatus(tr('Cena {scene} salva com sucesso.', { scene: activeScene }), 'success');
  };

  const tabClass = (mode: ViewMode, active: string) =>
    `flex h-9 items-center justify-center gap-1.5 px-4 text-xs font-bold rounded-lg transition-colors ${viewMode === mode ? active : 'text-slate-500 hover:text-slate-300'}`;

  const getChannelBlock = (offset: number) => {
    const start = (channelGroup * 8 + offset * 4) % 16 + 1;
    return [start, start + 1, start + 2, start + 3];
  };

  return (
    <div className="flex w-full flex-1 flex-row overflow-hidden bg-[#0a0f1c] p-2 text-slate-100 gap-2">
      
      {/* COLUNA ESQUERDA (Card + Canais MIDI) */}
      <div className="flex w-[30%] max-w-[320px] min-w-[240px] shrink-0 flex-col gap-2">
        <div className="w-full shrink-0 h-56 flex flex-col">
          <ActiveSoundFontCard
            preset={activePreset()}
            volume={settings.volume}
            onVolumeChange={(v) => updateSetting('volume', v)}
            reverb={settings.reverb}
            onReverbChange={(v) => updateSetting('reverb', v)}
            transpose={settings.transpose}
            onTransposeChange={(v) => updateSetting('transpose', v)}
            onAudition={handleAudition}
          />
        </div>

        {/* BLOCO DE CANAIS MIDI */}
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Canais MIDI</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setChannelGroup(g => (g + 3) % 2)} className="p-1 text-slate-400 hover:text-white"><ChevronLeft size={14} /></button>
              <span className="text-[10px] font-mono text-cyan-400">{channelGroup === 0 ? '1-8' : '9-16'}</span>
              <button onClick={() => setChannelGroup(g => (g + 1) % 2)} className="p-1 text-slate-400 hover:text-white"><ChevronRight size={14} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((offset) => {
              const block = getChannelBlock(offset);
              return (
                <div key={offset} className="flex flex-col gap-1 p-1.5 rounded-lg bg-[#0a0f1c] border border-[#1e293b]">
                  {block.map((ch) => {
                    const isMuted = channels.muted[ch];
                    const isSoloed = channels.solo === ch;
                    const isActive = activeChannel === ch;
                    return (
                      <div key={ch} className={`flex items-center gap-1 rounded-md p-1 transition-colors ${isActive ? 'bg-cyan-900/30 border border-cyan-600/50' : 'border border-transparent hover:bg-slate-800'}`}>
                        <button
                          type="button"
                          onClick={() => setActiveChannel(ch)}
                          className={`w-6 h-6 rounded font-mono text-[10px] font-bold transition-colors ${isActive ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                        >
                          {ch}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMute(ch)}
                          className={`flex-1 h-5 rounded text-[8px] font-bold ${isMuted ? 'bg-rose-600 text-white' : 'bg-[#1e293b] text-slate-500 hover:bg-slate-700'}`}
                        >M</button>
                        <button
                          type="button"
                          onClick={() => toggleSolo(ch)}
                          className={`flex-1 h-5 rounded text-[8px] font-bold ${isSoloed ? 'bg-amber-500 text-white' : 'bg-[#1e293b] text-slate-500 hover:bg-slate-700'}`}
                        >S</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA (Mais larga) */}
      <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
        
        {/* BARRA DE CENAS E CONTROLES */}
        <div className="mb-2 flex flex-wrap shrink-0 items-center justify-between gap-2 border-b border-[#1e293b] pb-2">
          <div className="flex items-center gap-2">
            <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
              {SCENES.map((s) => (
                <button key={s} type="button" onClick={() => loadScene(s)} className={`flex h-9 items-center justify-center px-4 text-xs font-bold rounded-md transition-colors ${activeScene === s ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={saveScene} className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 text-xs font-bold text-amber-400 hover:bg-amber-900/40 transition">
              {tr('Salvar Cena')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
              <button type="button" onClick={() => setViewMode('presets')} className={tabClass('presets', 'bg-cyan-600 text-white shadow-sm')}>
                <List size={14} /> PRESETS
              </button>
              <button type="button" onClick={() => setViewMode('library')} className={tabClass('library', 'bg-cyan-600 text-white shadow-sm')}>
                <Library size={14} /> BIBLIOTECA
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-[#0a0f1c] text-slate-400 hover:text-white transition"
              title={tr('Configurações')}
            >
              <Settings2 size={16} />
            </button>

            {synth.fileName ? (
              <span className="hidden max-w-[120px] items-center gap-1 truncate font-mono text-[10px] text-emerald-400 sm:flex">
                <CheckCircle2 size={12} /> {synth.fileName}
              </span>
            ) : (
              <span className="hidden items-center gap-1 font-mono text-[10px] text-slate-500 sm:flex">
                <AlertCircle size={12} /> Sem SF2
              </span>
            )}
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
            >
              <UploadCloud size={16} /> {busy ? '...' : 'Importar SF2'}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar">
          {viewMode === 'presets' && (
            <SoundFontList
              soundFonts={GM_PRESETS}
              activeChannel={activeChannel}
              onSelectChannel={setActiveChannel}
              channelAssignments={channels.assignments}
              onAssignProgram={handleAssignProgram}
              mutedChannels={channels.muted}
              soloedChannel={channels.solo}
              onToggleMute={toggleMute}
              onToggleSolo={toggleSolo}
            />
          )}
          {viewMode === 'library' && (
            <SoundFontLibraryPanel
              library={library}
              onActivate={(id) => void handleActivate(id)}
              onRemove={(id) => void handleRemove(id)}
            />
          )}
        </div>
      </div>

      {isConfigOpen && (
        <Popup title={tr('Configurações')} onClose={() => setIsConfigOpen(false)} widthClass="max-w-2xl">
          <SynthSettingsPanel settings={settings} onUpdateSetting={updateSetting} onReset={handleReset} />
        </Popup>
      )}
    </div>
  );
}
