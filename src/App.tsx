import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  Activity, AudioWaveform, GitBranch, LogOut, Music2, Menu, X, Usb, Bluetooth, type LucideIcon,
  RefreshCw, Plus, Play, Pause, Trash2, ChevronDown, Settings2, Maximize, Minimize, Power, LayoutGrid, SlidersHorizontal, Globe, RotateCcw, Moon, Sun, Monitor
} from 'lucide-react';
import { ConnectionMenu } from './components/ConnectionMenu';
import { ExitDialog } from './components/ExitDialog';
import { MidiKeyboard, MidiKeyboardHandle } from './components/MidiKeyboard';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { useAppFullscreen } from './hooks/useAppFullscreen';
import { MidiPadGrid } from './components/MidiPadGrid';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiStatusBar } from './components/MidiStatusBar';
import { StatusToast } from './components/StatusToast';
import { StudioScreen } from './components/StudioScreen';
import { VuMeter } from './components/VuMeter';
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
  { id: 'pads', Icon: LayoutGrid, label: 'PADS', color: 'text-cyan-400' },
  { id: 'router', Icon: GitBranch, label: 'Roteador', color: 'text-cyan-400' },
  { id: 'studio', Icon: AudioWaveform, label: 'Estúdio', color: 'text-cyan-400' },
  { id: 'monitor', Icon: Activity, label: 'Monitor', color: 'text-cyan-400' },
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
  const { isFullscreen, exit: exitFullscreen, toggle: toggleFullscreen } = useAppFullscreen();
  
  const [startOctave, setStartOctave] = useState(3);
  const [padBank, setPadBank] = useState(0);
  const keyboardRef = useRef<MidiKeyboardHandle>(null);

  const [studioTab, setStudioTab] = useState<'synth' | 'mixer' | 'tools'>('synth');
  const [isRouterRefreshing, setIsRouterRefreshing] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'RX' | 'TX'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [monitorPaused, setMonitorPaused] = useState(false);

  // Gerenciamento de Tema
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (theme: string) => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', isDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };
    applyTheme(prefs.theme || 'dark');
  }, [prefs.theme]);

  // BOTÃO VOLTAR DO ANDROID
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let backListener: any;
    const handleBack = () => {
      if (isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (openMenu) { setOpenMenu(null); return; }
      if (isFullscreen) { exitFullscreen(); return; }
      if (showExit) { setShowExit(false); return; }
      setShowExit(true);
    };
    CapApp.addListener('backButton', handleBack).then(l => { backListener = l; });
    return () => { if (backListener) backListener.remove(); };
  }, [isSidebarOpen, openMenu, isFullscreen, exitFullscreen, showExit]);

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

  const handleNoteOn = useCallback((note: number) => performanceEngine.noteOn(prefsStore.get().channel, note, prefsStore.get().velocity), []);
  const handleNoteOff = useCallback((note: number) => performanceEngine.noteOff(prefsStore.get().channel, note), []);

  const handleDisabledPress = useCallback(() => {
    showMessage(keyboardEnabled ? tr('Conecte um destino MIDI ou carregue um SoundFont.') : tr('O teclado virtual está desativado.'), 'warn', 2500);
  }, [keyboardEnabled, showMessage]);

  const handleToggleSustain = useCallback(async () => {
    const next = !prefs.sustain;
    prefsStore.set({ sustain: next });
    try {
      await midiManager.sendControlChange(prefsStore.get().channel, 64, next ? 127 : 0);
      showMessage(next ? tr('Sustain Ligado') : tr('Sustain Desligado'), 'info', 1500);
    } catch (error) {
      showMessage(tr('Erro ao enviar Sustain: {message}', { message: error instanceof Error ? error.message : '' }), 'error', 2500);
    }
  }, [prefs.sustain, showMessage]);

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

  const btnClass = "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] active:scale-95 px-3 text-xs font-bold";
  const btnActiveClass = "border-cyan-700/50 bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.2)]";

  return (
    <div className={`nexus-app fixed inset-0 flex h-[100dvh] w-full select-none overflow-hidden font-sans antialiased bg-[var(--bg-app)] text-[var(--text-main)] ${isFullscreen ? 'is-fullscreen' : ''}`}>
      
      {isSidebarOpen && !isFullscreen && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {!isFullscreen && (
        <aside className={`fixed inset-y-0 left-0 z-[100] flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border-color)] shrink-0">
            <span className="text-sm font-extrabold tracking-wider text-[var(--text-main)]">
              NEXUSMIDI <span className="text-cyan-500">Pro</span>
            </span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition">
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${selected ? `bg-cyan-900/10 dark:bg-cyan-900/20 ${color} font-bold` : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'}`}
                  >
                    <Icon size={20} className={selected ? color : ''} />
                    <span className="text-sm">{tr(label)}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-px w-full bg-[var(--border-color)]" />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)] px-3">Conexões</span>
              <ConnectionMenu kind="usb" isOpen={openMenu === 'usb'} isConnected={isUsbConnected} statusLabel={isUsbConnected ? tr('Conectado') : tr('Desconectado')} devices={usbDevices} connectedIds={connectedIds} showDisconnectAll={isUsbConnected} onToggleOpen={() => toggleMenu('usb')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} />
              <ConnectionMenu kind="ble" isOpen={openMenu === 'ble'} isConnected={isBleConnected || devices.bleServerActive} statusLabel={devices.bleServerActive ? tr('Visível') : isBleConnected ? tr('Conectado') : tr('Desconectado')} devices={bleDevices} connectedIds={connectedIds} showDisconnectAll={devices.connected.length > 0 || devices.bleServerActive} onToggleOpen={() => toggleMenu('ble')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} isScanning={devices.scanningBle} isServerActive={devices.bleServerActive} onScan={() => void devices.scanBle()} onStartServer={() => void devices.startBleServer()} />
            </div>
            
            <div className="h-px w-full bg-[var(--border-color)]" />

            {/* SELETOR DE TEMA */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)] px-3">{tr('Aparência')}</span>
              <div className="grid grid-cols-3 gap-1 bg-[var(--bg-app)] p-1 rounded-lg border border-[var(--border-color)]">
                <button onClick={() => prefsStore.set({ theme: 'dark' })} className={`flex flex-col items-center justify-center py-2 rounded-md transition ${prefs.theme === 'dark' ? 'bg-[var(--bg-panel)] shadow text-cyan-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}><Moon size={16} /><span className="text-[10px] font-bold mt-1">Dark</span></button>
                <button onClick={() => prefsStore.set({ theme: 'light' })} className={`flex flex-col items-center justify-center py-2 rounded-md transition ${prefs.theme === 'light' ? 'bg-[var(--bg-panel)] shadow text-cyan-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}><Sun size={16} /><span className="text-[10px] font-bold mt-1">Light</span></button>
                <button onClick={() => prefsStore.set({ theme: 'system' })} className={`flex flex-col items-center justify-center py-2 rounded-md transition ${prefs.theme === 'system' ? 'bg-[var(--bg-panel)] shadow text-cyan-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}><Monitor size={16} /><span className="text-[10px] font-bold mt-1">Auto</span></button>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-[var(--border-color)] shrink-0 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => prefsStore.set({ language: prefs.language === 'pt-BR' ? 'en' : 'pt-BR' })} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-3 text-[var(--text-muted)] bg-[var(--bg-app)] hover:bg-[var(--bg-elevated)] transition-colors">
              <Globe size={18} />
              <span className="text-xs font-bold">{tr('Idioma')}</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowExit(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-3 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
              <LogOut size={18} />
              <span className="text-xs font-bold">{tr('Sair')}</span>
            </button>
          </div>
        </aside>
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {!isFullscreen && (
          <header className="relative z-[80] flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-2 pt-[env(safe-area-inset-top)] sm:px-3">
            
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
              <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors" title={tr('Menu')}>
                <Menu size={22} />
              </button>

              {/* CONTROLES DO TECLADO */}
              {activeTab === 'keyboard' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-500 mr-2 px-1 shrink-0 hidden sm:block">
                    Teclado
                  </h2>

                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave(v => Math.max(1, v - 1))} className={`${btnClass} w-11 text-xl`}>−</button>
                    <div className="flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 font-mono text-sm font-bold text-cyan-500">C{startOctave}</div>
                    <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave(v => Math.min(6, v + 1))} className={`${btnClass} w-11 text-xl`}>+</button>
                  </div>
                  <button type="button" onClick={handleToggleSustain} className={`${btnClass} ${prefs.sustain ? btnActiveClass : ''} hidden sm:flex`}><Pause size={16} /> SUSTAIN</button>

                  <button type="button" onClick={() => { setKeyboardEnabled(!keyboardEnabled); showMessage(!keyboardEnabled ? tr('Teclado Virtual Ligado') : tr('Teclado Virtual Desligado'), 'info', 1500); }} className={`${btnClass} ${keyboardEnabled ? btnActiveClass : ''} hidden md:flex`}><Power size={16} /><span className="hidden lg:inline">{keyboardEnabled ? 'ON' : 'OFF'}</span></button>
                  <button type="button" onClick={toggleFullscreen} className={`${btnClass} ${isFullscreen ? 'bg-cyan-600 border-cyan-500 text-white' : ''} w-11 hidden md:flex`}>{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>

                  <div className="h-6 w-px bg-[var(--border-color)] shrink-0 hidden sm:block mx-1" />

                  <button type="button" onClick={() => keyboardRef.current?.openChannelPopup()} className={`${btnClass}`}>
                    <span className="text-xs font-bold uppercase">CH</span>
                    <span className="min-w-[16px] text-center font-mono text-sm font-bold text-cyan-500">{String(prefs.channel).padStart(2, '0')}</span>
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => keyboardRef.current?.openSettingsPopup()} className={`${btnClass} w-11`}>
                    <SlidersHorizontal size={16} />
                  </button>
                </div>
              )}

              {/* CONTROLES DO PADS */}
              {activeTab === 'pads' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-500 mr-2 px-1 shrink-0 hidden sm:block">
                    {tr('PADS')}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
                    {[0, 1, 2, 3].map((b) => (
                      <button key={b} type="button" onClick={() => setPadBank(b)} className={`h-10 whitespace-nowrap rounded-md px-4 text-xs font-bold transition-colors ${padBank === b ? 'bg-cyan-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'}`}>{tr('BANCO {n}', { n: b + 1 })}</button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={tr('Tela cheia')}
                    title={tr('Tela cheia')}
                    className={`${btnClass} w-11`}
                  >
                    <Maximize size={18} />
                  </button>
                </div>
              )}

              {/* CONTROLES DO ROTEADOR */}
              {activeTab === 'router' && (
                <div className="flex items-center gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-500 shrink-0 hidden sm:flex">
                    <GitBranch size={18} /> {tr('Roteador MIDI Matriz')}
                  </h2>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" aria-label={tr('Atualizar lista')} onClick={() => void handleRefreshRouter()} disabled={isRouterRefreshing} className={`${btnClass} w-11`}>
                      <RefreshCw size={16} className={isRouterRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" onClick={addNewRoute} className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 h-11 text-xs font-bold text-white shadow-lg shadow-black/20 transition hover:bg-cyan-500">
                      <Plus size={18} /> <span className="hidden sm:inline">{tr('Nova Rota')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CONTROLES DO ESTÚDIO */}
              {activeTab === 'studio' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-500 mr-2 px-1 shrink-0 hidden sm:block">{tr('Estúdio')}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setStudioTab('synth')} className={`flex items-center gap-2 px-4 h-11 rounded-lg text-xs font-bold transition-colors ${studioTab === 'synth' ? 'bg-cyan-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><AudioWaveform size={16} /> <span className="hidden sm:inline">{tr('Sintetizador')}</span></button>
                    <button type="button" onClick={() => setStudioTab('mixer')} className={`flex items-center gap-2 px-4 h-11 rounded-lg text-xs font-bold transition-colors ${studioTab === 'mixer' ? 'bg-cyan-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><SlidersHorizontal size={16} /> <span className="hidden sm:inline">{tr('Mixer / CC')}</span></button>
                    <button type="button" onClick={() => setStudioTab('tools')} className={`flex items-center gap-2 px-4 h-11 rounded-lg text-xs font-bold transition-colors ${studioTab === 'tools' ? 'bg-cyan-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><Settings2 size={16} /> <span className="hidden sm:inline">{tr('Ferramentas')}</span></button>
                  </div>
                </div>
              )}

              {/* CONTROLES DO MONITOR */}
              {activeTab === 'monitor' && (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-500 shrink-0 hidden sm:block">{tr('MIDI Monitor')}</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <button type="button" onClick={() => setIsFilterOpen(!isFilterOpen)} className={`${btnClass} h-11`}>
                        {monitorFilter === 'all' ? tr('Todos') : monitorFilter === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')} <ChevronDown size={14} />
                      </button>
                      {isFilterOpen && (
                        <div className="fixed top-[60px] left-[60px] z-[999] w-44 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
                          {(['all', 'RX', 'TX'] as const).map((f) => (
                            <button type="button" key={f} onClick={() => { setMonitorFilter(f); setIsFilterOpen(false); }} className={`w-full px-3 py-3 text-left text-xs hover:bg-[var(--bg-elevated)] ${monitorFilter === f ? 'font-bold text-cyan-500' : 'text-[var(--text-main)]'}`}>
                              {f === 'all' ? tr('Todos') : f === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setMonitorPaused(!monitorPaused)} className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${monitorPaused ? 'border-amber-600/60 bg-amber-900/30 text-amber-500' : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
                      {monitorPaused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button type="button" onClick={() => { midiManager.clearLog(); setMonitorPaused(false); }} className={`${btnClass} w-11 hover:bg-red-950/50 hover:text-red-500`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* RESET DO MIXER NO TOPO DIREITO */}
              {activeTab === 'studio' && studioTab === 'mixer' && (
                <button type="button" onClick={handleResetMixer} className="flex h-11 items-center gap-1.5 rounded-md px-3 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                  <RotateCcw size={14} /> {tr('RESET')}
                </button>
              )}
              {isUsbConnected && (
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-emerald-900/30 text-emerald-500 border border-emerald-800/50" title="USB Conectado">
                  <Usb size={16} />
                </div>
              )}
              {(isBleConnected || devices.bleServerActive) && (
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-emerald-900/30 text-emerald-500 border border-emerald-800/50" title="Bluetooth Conectado">
                  <Bluetooth size={16} />
                </div>
              )}
            </div>
          </header>
        )}

        {showExit && <ExitDialog onCancel={() => setShowExit(false)} onConfirm={() => void handleConfirmExit()} />}
        <StatusToast toast={toast} onClose={dismiss} />

        <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg-app)]">
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
                    onActiveNotesChange={setActiveNotes}
                    isActive={keyboardEnabled}
                    isSustainActive={prefs.sustain}
                    onToggleSustain={handleToggleSustain}
                    selectedVelocity={prefs.velocity}
                    onSelectVelocity={(velocity) => prefsStore.set({ velocity })}
                    onPitchBend={(val) => void midiManager.sendPitchBend(prefs.channel, val)}
                    onModWheel={(val) => void midiManager.sendControlChange(prefs.channel, 1, val)}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />
                </div>
                {/* VU METER DIREITO REMOVIDO */}
              </div>
              {!isFullscreen && <MidiStatusBar connectedCount={devices.connected.length} canPlay={canPlay} activeNotes={activeNotes} />}
            </div>
          )}

          {activeTab === 'pads' && (
            <div className="nexus-pads-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              {isFullscreen && (
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] p-0.5">
                    {[0, 1, 2, 3].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setPadBank(b)}
                        className={`h-11 min-w-12 whitespace-nowrap rounded-md px-3 text-sm font-bold transition-colors ${padBank === b ? 'bg-cyan-600 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'}`}
                      >
                        {b + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={exitFullscreen}
                    aria-label={tr('Sair da tela cheia')}
                    className="flex h-11 items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-4 text-sm font-bold text-white transition hover:bg-cyan-500 active:scale-95"
                  >
                    <Minimize size={16} /> {tr('Sair da tela cheia')}
                  </button>
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
                <div className="flex min-h-0 flex-1 flex-col">
                  <MidiPadGrid bank={padBank} isActive={keyboardEnabled} isConnected={canPlay} onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} onDisabledPress={handleDisabledPress} isFullscreen={isFullscreen} />
                </div>
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
              <StudioScreen activeTab={studioTab} channel={prefs.channel} isConnected={canPlay} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
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
