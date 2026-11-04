import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  Activity, AudioWaveform, GitBranch, LogOut, Music2, Menu, X, Usb, Bluetooth, type LucideIcon,
  RefreshCw, Plus, Play, Pause, Trash2, ChevronDown, Settings2, Maximize, Minimize, Power, LayoutGrid, SlidersHorizontal, Globe, RotateCcw
} from 'lucide-react';
import { ConnectionMenu } from './components/ConnectionMenu';
import { ExitDialog } from './components/ExitDialog';
import { MidiKeyboard, MidiKeyboardHandle } from './components/MidiKeyboard';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiPadGrid } from './components/MidiPadGrid';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiStatusBar } from './components/MidiStatusBar';
import { StatusToast } from './components/StatusToast';
import { StudioScreen } from './components/StudioScreen';
import { VuMeter } from './components/VuMeter';
import { KEYBOARD_PALETTES } from './constants/palettes';
import { useMidiDevices } from './hooks/useMidiDevices';
import { useStore } from './hooks/useStore';
import { useToast, type ToastType } from './hooks/useToast';
import { tr } from './i18n';
import { midiManager, VIRTUAL_ID } from './services/midiService';
import { NativeMidi } from './services/nativeMidi';
import { performanceEngine } from './services/performanceService';
import { prefsStore } from './services/stores';
import { synthService } from './services/synthService';

type AppTab = 'keyboard' | 'pads' | 'router' | 'studio' | 'monitor';

const NAV_ITEMS: ReadonlyArray<{ id: AppTab; Icon: LucideIcon; label: string; color: string }> = [
  { id: 'keyboard', Icon: Music2, label: 'Teclado', color: 'text-cyan-400' },
  { id: 'pads', Icon: LayoutGrid, label: 'PADS', color: 'text-indigo-400' },
  { id: 'router', Icon: GitBranch, label: 'Roteador', color: 'text-emerald-400' },
  { id: 'studio', Icon: AudioWaveform, label: 'Estúdio', color: 'text-amber-400' },
  { id: 'monitor', Icon: Activity, label: 'Monitor', color: 'text-fuchsia-400' },
];

export default function App() {
  const prefs = useStore(prefsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const { toast, showMessage, dismiss } = useToast();
  const notify = useCallback((text: string, type: ToastType = 'info', ms = 3500) => showMessage(text, type, ms), [showMessage]);
  const devices = useMidiDevices(notify);

  const [activeTab, setActiveTab] = useState<AppTab>('keyboard');
  const [openMenu, setOpenMenu] = useState<'usb' | 'ble' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);
  const [activeNotes, setActiveNotes] = useState(0);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const [sustain, setSustain] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [startOctave, setStartOctave] = useState(3);
  const [padBank, setPadBank] = useState(0);
  const keyboardRef = useRef<MidiKeyboardHandle>(null);

  const [studioTab, setStudioTab] = useState<'synth' | 'mixer' | 'tools'>('synth');
  const [isRouterRefreshing, setIsRouterRefreshing] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'RX' | 'TX'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [monitorPaused, setMonitorPaused] = useState(false);

  // BOTÃO VOLTAR DO ANDROID
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let backListener: any;
    const handleBack = () => {
      if (isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (openMenu) { setOpenMenu(null); return; }
      if (isFullscreen) { setIsFullscreen(false); return; }
      if (showExit) { setShowExit(false); return; }
      setShowExit(true);
    };
    CapApp.addListener('backButton', handleBack).then(l => { backListener = l; });
    return () => { if (backListener) backListener.remove(); };
  }, [isSidebarOpen, openMenu, isFullscreen, showExit]);

  useEffect(() => {
    document.documentElement.lang = prefs.language;
  }, [prefs.language]);

  useEffect(() => {
    let lastActivity = 0;
    const onActivity = (velocity: number) => {
      lastActivity = Date.now();
      setVuLevel(velocity);
    };
    midiManager.addActivityListener(onActivity);
    
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 150) setVuLevel(0);
    }, 200);

    return () => {
      midiManager.removeActivityListener(onActivity);
      clearInterval(interval);
    };
  }, []);

  const connectedIds = useMemo(() => new Set(devices.connected.map((d) => d.id)), [devices.connected]);
  const usbDevices = devices.destinations.filter((d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local');
  const bleDevices = devices.destinations.filter((d) => d.type === 'ble');
  const isUsbConnected = devices.connected.some((d) => d.type !== 'ble');
  const isBleConnected = devices.connected.some((d) => d.type === 'ble');
  const canPlay = devices.connected.length > 0 || devices.bleServerActive || synth.ready;

  const palette = KEYBOARD_PALETTES.find((p) => p.id === prefs.paletteId) ?? KEYBOARD_PALETTES[1];

  const handleNoteOn = useCallback((note: number) => performanceEngine.noteOn(prefsStore.get().channel, note, prefsStore.get().velocity), []);
  const handleNoteOff = useCallback((note: number) => performanceEngine.noteOff(prefsStore.get().channel, note), []);

  const handleDisabledPress = useCallback(() => {
    showMessage(keyboardEnabled ? tr('Conecte um destino MIDI ou carregue um SoundFont.') : tr('O teclado virtual está desativado.'), 'warn', 2500);
  }, [keyboardEnabled, showMessage]);

  const handleToggleSustain = useCallback(async () => {
    const next = !sustain;
    setSustain(next);
    try {
      await midiManager.sendControlChange(prefsStore.get().channel, 64, next ? 127 : 0);
      showMessage(next ? tr('Sustain Ligado') : tr('Sustain Desligado'), 'info', 1500);
    } catch (error) {
      showMessage(tr('Erro ao enviar Sustain: {message}', { message: error instanceof Error ? error.message : '' }), 'error', 2500);
    }
  }, [sustain, showMessage]);

  const handleConfirmExit = async () => {
    setShowExit(false);
    try {
      await NativeMidi.fecharApp();
    } catch {
      window.close();
    }
  };

  const toggleMenu = (menu: 'usb' | 'ble') => {
    setOpenMenu((current) => (current === menu ? null : menu));
    void devices.refresh();
  };

  const handleRefreshRouter = async () => {
    setIsRouterRefreshing(true);
    try {
      await devices.refresh();
    } finally {
      setIsRouterRefreshing(false);
    }
  };

  const addNewRoute = () => {
    midiManager.addRoute({ sourceId: VIRTUAL_ID, destinationId: devices.connected[0]?.id ?? '' });
  };

  const handleResetMixer = () => {
    window.dispatchEvent(new Event('resetMixer'));
  };

  const btnClass = "flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0f172a] text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200 active:scale-95 px-2.5 text-[10px] font-bold";
  const btnActiveClass = "border-cyan-700/50 bg-cyan-900/30 text-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.2)]";

  return (
    <div className={`nexus-app fixed inset-0 flex h-[100dvh] w-full select-none overflow-hidden font-sans antialiased ${isFullscreen ? 'is-fullscreen' : ''}`}>
      
      {isSidebarOpen && !isFullscreen && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {!isFullscreen && (
        <aside className={`fixed inset-y-0 left-0 z-[100] flex w-64 flex-col border-r border-[#1e293b] bg-[#0a0f1c] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-12 items-center justify-between px-4 border-b border-[#1e293b] shrink-0">
            <span className="text-sm font-extrabold tracking-wider text-slate-200">
              NEXUSMIDI <span className="text-cyan-400">Pro</span>
            </span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ id, Icon, label, color }) => {
                const selected = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setActiveTab(id); setIsSidebarOpen(false); setOpenMenu(null); }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${selected ? `bg-slate-800/80 ${color} font-bold` : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                  >
                    <Icon size={18} className={selected ? color : ''} />
                    <span className="text-sm">{tr(label)}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-px w-full bg-[#1e293b]" />

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 px-3">Conexões</span>
              <ConnectionMenu kind="usb" isOpen={openMenu === 'usb'} isConnected={isUsbConnected} statusLabel={isUsbConnected ? tr('Conectado') : tr('Desconectado')} devices={usbDevices} connectedIds={connectedIds} showDisconnectAll={isUsbConnected} onToggleOpen={() => toggleMenu('usb')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} />
              <ConnectionMenu kind="ble" isOpen={openMenu === 'ble'} isConnected={isBleConnected || devices.bleServerActive} statusLabel={devices.bleServerActive ? tr('Visível') : isBleConnected ? tr('Conectado') : tr('Desconectado')} devices={bleDevices} connectedIds={connectedIds} showDisconnectAll={devices.connected.length > 0 || devices.bleServerActive} onToggleOpen={() => toggleMenu('ble')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} isScanning={devices.scanningBle} isServerActive={devices.bleServerActive} onScan={() => void devices.scanBle()} onStartServer={() => void devices.startBleServer()} />
            </div>
          </div>

          <div className="p-3 border-t border-[#1e293b] shrink-0 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => prefsStore.set({ language: prefs.language === 'pt-BR' ? 'en' : 'pt-BR' })} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-slate-400 bg-slate-800/50 hover:bg-slate-800 transition-colors">
              <Globe size={16} />
              <span className="text-xs font-bold">{tr('Idioma')}</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowExit(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
              <LogOut size={16} />
              <span className="text-xs font-bold">{tr('Sair')}</span>
            </button>
          </div>
        </aside>
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {!isFullscreen && (
          <header className="relative z-[80] flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-[#1e293b] bg-[#0a0f1c] px-2 pt-[env(safe-area-inset-top)] sm:px-3">
            
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
              <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors" title={tr('Menu')}>
                <Menu size={20} />
              </button>

              {/* CONTROLES DO TECLADO */}
              {activeTab === 'keyboard' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mr-2 px-1 shrink-0 hidden sm:block">
                    Teclado
                  </h2>

                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave(v => Math.max(1, v - 1))} className={`${btnClass} w-8 text-lg`}>−</button>
                    <div className="flex h-8 min-w-[44px] items-center justify-center rounded-lg border border-[#1e293b] bg-[#0a0f1c] px-2 font-mono text-xs font-bold text-cyan-300">C{startOctave}</div>
                    <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave(v => Math.min(6, v + 1))} className={`${btnClass} w-8 text-lg`}>+</button>
                  </div>
                  <button type="button" onClick={handleToggleSustain} className={`${btnClass} ${sustain ? btnActiveClass : ''} hidden sm:flex`}><Pause size={14} /> SUSTAIN</button>

                  <button type="button" onClick={() => { setKeyboardEnabled(!keyboardEnabled); showMessage(!keyboardEnabled ? tr('Teclado Virtual Ligado') : tr('Teclado Virtual Desligado'), 'info', 1500); }} className={`${btnClass} ${keyboardEnabled ? btnActiveClass : ''} hidden md:flex`}><Power size={14} /><span className="hidden lg:inline">{keyboardEnabled ? 'ON' : 'OFF'}</span></button>
                  <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className={`${btnClass} ${isFullscreen ? 'bg-amber-600 border-amber-500 text-white' : ''} w-8 hidden md:flex`}>{isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}</button>

                  <div className="h-6 w-px bg-slate-700 shrink-0 hidden sm:block mx-1" />

                  <button type="button" onClick={() => keyboardRef.current?.openChannelPopup()} className={`${btnClass}`}>
                    <span className="text-[10px] font-bold uppercase">CH</span>
                    <span className="min-w-[16px] text-center font-mono text-xs font-bold text-cyan-300">{String(prefs.channel).padStart(2, '0')}</span>
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => keyboardRef.current?.openSettingsPopup()} className={`${btnClass} w-8`}>
                    <SlidersHorizontal size={14} />
                  </button>
                </div>
              )}

              {/* CONTROLES DO PADS */}
              {activeTab === 'pads' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mr-2 px-1 shrink-0 hidden sm:block">
                    {tr('PADS')}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#1e293b] bg-[#0a0f1c] p-0.5">
                    {[0, 1, 2, 3].map((b) => (
                      <button key={b} type="button" onClick={() => setPadBank(b)} className={`h-7 whitespace-nowrap rounded-md px-3 text-[10px] font-bold transition-colors ${padBank === b ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>{tr('BANCO {n}', { n: b + 1 })}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTROLES DO ROTEADOR */}
              {activeTab === 'router' && (
                <div className="flex items-center gap-3">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 shrink-0 hidden sm:flex">
                    <GitBranch size={16} /> {tr('Roteador MIDI Matriz')}
                  </h2>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" aria-label={tr('Atualizar lista')} onClick={() => void handleRefreshRouter()} disabled={isRouterRefreshing} className={`${btnClass} w-8`}>
                      <RefreshCw size={14} className={isRouterRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" onClick={addNewRoute} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-500">
                      <Plus size={16} /> <span className="hidden sm:inline">{tr('Nova Rota')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CONTROLES DO ESTÚDIO */}
              {activeTab === 'studio' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400 mr-2 px-1 shrink-0 hidden sm:block">{tr('Estúdio')}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setStudioTab('synth')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${studioTab === 'synth' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}><AudioWaveform size={14} /> <span className="hidden sm:inline">{tr('Sintetizador')}</span></button>
                    <button type="button" onClick={() => setStudioTab('mixer')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${studioTab === 'mixer' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}><SlidersHorizontal size={14} /> <span className="hidden sm:inline">{tr('Mixer / CC')}</span></button>
                    <button type="button" onClick={() => setStudioTab('tools')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${studioTab === 'tools' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}><Settings2 size={14} /> <span className="hidden sm:inline">{tr('Ferramentas')}</span></button>
                  </div>
                </div>
              )}

              {/* CONTROLES DO MONITOR */}
              {activeTab === 'monitor' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-fuchsia-400 shrink-0 hidden sm:block">{tr('MIDI Monitor')}</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <button type="button" onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex h-8 items-center gap-2 rounded-lg border border-slate-700 bg-[#0f172a] px-3 text-xs text-slate-300 hover:bg-slate-800">
                        {monitorFilter === 'all' ? tr('Todos') : monitorFilter === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')} <ChevronDown size={12} />
                      </button>
                      {isFilterOpen && (
                        <div className="fixed top-[60px] left-[60px] z-[999] w-40 overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a] shadow-2xl">
                          {(['all', 'RX', 'TX'] as const).map((f) => (
                            <button type="button" key={f} onClick={() => { setMonitorFilter(f); setIsFilterOpen(false); }} className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-800 ${monitorFilter === f ? 'font-bold text-fuchsia-400' : 'text-slate-300'}`}>
                              {f === 'all' ? tr('Todos') : f === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setMonitorPaused(!monitorPaused)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${monitorPaused ? 'border-amber-600/60 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-[#0f172a] text-slate-300 hover:bg-slate-800'}`}>
                      {monitorPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button type="button" onClick={() => { midiManager.clearLog(); setMonitorPaused(false); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#0f172a] text-slate-300 transition hover:bg-red-950/50 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* RESET DO MIXER NO TOPO DIREITO */}
              {activeTab === 'studio' && studioTab === 'mixer' && (
                <button type="button" onClick={handleResetMixer} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-bold text-slate-400 hover:text-white transition-colors">
                  <RotateCcw size={12} /> {tr('RESET')}
                </button>
              )}
              {isUsbConnected && (
                <div className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-900/30 text-emerald-400 border border-emerald-800/50" title="USB Conectado">
                  <Usb size={14} />
                </div>
              )}
              {(isBleConnected || devices.bleServerActive) && (
                <div className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-900/30 text-emerald-400 border border-emerald-800/50" title="Bluetooth Conectado">
                  <Bluetooth size={14} />
                </div>
              )}
            </div>
          </header>
        )}

        {showExit && <ExitDialog onCancel={() => setShowExit(false)} onConfirm={() => void handleConfirmExit()} />}
        <StatusToast toast={toast} onClose={dismiss} />

        <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {activeTab === 'keyboard' && (
            <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
                <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                  <MidiKeyboard
                    ref={keyboardRef}
                    startOctave={startOctave}
                    isConnected={canPlay}
                    selectedChannel={prefs.channel}
                    onSelectChannel={(channel) => { prefsStore.set({ channel }); showMessage(tr('Canal: {n}', { n: channel }), 'info', 1500); }}
                    onNoteOn={handleNoteOn}
                    onNoteOff={handleNoteOff}
                    onDisabledPress={handleDisabledPress}
                    customWhiteKeyColor={palette.white}
                    customBlackKeyColor={palette.black}
                    onActiveNotesChange={setActiveNotes}
                    isActive={keyboardEnabled}
                    isSustainActive={sustain}
                    onToggleSustain={handleToggleSustain}
                    selectedVelocity={prefs.velocity}
                    onSelectVelocity={(velocity) => prefsStore.set({ velocity })}
                    selectedPaletteId={prefs.paletteId}
                    onSelectPalette={(paletteId) => prefsStore.set({ paletteId })}
                    onPitchBend={(val) => void midiManager.sendPitchBend(prefs.channel, val)}
                    onModWheel={(val) => void midiManager.sendControlChange(prefs.channel, 1, val)}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                  />
                </div>
                {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
              </div>
              {!isFullscreen && <MidiStatusBar connectedCount={devices.connected.length} canPlay={canPlay} activeNotes={activeNotes} />}
            </div>
          )}

          {activeTab === 'pads' && (
            <div className="nexus-pads-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
                <div className="flex min-h-0 flex-1 flex-col">
                  <MidiPadGrid bank={padBank} isActive={keyboardEnabled} isConnected={canPlay} onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} onDisabledPress={handleDisabledPress} isFullscreen={isFullscreen} />
                </div>
                {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
              </div>
            </div>
          )}

          {activeTab === 'router' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              <MidiRouterScreen destinations={devices.destinations} connectedDestinations={devices.connected} onRefresh={devices.refresh} isRefreshing={isRouterRefreshing} />
            </div>
          )}

          {activeTab === 'studio' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              <StudioScreen activeTab={studioTab} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
            </div>
          )}

          {activeTab === 'monitor' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              <MidiMonitorScreen filter={monitorFilter} paused={monitorPaused} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
