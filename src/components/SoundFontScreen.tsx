import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { Library, List, UploadCloud, X, Settings2, Trash2, SlidersHorizontal, Wand2, Cpu } from 'lucide-react';
import { channelColor } from '../constants/channelColors';
import { categoryOfProgram } from '../constants/gm';
import { useStore } from '../hooks/useStore';
import type { ToastType } from '../hooks/useToast';
import { tr } from '../i18n';
import { soundFontLibrary } from '../services/soundFontLibrary';
import { channelsStore, prefsStore, synthSettingsStore } from '../services/stores';
import type { SynthSettings } from '../services/synthTypes';
import { DEFAULT_SYNTH_SETTINGS } from '../services/synthTypes';
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
type PopupMode = 'presets' | 'library' | ConfigTab | null;

const SCENES = ['A', 'B', 'C', 'D', 'E', 'F'];
const SCENES_KEY = 'nexusmidi_studio_scenes';
const CHANNEL_SETTINGS_KEY = 'nexusmidi_channel_settings';

function Popup({ title, onClose, children, widthClass = 'max-w-2xl' }: { title: string; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl`}>
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
  const list = Array.from({ length: 8 }, (_, i) => page * 8 + 1 + i);

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr('Canais MIDI')}</span>
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
          <button type="button" disabled={page === 0} onClick={() => setPage(0)} className="px-2 disabled:opacity-30">‹</button>
          {page * 8 + 1}-{page * 8 + 8}
          <button type="button" disabled={page === 1} onClick={() => setPage(1)} className="px-2 disabled:opacity-30">›</button>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {list.map((ch) => {
          const isActive = ch === activeChannel;
          return (
            <div key={ch} className={`flex flex-col items-center gap-1 rounded-lg border bg-[var(--bg-app)] p-1 ${isActive ? 'border-rose-400/70' : 'border-[var(--border-color)]'}`}>
              <button
                type="button"
                onClick={() => onSelect(ch)}
                className="flex h-8 w-full items-center justify-center rounded-md text-sm font-bold"
                style={isActive ? { backgroundColor: channelColor(ch), color: '#121316' } : { color: channelColor(ch) }}
              >
                {ch}
              </button>
              <button type="button" onClick={() => onToggleMute(ch)}
                className={`h-8 w-full rounded-md text-xs font-bold ${muted[ch] ? 'bg-red-600 text-white' : 'bg-[#23262D] text-slate-200'}`}>M</button>
              <button type="button" onClick={() => onToggleSolo(ch)}
                className={`h-8 w-full rounded-md text-xs font-bold ${solo === ch ? 'bg-amber-500 text-black' : 'bg-[#23262D] text-slate-200'}`}>S</button>
            </div>
          );
        })}
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
                ? 'border-cyan-600/60 bg-cyan-500/20 font-bold text-cyan-400'
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
  const settings = useStore(synthSettingsStore);
  const channels = useStore(channelsStore);
  const prefs = useStore(prefsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  const activeChannel = prefs.channel;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = library.busy || synth.loading;

  // ---- Popups principais ----
  const [popupMode, setPopupMode] = useState<PopupMode>(null);
  const [selectedPresetForChannel, setSelectedPresetForChannel] = useState<SoundFontPreset | null>(null);

  // ---- Config por canal ----
  const [channelSettings, setChannelSettings] = useState<Record<number, SynthSettings>>(() => {
    try {
      const saved = localStorage.getItem(CHANNEL_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [configChannel, setConfigChannel] = useState<number>(activeChannel);

  useEffect(() => {
    try { localStorage.setItem(CHANNEL_SETTINGS_KEY, JSON.stringify(channelSettings)); } catch { /* */ }
  }, [channelSettings]);

  // ---- Cenas ----
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

  // Sincroniza o snapshot do canal ativo sempre que muda de canal
  useEffect(() => {
    const snapshot = channelSettings[activeChannel];
    if (snapshot) {
      synthSettingsStore.set(snapshot);
    }
  }, [activeChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Instruments Memo ----
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

  // ---- Helpers de config por canal ----
  const getChannelSettings = (ch: number): SynthSettings =>
    channelSettings[ch] ?? DEFAULT_SYNTH_SETTINGS;

  const updateSetting = (key: keyof SynthSettings, value: number) => {
    const ch = activeChannel;
    synthSettingsStore.set({ [key]: value });
    setChannelSettings((prev) => ({
      ...prev,
      [ch]: { ...(prev[ch] ?? synthSettingsStore.get()), [key]: value },
    }));
  };

  const updateConfigSetting = (key: keyof SynthSettings, value: number) => {
    const ch = configChannel;
    const current = channelSettings[ch] ?? DEFAULT_SYNTH_SETTINGS;
    const updated = { ...current, [key]: value };
    setChannelSettings((prev) => ({ ...prev, [ch]: updated }));
    if (ch === activeChannel) {
      synthSettingsStore.set({ [key]: value });
    }
  };

  const handleResetChannel = () => {
    const ch = configChannel;
    setChannelSettings((prev) => ({ ...prev, [ch]: DEFAULT_SYNTH_SETTINGS }));
    if (ch === activeChannel) {
      synthSettingsStore.set(DEFAULT_SYNTH_SETTINGS);
    }
    onStatus(tr('Configurações do canal {ch} restauradas.', { ch }), 'info');
  };

  // ---- Ações de biblioteca / import ----
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
    if (await soundFontLibrary.toggle(id)) {
      onStatus(tr('SoundFont alterado!'), 'success');
    }
  };

  const handleRemove = async (id: string) => {
    await soundFontLibrary.remove(id);
    onStatus(tr('SoundFont removido da biblioteca.'), 'info');
  };

  const handleMove = (id: string, delta: -1 | 1) => soundFontLibrary.move(id, delta);

  // ---- Preset: seleção abre diálogo de canal ----
  const handlePresetSelected = (preset: SoundFontPreset) => {
    setSelectedPresetForChannel(preset);
  };

  const applyPresetToChannel = (ch: number) => {
    if (!selectedPresetForChannel) return;
    if (!synth.ready) {
      onStatus(tr('Importe um arquivo SF2 primeiro.'), 'warn');
      return;
    }
    synthService.programChange(selectedPresetForChannel.programNumber, ch);
    channelsStore.set((s) => ({
      ...s,
      assignments: { ...s.assignments, [ch]: selectedPresetForChannel.programNumber },
      banks: { ...s.banks, [ch]: selectedPresetForChannel.bankNumber },
    }));
    onStatus(tr('Preset aplicado ao canal {ch}.', { ch }), 'success');
    setSelectedPresetForChannel(null);
    setPopupMode(null);
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

  // ---- Cenas ----
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

  const toggleSceneSelection = (scene: string) => {
    setScenesToDelete((prev) => (prev.includes(scene) ? prev.filter((s) => s !== scene) : [...prev, scene]));
  };

  const confirmDeleteScenes = () => {
    if (scenesToDelete.length === 0) { setIsDeleteModalOpen(false); return; }
    const newScenes = { ...scenes };
    scenesToDelete.forEach((s) => delete newScenes[s]);
    setScenes(newScenes);
    localStorage.setItem(SCENES_KEY, JSON.stringify(newScenes));
    if (scenesToDelete.includes(activeScene)) {
      const firstAvailable = SCENES.find((s) => newScenes[s]) || 'A';
      setActiveScene(firstAvailable);
    }
    onStatus(tr('Cenas apagadas com sucesso.'), 'info');
    setIsDeleteModalOpen(false);
    setScenesToDelete([]);
  };

  const tabClass = (mode: string, active: string) =>
    `flex h-8 items-center justify-center gap-1.5 px-4 text-xs font-bold rounded-lg transition-colors ${popupMode === mode ? active : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;

  const configBtnClass = (mode: ConfigTab, color: string) =>
    `flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors ${
      popupMode === mode
        ? `bg-${color}-600/20 border-${color}-500/50 text-${color}-400`
        : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
    }`;

  return (
    <div className="flex w-full flex-1 flex-row gap-2 overflow-hidden bg-[var(--bg-app)] p-2 text-[var(--text-main)]">
      {/* COLUNA ESQUERDA */}
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

      {/* COLUNA DIREITA */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 min-h-0 h-full">
        <div className="mb-2 flex shrink-0 flex-col gap-2 border-b border-[var(--border-color)] pb-2">
          {/* Linha 1: Cenas */}
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
              {SCENES.map((s) => (
                <button key={s} type="button" onClick={() => loadScene(s)}
                  className={`flex h-8 flex-1 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${activeScene === s ? 'bg-amber-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-500/70 hover:bg-red-900/20 hover:text-red-400 transition-colors ml-1"
                title={tr('Apagar Cenas')}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <button type="button" onClick={saveScene} className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 text-xs font-bold text-amber-500 hover:bg-amber-900/40">
              {tr('Salvar Cena')}
            </button>
          </div>

          {/* Linha 2: Presets e Biblioteca (abrem popups) */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
              <button type="button" onClick={() => setPopupMode('presets')}
                className={tabClass('presets', 'bg-cyan-600 text-white')}>
                <List size={14} /> PRESETS
              </button>
              <button type="button" onClick={() => setPopupMode('library')}
                className={tabClass('library', 'bg-cyan-600 text-white')}>
                <Library size={14} /> BIBLIOTECA
              </button>
            </div>
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}
              className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
              <UploadCloud size={14} /> {busy ? '...' : 'Importar SF2'}
            </button>
          </div>

          {/* Linha 3: Efeitos, Timbre, Sistema */}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('effects'); }}
              className={configBtnClass('effects', 'fuchsia')}>
              <SlidersHorizontal size={14} /> {tr('EFEITOS')}
            </button>
            <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('timbre'); }}
              className={configBtnClass('timbre', 'amber')}>
              <Wand2 size={14} /> {tr('TIMBRE')}
            </button>
            <button type="button" onClick={() => { setConfigChannel(activeChannel); setPopupMode('system'); }}
              className={configBtnClass('system', 'emerald')}>
              <Cpu size={14} /> {tr('SISTEMA')}
            </button>
          </div>
        </div>

        {/* Área abaixo dos botões - dica de uso */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border-color)] p-6 text-center">
          <Settings2 size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            {tr('Abra PRESETS para escolher um instrumento ou BIBLIOTECA para gerenciar seus SoundFonts.')}
          </p>
          {hasLibrary && (
            <p className="text-[11px] text-emerald-500">
              {instruments.length} {tr('instrumentos disponíveis')}
            </p>
          )}
        </div>
      </div>

      {/* ============ POPUP: PRESETS ============ */}
      {popupMode === 'presets' && (
        <Popup title={tr('PRESETS')} onClose={() => setPopupMode(null)} widthClass="max-w-4xl">
          <SoundFontList
            activeChannel={activeChannel}
            channelAssignments={channels.assignments}
            onAssignProgram={handlePresetSelected}
            instruments={instruments}
            channelBanks={channels.banks ?? {}}
            hasLibrary={hasLibrary}
            showLibraryName={library.activeIds.length > 1}
            onOpenLibrary={() => setPopupMode('library')}
          />
        </Popup>
      )}

      {/* ============ POPUP: BIBLIOTECA ============ */}
      {popupMode === 'library' && (
        <Popup title={tr('BIBLIOTECA')} onClose={() => setPopupMode(null)} widthClass="max-w-2xl">
          <SoundFontLibraryPanel
            library={library}
            onToggle={handleActivate}
            onMove={handleMove}
            onRemove={handleRemove}
          />
        </Popup>
      )}

            {/* ============ POPUPS: EFEITOS / TIMBRE / SISTEMA ============ */}
      {(popupMode === 'effects' || popupMode === 'timbre' || popupMode === 'system') && (
        <Popup
          title={`${tr('Configurações')} • ${tr(popupMode === 'effects' ? 'EFEITOS' : popupMode === 'timbre' ? 'TIMBRE' : 'SISTEMA')} • CH ${String(configChannel).padStart(2, '0')}`}
          onClose={() => setPopupMode(null)}
          widthClass="max-w-2xl"
        >
          <div className="flex flex-col gap-4">
            {/* Seletor de canal */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {tr('Canal MIDI a editar')}
              </p>
              <ChannelGrid value={configChannel} onSelect={setConfigChannel} />
            </div>

            {/* Painel de configurações do canal selecionado */}
            <SynthSettingsPanel
              settings={getChannelSettings(configChannel)}
              onUpdateSetting={updateConfigSetting}
              onReset={handleResetChannel}
              defaultTab={popupMode === 'effects' ? 'fx' : popupMode === 'timbre' ? 'sound' : 'system'}
            />
          </div>
        </Popup>
      )}

      {/* ============ DIÁLOGO: ESCOLHER CANAL PARA O PRESET ============ */}
      {selectedPresetForChannel && (
        <Popup title={tr('Aplicar preset ao canal')} onClose={() => setSelectedPresetForChannel(null)} widthClass="max-w-sm">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr('Preset selecionado')}</p>
              <p className="mt-1 text-sm font-bold text-cyan-400">{selectedPresetForChannel.name}</p>
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

      {/* ============ MODAL: APAGAR CENAS ============ */}
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
                      isSelected ? 'bg-red-900/20 border-red-600/50 text-red-400' : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="font-bold">Cena {scene}</span>
                    {hasData && (
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-500'}`}>
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
