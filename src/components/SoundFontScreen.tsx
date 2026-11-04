import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, Library, Layers, UploadCloud, X, Settings2, ChevronLeft, ChevronRight, Save } from 'lucide-react';
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

const SCENES = ['A', 'B', 'C', 'D', 'E', 'F'];
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
  const [channelGroup, setChannelGroup] = useState(0); // 0: canais 1-8, 1: canais 9-16
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScenesOpen, setIsScenesOpen] = useState(false);
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

  return (
    <div className="flex h-full min-h-0 w-full flex-row overflow-hidden bg-[#0a0f1c] p-2 text-slate-100 gap-2">
      
      {/* COLUNA ESQUERDA (Card + Canais MIDI) */}
      <div className="flex min-h-0 w-[38%] max-w-[420px] min-w-[300px] shrink-0 flex-col gap-2">
        <div className="w-full shrink-0 flex flex-col">
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
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Canais MIDI</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setChannelGroup(g => (g + 3) % 2)} className="p-2 text-slate-300 hover:text-white"><ChevronLeft size={16} /></button>
              <span className="text-[10px] font-mono text-cyan-400">{channelGroup === 0 ? '1-8' : '9-16'}</span>
              <button onClick={() => setChannelGroup(g => (g + 1) % 2)} className="p-2 text-slate-300 hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }, (_, k) => channelGroup * 8 + k + 1).map((ch) => {
              const isMuted = channels.muted[ch];
              const isSoloed = channels.solo === ch;
              const isActive = activeChannel === ch;
              return (
                <div key={ch} className={`flex flex-col gap-1 rounded-lg border p-1 transition-colors ${isActive ? 'border-cyan-600/60 bg-cyan-900/30' : 'border-[#1e293b] bg-[#0a0f1c]'}`}>
                  <button
                    type="button"
                    onClick={() => setActiveChannel(ch)}
                    className={`h-7 w-full rounded font-mono text-xs font-bold transition-colors ${isActive ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                  >
                    {ch}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMute(ch)}
                    className={`h-7 w-full rounded text-[10px] font-bold ${isMuted ? 'bg-rose-600 text-white' : 'bg-[#1e293b] text-slate-400 hover:bg-slate-700'}`}
                  >M</button>
                  <button
                    type="button"
                    onClick={() => toggleSolo(ch)}
                    className={`h-7 w-full rounded text-[10px] font-bold ${isSoloed ? 'bg-amber-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:bg-slate-700'}`}
                  >S</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA (Mais larga) */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
        
        {/* BARRA SUPERIOR: CENAS + BIBLIOTECA + CONFIG + SF2 */}
        <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[#1e293b] pb-2">
          <button
            type="button"
            onClick={() => setIsScenesOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-900/20 px-2.5 text-xs font-bold text-amber-400 transition hover:bg-amber-900/40"
          >
            <Layers size={14} /> {tr('CENAS')}
            <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] text-white">{activeScene}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'library' ? 'presets' : 'library'))}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition ${viewMode === 'library' ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-[#1e293b] bg-[#0a0f1c] text-slate-400 hover:text-white'}`}
          >
            <Library size={14} /> BIBLIOTECA
          </button>

          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0a0f1c] text-slate-400 transition hover:text-white"
            title={tr('Configurações')}
          >
            <Settings2 size={16} />
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {synth.fileName ? (
              <span className="hidden max-w-[120px] items-center gap-1 truncate font-mono text-[10px] text-emerald-400 xl:flex">
                <CheckCircle2 size={12} /> {synth.fileName}
              </span>
            ) : (
              <span className="hidden items-center gap-1 font-mono text-[10px] text-slate-500 xl:flex">
                <AlertCircle size={12} /> Sem SF2
              </span>
            )}
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              title={synth.fileName ?? 'Sem SF2'}
              className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
            >
              <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-[#0f172a] ${synth.fileName ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <UploadCloud size={16} /> {busy ? '...' : 'Importar SF2'}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {viewMode === 'presets' && (
            <SoundFontList
              soundFonts={GM_PRESETS}
              activeChannel={activeChannel}
              channelAssignments={channels.assignments}
              onAssignProgram={handleAssignProgram}
            />
          )}
          {viewMode === 'library' && (
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <SoundFontLibraryPanel
                library={library}
                onActivate={(id) => void handleActivate(id)}
                onRemove={(id) => void handleRemove(id)}
              />
            </div>
          )}
        </div>
      </div>

      {isScenesOpen && (
        <Popup title={tr('Cenas')} onClose={() => setIsScenesOpen(false)} widthClass="max-w-sm">
          <div className="grid grid-cols-3 gap-2">
            {SCENES.map((sc) => {
              const hasData = Boolean(scenes[sc]);
              const isActive = activeScene === sc;
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => loadScene(sc)}
                  className={`relative flex h-14 items-center justify-center rounded-xl border text-lg font-bold transition-colors ${isActive ? 'border-amber-500 bg-amber-600 text-white shadow' : 'border-[#1e293b] bg-[#0a0f1c] text-slate-300 hover:bg-slate-800'}`}
                >
                  {sc}
                  {hasData && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {tr('Toque em uma cena para carregá-la. O ponto verde indica cena salva.')}
          </p>
          <button
            type="button"
            onClick={saveScene}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-600/50 bg-amber-900/20 text-sm font-bold text-amber-400 transition hover:bg-amber-900/40"
          >
            <Save size={16} /> {tr('Salvar Cena')} {activeScene}
          </button>
        </Popup>
      )}

      {isConfigOpen && (
        <Popup title={tr('Configurações')} onClose={() => setIsConfigOpen(false)} widthClass="max-w-2xl">
          <SynthSettingsPanel settings={settings} onUpdateSetting={updateSetting} onReset={handleReset} />
        </Popup>
      )}
    </div>
  );
}
