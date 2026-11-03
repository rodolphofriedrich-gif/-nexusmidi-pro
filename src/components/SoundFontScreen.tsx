import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, Library, List, SlidersHorizontal, UploadCloud } from 'lucide-react';
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

type ViewMode = 'presets' | 'config' | 'library';

export function SoundFontScreen({ onStatus }: Props) {
  const settings = useStore(synthSettingsStore);
  const channels = useStore(channelsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  const [viewMode, setViewMode] = useState<ViewMode>('presets');
  const [activeChannel, setActiveChannel] = useState(() => prefsStore.get().channel);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = library.busy || synth.loading;

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

  const toggleMute = (ch: number) =>
    channelsStore.set((s) => ({ ...s, muted: { ...s.muted, [ch]: !s.muted[ch] } }));
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

  const tabClass = (mode: ViewMode, active: string) =>
    `flex h-8 items-center justify-center gap-1.5 px-3 text-[10px] font-bold rounded-lg transition-colors ${viewMode === mode ? active : 'text-slate-500 hover:text-slate-300'}`;

  return (
    <div className="flex w-full flex-1 flex-row overflow-hidden bg-[#0a0f1c] p-2 text-slate-100 gap-2">
      
      {/* COLUNA ESQUERDA: Controles Rápidos + Canais */}
      <div className="flex w-[40%] max-w-[400px] shrink-0 flex-col gap-2">
        <div className="w-full shrink-0">
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

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
          {/* Mini Mixer de Canais (1 a 16) */}
          <div className="grid grid-cols-4 gap-1 pb-2 shrink-0">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(ch => {
              const isMuted = channels.muted[ch];
              const isSoloed = channels.solo === ch;
              const isActive = activeChannel === ch;
              
              return (
                <div key={ch} className={`flex flex-col items-center p-1 rounded-lg border transition-colors ${isActive ? 'bg-slate-800 border-cyan-600/50' : 'bg-[#0a0f1c] border-[#1e293b]'}`}>
                  <button 
                    type="button"
                    onClick={() => setActiveChannel(ch)} 
                    className={`w-full h-6 rounded font-mono text-[10px] font-bold mb-1 transition-colors ${isActive ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'}`}
                  >
                    {ch}
                  </button>
                  <div className="flex gap-1 w-full">
                    <button 
                      type="button"
                      onClick={() => toggleMute(ch)} 
                      className={`flex-1 h-4 rounded flex items-center justify-center text-[8px] font-bold ${isMuted ? 'bg-rose-600 text-white' : 'bg-[#1e293b] text-slate-500 hover:bg-slate-700'}`}
                    >
                      M
                    </button>
                    <button 
                      type="button"
                      onClick={() => toggleSolo(ch)} 
                      className={`flex-1 h-4 rounded flex items-center justify-center text-[8px] font-bold ${isSoloed ? 'bg-amber-500 text-white' : 'bg-[#1e293b] text-slate-500 hover:bg-slate-700'}`}
                    >
                      S
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA: Lista de Presets / Config / Biblioteca */}
      <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
        
        {/* Header com Abas e Importar */}
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-[#1e293b] pb-2">
          <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => setViewMode('presets')} className={tabClass('presets', 'bg-cyan-600 text-white shadow-sm')}>
              <List size={12} /> PRESETS
            </button>
            <button type="button" onClick={() => setViewMode('config')} className={tabClass('config', 'bg-cyan-600 text-white shadow-sm')}>
              <SlidersHorizontal size={12} /> CONFIG
            </button>
            <button type="button" onClick={() => setViewMode('library')} className={tabClass('library', 'bg-cyan-600 text-white shadow-sm')}>
              <Library size={12} /> BIBLIOTECA
            </button>
          </div>

          <div className="flex items-center gap-3">
            {synth.fileName ? (
              <span className="flex max-w-[120px] items-center gap-1 truncate font-mono text-[10px] text-emerald-400">
                <CheckCircle2 size={12} /> {synth.fileName}
              </span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                <AlertCircle size={12} /> Sem SF2
              </span>
            )}
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-[10px] font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
            >
              <UploadCloud size={14} /> {busy ? '...' : 'Importar SF2'}
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 min-h-0 w-full overflow-hidden">
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
          {viewMode === 'config' && (
            <SynthSettingsPanel settings={settings} onUpdateSetting={updateSetting} onReset={handleReset} />
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
    </div>
  );
}
