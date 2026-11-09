import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { Library, List, Save, UploadCloud, X, Settings2, Trash2, SlidersHorizontal, Wand2, Cpu } from 'lucide-react';
import { channelColor } from '../constants/channelColors';
import { categoryOfProgram } from '../constants/gm';
import { useStore } from '../hooks/useStore';
import type { ToastType } from '../hooks/useToast';
import { tr } from '../i18n';
import { soundFontLibrary } from '../services/soundFontLibrary';
import { channelSettingsOf, channelSettingsStore, channelsStore, prefsStore, synthSettingsStore } from '../services/stores';
import type { ChannelSettings, SynthSettings } from '../services/synthTypes';
import { DEFAULT_CHANNEL_SETTINGS, isChannelSettingKey } from '../services/synthTypes';
import { synthService } from '../services/synthService';
import type { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontLibraryPanel } from './soundfont/SoundFontLibraryPanel';
import { SoundFontList } from './soundfont/SoundFontList';
import { SynthSettingsPanel } from './soundfont/SynthSettingsPanel';

interface Props {
  onStatus: (message: string, type?: ToastType) => void;
}

type ConfigTab = 'effects' | 'timbre' | 'system';
type PopupMode = ConfigTab | null;
type InlineView = 'presets' | 'library' | null;

const SCENES = ['1', '2', '3', '4', '5', '6'];
const SCENES_KEY = 'nexusmidi_studio_scenes';

function Popup({ title, onClose, children, widthClass = 'max-w-2xl' }: { title: string; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[92dvh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl`}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">{title}</h3>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

function MidiChannelsPanel({ activeChannel, muted, solo, onSelect, onToggleMute, onToggleSolo }: {
  activeChannel: number;
  muted: Record<number, boolean>;
  solo: number | null;
  onSelect: (ch: number) => void;
  onToggleMute: (ch: number) => void;
  onToggleSolo: (ch: number) => void;
}) {
  const [page, setPage] = useState(0);

  const renderChannel = (ch: number) => {
    const isActive = ch === activeChannel;
    return (
      <div key={ch} className={`flex flex-col items-center gap-1 rounded-lg border bg-[var(--bg-app)] p-1 ${isActive ? 'border-indigo-400/70' : 'border-[var(--border-color)]'}`}>
        <button
          type="button"
          onClick={() => onSelect(ch)}
          className="flex h-8 w-full items-center justify-center rounded-md text-sm font-bold"
          style={isActive ? { backgroundColor: channelColor(ch), color: '#121316' } : { color: channelColor(ch) }}
        >
          {ch}
        </button>
        <button type="button" onClick={() => onToggleMute(ch)}
          className={`h-8 w-full rounded-md text-xs font-bold ${muted[ch] ? 'bg-red-600 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-main)]'}`}>M</button>
        <button type="button" onClick={() => onToggleSolo(ch)}
          className={`h-8 w-full rounded-md text-xs font-bold ${solo === ch ? 'bg-amber-500 text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-main)]'}`}>S</button>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr('Canais MIDI')}</span>
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--nexus-primary)] lg:hidden">
          <button type="button" disabled={page === 0} onClick={() => setPage(0)} className="px-2 disabled:opacity-30">‹</button>
          {page * 8 + 1}-{page * 8 + 8}
          <button type="button" disabled={page === 1} onClick={() => setPage(1)} className="px-2 disabled:opacity-30">›</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className={`grid grid-cols-8 gap-1 ${page === 1 ? 'hidden lg:grid' : 'grid'}`}>
          {Array.from({ length: 8 }, (_, i) => renderChannel(i + 1))}
        </div>
        <div className={`grid grid-cols-8 gap-1 ${page === 0 ? 'hidden lg:grid' : 'grid'}`}>
          {Array.from({ length: 8 }, (_, i) => renderChannel(i + 9))}
        </div>
      </div>
    </div>
  );
}

function ChannelGrid({ value, onSelect }: { value: number; onSelect: (ch: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: 16 }, (_, i) => {
        const ch = i + 1;
        const selected = value === ch;
        return (
          <button
            key={ch}
            type="button"
            onClick={() => onSelect(ch)}
            className={`h-12 rounded-lg border font-mono text-sm transition-colors ${
              selected
                ? 'border-indigo-500/60 bg-indigo-500/20 font-bold text-[var(--nexus-primary)]'
                : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {String(ch).padStart(2, '0')}
          </button>
        );
      })}
    </div>
  );
}

export function SoundFontScreen({ onStatus }: Props) {
  const channels = useStore(channelsStore);
  const prefs = useStore(prefsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  const activeChannel = prefs.channel;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = library.busy || synth.loading;

  const [popupMode, setPopupMode] = useState<PopupMode>(null);
  const [inlineView, setInlineView] = useState<InlineView>(null);
  const [selectedPresetForChannel, setSelectedPresetForChannel] = useState<SoundFontPreset | null>(null);

  const channelSettingsState = useStore(channelSettingsStore);
  const globalSettings = useStore(synthSettingsStore);
  const [configChannel, setConfigChannel] = useState<number>(activeChannel);

  const [scenes, setScenes] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem(SCENES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [activeScene, setActiveScene] = useState('A');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scenesToDelete, setScenesToDelete] = useState<string[]>([]);

  useEffect(() => {
    if (library.error) onStatus(library.error, 'error');
  }, [library.error, onStatus]);

  const instruments = useMemo<SoundFontPreset[]>(() => {
    const seen = new Set<string>();
    const result: SoundFontPreset[] = [];
    for (const libraryId of library.activeIds) {
      const libraryName = library.items.find((i) => i.id === libraryId)?.name ?? libraryId;
      for (const raw of library.presets[libraryId] ?? []) {
        const p = raw as any;
        const bankNumber: number = p.bankNumber ?? p.bank ?? 0;
        const programNumber: number = p.programNumber ?? p.program ?? p.preset ?? 0;
        const isDrum: boolean = p.isDrum ?? bankNumber === 128;
        const key = `${bankNumber}:${programNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: `${libraryId}:${bankNumber}:${programNumber}`,
          libraryId,
          libraryName,
          programNumber,
          bankNumber,
          name: p.name ?? `Preset ${programNumber}`,
          category: isDrum ? 'Baterias' : categoryOfProgram(programNumber),
          isDrum,
        });
      }
    }
    return result.sort((a, b) => a.bankNumber - b.bankNumber || a.programNumber - b.programNumber);
  }, [library.activeIds, library.items, library.presets]);

  const hasLibrary = library.items.length > 0;

  const getChannelSettings = (ch: number): ChannelSettings => channelSettingsOf(channelSettingsState, ch);

  const panelSettings = (ch: number): SynthSettings => ({ ...globalSettings, ...getChannelSettings(ch) });

  const setChannelSetting = (ch: number, key: keyof ChannelSettings, value: number) =>
    channelSettingsStore.set((prev) => ({
      channels: { ...prev.channels, [ch]: { ...channelSettingsOf(prev, ch), [key]: value } },
    }));

  const updateSetting = (key: keyof ChannelSettings, value: number) => setChannelSetting(activeChannel, key, value);

  const updateConfigSetting = (key: keyof SynthSettings, value: number) => {
    if (isChannelSettingKey(key)) setChannelSetting(configChannel, key, value);
    else synthSettingsStore.set({ [key]: value });
  };

  const handleResetChannel = () => {
    const ch = configChannel;
    channelSettingsStore.set((prev) => ({ channels: { ...prev.channels, [ch]: { ...DEFAULT_CHANNEL_SETTINGS } } }));
    onStatus(tr('Configurações do canal {ch} restauradas.', { ch }), 'info');
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onStatus(tr('Carregando e salvando SoundFont...'), 'info');
    if (await soundFontLibrary.importFile(file)) {
      onStatus(tr('SoundFont "{name}" carregado!', { name: file.name }), 'success');
    }
  };

  const handleActivate = async (id: string) => {
    if (await soundFontLibrary.toggle(id)) {
      onStatus(tr('SoundFont alterado!'), 'success');
    }
  };

  const handleRemove = async (id: string) => {
    await soundFontLibrary.remove(id);
    onStatus(tr('SoundFont removido da biblioteca.'), 'info');
  };

  const handleMove = (id: string, delta: -1 | 1) => soundFontLibrary.move(id, delta);

  const handlePresetSelected = (preset: SoundFontPreset) => {
    setSelectedPresetForChannel(preset);
  };

  const applyPresetToChannel = (ch: number) => {
    if (!selectedPresetForChannel) return;
    if (!synth.ready) {
      onStatus(tr('Importe um arquivo SF2 primeiro.'), 'warn');
      return;
    }
    synthService.programChange(selectedPresetForChannel.programNumber, ch, selectedPresetForChannel.bankNumber);
    channelsStore.set((s) => ({
      ...s,
      assignments: { ...s.assignments, [ch]: selectedPresetForChannel.programNumber },
      banks: { ...s.banks, [ch]: selectedPresetForChannel.bankNumber },
    }));
    onStatus(tr('Preset aplicado ao canal {ch}.', { ch }), 'success');
    setSelectedPresetForChannel(null);
  };

  const selectChannel = (ch: number) => prefsStore.set({ channel: ch });
  const toggleMute = (ch: number) =>
    channelsStore.set((s) => ({ ...s, muted: { ...s.muted, [ch]: !s.muted?.[ch] } }));
  const toggleSolo = (ch: number) =>
    channelsStore.set((s) => ({ ...s, solo: s.solo === ch ? null : ch }));

  const handleAudition = () => {
    if (!synth.ready) {
      onStatus(tr('Carregue um arquivo .sf2 primeiro.'), 'warn');
      return;
    }
    const chord = [60, 64, 67, 72];
    chord.forEach((note) => synthService.noteOn(note, 100, activeChannel));
    setTimeout(() => chord.forEach((note) => synthService.noteOff(note, activeChannel)), 1000);
  };

  const activePreset = (): SoundFontPreset => {
    const program = channels.assignments[activeChannel] ?? 0;
    const bank = channels.banks?.[activeChannel] ?? 0;
    const found = instruments.find((i) => i.programNumber === program && i.bankNumber === bank);
    return found ?? ({ programNumber: program, name: tr('Escolha um instrumento'), category: 'Piano', isDrum: false } as any);
  };

  const loadScene = (scene: string) => {
    setActiveScene(scene);
    if (scenes[scene]) {
      const saved = scenes[scene].channels;
      channelsStore.set(saved);
      synthService.setChannelPrograms(saved.assignments ?? {}, saved.banks ?? {});
      synthSettingsStore.set(scenes[scene].settings);
      if (scenes[scene].channelSettings) channelSettingsStore.set(scenes[scene].channelSettings);
      onStatus(tr('Cena {scene} carregada.', { scene }), 'info');
    } else {
      onStatus(tr('Cena {scene} está vazia.', { scene }), 'warn');
    }
  };

  const saveScene = () => {
    const newScenes = { ...scenes, [activeScene]: { channels: channelsStore.get(), settings: synthSettingsStore.get(), channelSettings: channelSettingsStore.get() } };
    try {
      localStorage.setItem(SCENES_KEY, JSON.stringify(newScenes));
      setScenes(newScenes);
      onStatus(tr('Cena {scene} salva com sucesso.', { scene: activeScene }), 'success');
    } catch (err) {
      console.error('Falha ao salvar cena:', err);
      onStatus(tr('Não foi possível salvar a cena.'), 'error');
    }
  };

  const toggleSceneSelection = (scene: string) => {
    setScenesToDelete((prev) => (prev.includes(scene) ? prev.filter((s) => s !== scene) : [...prev, scene]));
  };

  const confirmDeleteScenes = () => {
    if (scenesToDelete.length === 0) { setIsDeleteModalOpen(false); return; }
    const newScenes = { ...scenes };
    scenesToDelete.forEach((s) => delete newScenes[s]);
    try {
      localStorage.setItem(SCENES_KEY, JSON.stringify(newScenes));
      setScenes(newScenes);
      if (scenesToDelete.includes(activeScene)) {
        const firstAvailable = SCENES.find((s) => newScenes[s]) || 'A';
        setActiveScene(firstAvailable);
      }
      onStatus(tr('Cenas apagadas com sucesso.'), 'info');
      setIsDeleteModalOpen(false);
      setScenesToDelete([]);
    } catch (err) {
      console.error('Falha ao apagar cenas:', err);
      onStatus(tr('Não foi possível apagar as cenas.'), 'error');
    }
  };

  const inlineTabClass = (view: 'presets' | 'library') =>
    `flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors ${
      inlineView === view ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
    }`;

  const configBtnClass = (mode: ConfigTab) =>
    `flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors ${
      popupMode === mode
        ? 'bg-indigo-500/20 border-indigo-500/50 text-[var(--nexus-primary)]'
        : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
    }`;

  const closeInline = () => setInlineView(null);
  const toggleInline = (view: 'presets' | 'library') => setInlineView((v) => (v === view ? null : view));

  return (
    <div className="flex w-full flex-1 flex-row gap-2 overflow-hidden bg-[var(--bg-app)] p-2 text-[var(--text-main)]">
      <div className="flex min-h-0 shrink-0 flex-col gap-2 overflow-y-auto custom-scrollbar" style={{ width: '46%' }}>
        <div className="w-full shrink-0">
          <ActiveSoundFontCard
            preset={activePreset()}
            volume={getChannelSettings(activeChannel).volume}
            onVolumeChange={(v) => updateSetting('volume', v)}
            reverb={getChannelSettings(activeChannel).reverb}
            onReverbChange={(v) => updateSetting('reverb', v)}
            transpose={getChannelSettings(activeChannel).transpose}
            onTransposeChange={(v) => updateSetting('transpose', v)}
            onAudition={handleAudition}
            canPlay={synth.ready}
          />
        </div>
        <MidiChannelsPanel
          activeChannel={activeChannel}
          muted={channels.muted ?? {}}
          solo={channels.solo ?? null}
          onSelect={selectChannel}
          onToggleMute={toggleMute}
          onToggleSolo={toggleSolo}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 min-h-0 h-full">
        
        <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <div className="flex min-w-0 flex-1 overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
            {SCENES.map((s) => (
              <button key={s} type="button" onClick={() => loadScene(s)}
                className={`flex h-8 flex-1 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${activeScene === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--nexus-danger)]/70 transition-colors hover:bg-[var(--nexus-danger)]/10 hover:text-[var(--nexus-danger)] ml-1"
              title={tr('Apagar Cenas')}
              aria-label={tr('Apagar Cenas')}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={saveScene}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/50 bg-indigo-900/20 text-[var(--nexus-primary)] transition-colors hover:bg-indigo-900/40"
            title={tr('Salvar Cena')}
            aria-label={tr('Salvar Cena')}
          >
            <Save size={14} />
          </button>
        </div>

        {inlineView === null ? (
          <>
            <div className="mb-2 flex shrink-0 flex-col gap-2 border-b border-[var(--border-color)] pb-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
                  <button type="button" onClick={() => toggleInline('presets')} className={inlineTabClass('presets')}>
                    <List size={14} /> {tr('PRESETS')}
                  </button>
                  <button type="button" onClick={() => toggleInline('library')} className={inlineTabClass('library')}>
                    <Library size={14} /> {tr('BIBLIOTECA')}
                  </button>
                </div>
                <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}
                  className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                  <UploadCloud size={14} /> {busy ? '...' : 'Importar SF2'}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('effects'); }}
                  className={configBtnClass('effects')}>
                  <SlidersHorizontal size={14} /> {tr('EFEITOS')}
                </button>
                <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('timbre'); }}
                  className={configBtnClass('timbre')}>
                  <Wand2 size={14} /> {tr('TIMBRE')}
                </button>
                <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('system'); }}
                  className={configBtnClass('system')}>
                  <Cpu size={14} /> {tr('SISTEMA')}
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border-color)] p-6 text-center">
              <Settings2 size={32} className="text-[var(--text-muted)] opacity-40" />
              <p className="text-xs text-[var(--text-muted)] max-w-xs">
                {tr('Abra PRESETS para escolher um instrumento ou BIBLIOTECA para gerenciar seus SoundFonts.')}
              </p>
              {hasLibrary && (
                <p className="text-[11px] text-[var(--nexus-success)]">
                  {instruments.length} {tr('instrumentos disponíveis')}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="relative flex flex-1 min-h-0 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {tr(inlineView === 'presets' ? 'PRESETS' : 'BIBLIOTECA')}
              </span>
              <button
                type="button"
                onClick={closeInline}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                aria-label={tr('Fechar')}
                title={tr('Fechar')}
              >
                <X size={16} />
              </button>
            </div>

            {inlineView === 'presets' && (
              <SoundFontList
                activeChannel={activeChannel}
                channelAssignments={channels.assignments}
                onAssignProgram={handlePresetSelected}
                instruments={instruments}
                channelBanks={channels.banks ?? {}}
                hasLibrary={hasLibrary}
                showLibraryName={library.activeIds.length > 1}
                onOpenLibrary={() => setInlineView('library')}
              />
            )}

            {inlineView === 'library' && (
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <SoundFontLibraryPanel
                  library={library}
                  onToggle={handleActivate}
                  onMove={handleMove}
                  onRemove={handleRemove}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {(popupMode === 'effects' || popupMode === 'timbre' || popupMode === 'system') && (
        <Popup
          title={`${tr('Configurações')} • ${tr(popupMode === 'effects' ? 'EFEITOS' : popupMode === 'timbre' ? 'TIMBRE' : 'SISTEMA')} • CH ${String(configChannel).padStart(2, '0')}`}
          onClose={() => setPopupMode(null)}
          widthClass="max-w-2xl"
        >
          <SynthSettingsPanel
            settings={panelSettings(configChannel)}
            onUpdateSetting={updateConfigSetting}
            onReset={handleResetChannel}
            channel={configChannel}
            onChannelChange={setConfigChannel}
            defaultTab={popupMode === 'effects' ? 'fx' : popupMode === 'timbre' ? 'sound' : 'system'}
          />
        </Popup>
      )}

      {selectedPresetForChannel && (
        <Popup title={tr('Aplicar preset ao canal')} onClose={() => setSelectedPresetForChannel(null)} widthClass="max-w-sm">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr('Preset selecionado')}</p>
              <p className="mt-1 text-sm font-bold text-[var(--nexus-primary)]">{selectedPresetForChannel.name}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {selectedPresetForChannel.libraryName} • PRG {selectedPresetForChannel.programNumber}
                {selectedPresetForChannel.isDrum ? ' • Bateria' : ''}
              </p>
            </div>

            <p className="text-xs text-[var(--text-muted)]">{tr('Selecione o canal MIDI:')}</p>
            <ChannelGrid value={activeChannel} onSelect={applyPresetToChannel} />
          </div>
        </Popup>
      )}

      {isDeleteModalOpen && (
        <Popup title={tr('Apagar Cenas')} onClose={() => setIsDeleteModalOpen(false)} widthClass="max-w-sm">
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">{tr('Selecione as cenas que deseja apagar:')}</p>

            <div className="grid grid-cols-2 gap-2">
              {SCENES.map((scene) => {
                const hasData = !!scenes[scene];
                const isSelected = scenesToDelete.includes(scene);

                return (
                  <button
                    key={scene}
                    type="button"
                    disabled={!hasData}
                    onClick={() => toggleSceneSelection(scene)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      !hasData ? 'opacity-40 cursor-not-allowed bg-[var(--bg-app)] border-transparent' :
                      isSelected ? 'bg-[var(--nexus-danger)]/10 border-[var(--nexus-danger)]/50 text-[var(--nexus-danger)]' : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="font-bold">Cena {scene}</span>
                    {hasData && (
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-[var(--text-muted)]'}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-sm font-bold text-[var(--text-main)] hover:bg-[var(--bg-elevated)]">
                {tr('Cancelar')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteScenes}
                disabled={scenesToDelete.length === 0}
                className="flex-1 h-10 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {tr('Apagar')}
              </button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
}
