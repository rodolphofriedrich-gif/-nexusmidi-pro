import { applyTheme, subscribeSystemTheme } from './lib/applyTheme';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  Activity, AudioWaveform, GitBranch, LogOut, Music2, Menu, X, Usb, Bluetooth, type LucideIcon,
  RefreshCw, Plus, Play, Pause, Trash2, ChevronDown, Settings2, Power, LayoutGrid, SlidersHorizontal, Globe, Moon, Sun, SunDim, Monitor, Lock, Unlock, ShieldAlert
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
import { useMidiDevices } from './hooks/useMidiDevices';
import { useStore } from './hooks/useStore';
import { useToast, type ToastType } from './hooks/useToast';
import { tr } from './i18n';
import { midiManager, VIRTUAL_ID } from './services/midiService';
import { NativeMidi } from './services/nativeMidi';
import { performanceEngine } from './services/performanceService';
import { prefsStore } from './services/stores';
import { synthService } from './services/synthService';
import { acquireWakeLock, releaseWakeLock, isWakeLockSupported } from './services/wakeLockService';

type AppTab = 'keyboard' | 'pads' | 'router' | 'studio' | 'monitor';

const NAV_ITEMS: ReadonlyArray<{ id: AppTab; Icon: LucideIcon; label: string; color: string }> = [
  { id: 'keyboard', Icon: Music2, label: 'Teclado', color: 'text-[var(--nexus-primary)]' },
  { id: 'pads', Icon: LayoutGrid, label: 'PADS', color: 'text-[var(--nexus-primary)]' },
  { id: 'router', Icon: GitBranch, label: 'Roteador', color: 'text-[var(--nexus-primary)]' },
  { id: 'studio', Icon: AudioWaveform, label: 'Estúdio', color: 'text-[var(--nexus-primary)]' },
  { id: 'monitor', Icon: Activity, label: 'Monitor', color: 'text-[var(--nexus-primary)]' },
];

function ChannelSelectPopup({ title, value, onSelect, onClose }: { title: string; value: number; onSelect: (ch: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">{title}</h3>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4">
          {Array.from({ length: 16 }, (_, i) => {
            const ch = i + 1;
            const selected = value === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => { onSelect(ch); onClose(); }}
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
      </div>
    </div>
  );
}

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
  const [isPadEditMode, setIsPadEditMode] = useState(false);
  const [isPadChannelOpen, setIsPadChannelOpen] = useState(false);

  const [startOctave, setStartOctave] = useState(3);
  const [padBank, setPadBank] = useState(0);
  const keyboardRef = useRef<MidiKeyboardHandle>(null);

  const [studioTab, setStudioTab] = useState<'synth' | 'mixer' | 'tools'>('synth');
  const [isRouterRefreshing, setIsRouterRefreshing] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'RX' | 'TX'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 60, left: 8 });
  const [monitorPaused, setMonitorPaused] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let backListener: any;
    const handleBack = () => {
      if (isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (openMenu) { setOpenMenu(null); return; }
      if (isPadChannelOpen) { setIsPadChannelOpen(false); return; }
      if (showExit) { setShowExit(false); return; }
      setShowExit(true);
    };
    CapApp.addListener('backButton', handleBack).then(l => { backListener = l; });
    return () => { if (backListener) backListener.remove(); };
  }, [isSidebarOpen, openMenu, isPadChannelOpen, showExit]);

  useEffect(() => {
    document.documentElement.lang = prefs.language;
  }, [prefs.language]);

// Reage à troca Dark/Light/Auto. Em 'system', também escuta mudança de preferência do SO.
useEffect(() => {
  applyTheme(prefs.theme);
  if (prefs.theme !== 'system') return;
  return subscribeSystemTheme(() => applyTheme('system'));
}, [prefs.theme]);
  
  // Wake Lock: mantém a tela acesa enquanto a preferência estiver ligada.
  // Re-adquire automaticamente quando o app volta a ficar visível.
  useEffect(() => {
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;
      if (prefs.wakeLock) void acquireWakeLock();
      else void releaseWakeLock();
    };

    apply();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && prefs.wakeLock) void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void releaseWakeLock();
    };
  }, [prefs.wakeLock]);

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

  const handleNoteOn = useCallback((note: number, channel: number, velocity?: number) => performanceEngine.noteOn(channel, note, velocity ?? prefsStore.get().velocity), []);
  const handleNoteOff = useCallback((note: number, channel: number) => performanceEngine.noteOff(channel, note), []);

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

  const handlePanic = useCallback(async () => {
    try {
      await midiManager.sendPanic();
      showMessage(tr('MIDI Panic enviado'), 'info', 1500);
    } catch {
      showMessage(tr('Falha no MIDI Panic'), 'error', 2500);
    }
  }, [showMessage]);

  const handleToggleWakeLock = useCallback(() => {
    const next = !prefs.wakeLock;
    prefsStore.set({ wakeLock: next });
    if (next) {
      if (!isWakeLockSupported()) {
        showMessage(tr('Este dispositivo não suporta manter a tela acesa'), 'warn', 2500);
      } else {
        showMessage(tr('Tela sempre acesa'), 'info', 1500);
      }
    } else {
      showMessage(tr('Tela pode apagar'), 'info', 1500);
    }
  }, [prefs.wakeLock, showMessage]);

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

  const btnClass = "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] active:scale-95 px-3 text-xs font-bold";
  const btnActiveClass = "border-indigo-500/40 bg-indigo-500/15 text-[var(--nexus-primary)] shadow-[0_0_8px_rgba(99,102,241,0.15)]";

  return (
    <div className="nexus-app fixed inset-0 flex h-[100dvh] w-full select-none overflow-hidden font-sans antialiased bg-[var(--bg-app)] text-[var(--text-main)]">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[100] flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border-color)] shrink-0">
          <span className="text-sm font-extrabold tracking-wider text-[var(--text-main)]">
            NEXUSMIDI <span className="text-[var(--nexus-accent)]">Pro</span>
          </span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ id, Icon, label }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); setIsSidebarOpen(false); setOpenMenu(null); }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${selected ? 'bg-indigo-500/15 text-[var(--nexus-primary)] font-bold' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'}`}
                >
                  <Icon size={20} className={selected ? 'text-[var(--nexus-primary)]' : ''} />
                  <span className="text-sm">{tr(label)}</span>
                </button>
              );
            })}
          </div>

          <div className="h-px w-full bg-[var(--border-color)]" />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)] px-3">{tr('Conexões')}</span>
            <ConnectionMenu kind="usb" isOpen={openMenu === 'usb'} isConnected={isUsbConnected} statusLabel={isUsbConnected ? tr('Conectado') : tr('Desconectado')} devices={usbDevices} connectedIds={connectedIds} showDisconnectAll={isUsbConnected} onToggleOpen={() => toggleMenu('usb')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} />
            <ConnectionMenu kind="ble" isOpen={openMenu === 'ble'} isConnected={isBleConnected || devices.bleServerActive} statusLabel={devices.bleServerActive ? tr('Visível') : isBleConnected ? tr('Conectado') : tr('Desconectado')} devices={bleDevices} connectedIds={connectedIds} showDisconnectAll={devices.connected.length > 0 || devices.bleServerActive} onToggleOpen={() => toggleMenu('ble')} onRefresh={() => void devices.refresh()} onToggleDevice={(d) => void devices.toggleConnect(d)} onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }} isScanning={devices.scanningBle} isServerActive={devices.bleServerActive} onScan={() => void devices.scanBle()} onStartServer={() => void devices.startBleServer()} />
          </div>
          
          <div className="h-px w-full bg-[var(--border-color)]" />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)] px-3">{tr('Aparência')}</span>
            <div className="grid grid-cols-3 gap-1 bg-[var(--bg-app)] p-1 rounded-lg border border-[var(--border-color)]">
              <button onClick={() => prefsStore.set({ theme: 'dark' })} className={`flex flex-col items-center justify-center py-2.5 rounded-md transition-all ${prefs.theme === 'dark' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                <Moon size={16} className={prefs.theme === 'dark' ? 'text-white' : ''} /><span className="text-[10px] font-bold mt-1">Dark</span>
              </button>
              <button onClick={() => prefsStore.set({ theme: 'light' })} className={`flex flex-col items-center justify-center py-2.5 rounded-md transition-all ${prefs.theme === 'light' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                <Sun size={16} className={prefs.theme === 'light' ? 'text-white' : ''} /><span className="text-[10px] font-bold mt-1">Light</span>
              </button>
              <button onClick={() => prefsStore.set({ theme: 'system' })} className={`flex flex-col items-center justify-center py-2.5 rounded-md transition-all ${prefs.theme === 'system' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                <Monitor size={16} className={prefs.theme === 'system' ? 'text-white' : ''} /><span className="text-[10px] font-bold mt-1">Auto</span>
              </button>
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

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="nexus-header-pad relative z-[80] flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] pt-[env(safe-area-inset-top)]">
          
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
            <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors" title={tr('Menu')}>
              <Menu size={22} />
            </button>

            {activeTab === 'keyboard' && (
              <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">
                  {tr('Teclado')}
                </h2>

                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave(v => Math.max(1, v - 1))} className={`${btnClass} w-10 text-lg`}>−</button>
                  <div className="flex h-10 min-w-[44px] items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 font-mono text-sm font-bold text-[var(--nexus-primary)]">C{startOctave}</div>
                  <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave(v => Math.min(6, v + 1))} className={`${btnClass} w-10 text-lg`}>+</button>
                </div>
                <button type="button" onClick={handleToggleSustain} className={`${btnClass} ${prefs.sustain ? btnActiveClass : ''} hidden sm:flex`}><Pause size={16} /> SUSTAIN</button>

                <button type="button" onClick={() => { setKeyboardEnabled(!keyboardEnabled); showMessage(!keyboardEnabled ? tr('Teclado Virtual Ligado') : tr('Teclado Virtual Desligado'), 'info', 1500); }} className={`${btnClass} ${keyboardEnabled ? btnActiveClass : ''} hidden md:flex`}><Power size={16} /><span className="hidden lg:inline">{keyboardEnabled ? 'ON' : 'OFF'}</span></button>

                <div className="h-6 w-px bg-[var(--border-color)] shrink-0 hidden sm:block mx-1" />

                <button type="button" onClick={() => keyboardRef.current?.openChannelPopup()} className={`${btnClass}`}>
                  <span className="text-xs font-bold uppercase">CH</span>
                  <span className="min-w-[16px] text-center font-mono text-sm font-bold text-[var(--nexus-primary)]">{String(prefs.channel).padStart(2, '0')}</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={() => keyboardRef.current?.openSettingsPopup()} className={`${btnClass} w-10`}>
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            )}

            {activeTab === 'pads' && (
              <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">
                  {tr('PADS')}
                </h2>
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
                  {[0, 1, 2, 3].map((b) => (
                    <button key={b} type="button" onClick={() => setPadBank(b)} className={`h-9 whitespace-nowrap rounded-md px-4 text-xs font-bold transition-all ${padBank === b ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'}`}>{tr('BANCO {n}', { n: b + 1 })}</button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 ml-2">
                  <button type="button" onClick={() => setIsPadChannelOpen(true)} className={`${btnClass}`}>
                    <span className="text-xs font-bold uppercase">CH</span>
                    <span className="min-w-[16px] text-center font-mono text-sm font-bold text-[var(--nexus-primary)]">{String(prefs.padsChannel).padStart(2, '0')}</span>
                    <ChevronDown size={14} />
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => setIsPadEditMode(!isPadEditMode)} 
                    className={`${btnClass} ${isPadEditMode ? btnActiveClass : ''} w-10`}
                    title={tr('Modo de Edição dos Pads')}
                  >
                    {isPadEditMode ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'router' && (
              <div className="flex items-center gap-3 lg:flex-1 lg:justify-center">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--nexus-primary)] shrink-0 hidden sm:flex">
                  <GitBranch size={18} /> {tr('Roteador MIDI Matriz')}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" aria-label={tr('Atualizar lista')} onClick={() => void handleRefreshRouter()} disabled={isRouterRefreshing} className={`${btnClass} w-10`}>
                    <RefreshCw size={16} className={isRouterRefreshing ? 'animate-spin' : ''} />
                  </button>
                  <button type="button" onClick={addNewRoute} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 h-10 text-xs font-bold text-white shadow-lg shadow-black/20 transition hover:bg-indigo-500">
                    <Plus size={18} /> <span className="hidden sm:inline">{tr('Nova Rota')}</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'studio' && (
              <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">{tr('Estúdio')}</h2>
                <div className="flex items-center gap-1 shrink-0 bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-color)]">
                  <button type="button" onClick={() => setStudioTab('synth')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'synth' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><AudioWaveform size={16} /> <span className="hidden sm:inline">{tr('Sintetizador')}</span></button>
                  <button type="button" onClick={() => setStudioTab('mixer')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'mixer' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><SlidersHorizontal size={16} /> <span className="hidden sm:inline">{tr('Mixer / CC')}</span></button>
                  <button type="button" onClick={() => setStudioTab('tools')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'tools' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><Settings2 size={16} /> <span className="hidden sm:inline">{tr('Ferramentas')}</span></button>
                </div>
              </div>
            )}

            {activeTab === 'monitor' && (
              <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--nexus-primary)] shrink-0 hidden sm:block">{tr('MIDI Monitor')}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setFilterPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 184)) });
                        setIsFilterOpen(!isFilterOpen);
                      }}
                      className={`${btnClass} h-10`}
                    >
                      {monitorFilter === 'all' ? tr('Todos') : monitorFilter === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')} <ChevronDown size={14} />
                    </button>
                    {isFilterOpen && (
                      <div style={{ top: filterPos.top, left: filterPos.left }} className="fixed z-[999] w-44 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
                        {(['all', 'RX', 'TX'] as const).map((f) => (
                          <button type="button" key={f} onClick={() => { setMonitorFilter(f); setIsFilterOpen(false); }} className={`w-full px-3 py-3 text-left text-xs hover:bg-[var(--bg-elevated)] ${monitorFilter === f ? 'font-bold text-[var(--nexus-primary)] bg-indigo-500/10' : 'text-[var(--text-main)]'}`}>
                            {f === 'all' ? tr('Todos') : f === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setMonitorPaused(!monitorPaused)} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${monitorPaused ? 'border-amber-600/60 bg-amber-900/30 text-amber-500' : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
                    {monitorPaused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                  <button type="button" onClick={() => { midiManager.clearLog(); setMonitorPaused(false); }} className={`${btnClass} w-10 hover:bg-red-950/50 hover:text-red-500`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleToggleWakeLock}
              title={prefs.wakeLock ? tr('Tela sempre acesa') : tr('Tela pode apagar')}
              aria-label={prefs.wakeLock ? tr('Tela sempre acesa') : tr('Tela pode apagar')}
              aria-pressed={prefs.wakeLock}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                prefs.wakeLock
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-[var(--nexus-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {prefs.wakeLock ? <Sun size={18} /> : <SunDim size={18} />}
            </button>

            <button
              type="button"
              onClick={handlePanic}
              title={tr('MIDI Panic')}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-800/60 bg-red-950/40 text-red-500 transition hover:bg-red-900/60"
            >
              <ShieldAlert size={18} />
            </button>

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

        {showExit && <ExitDialog onCancel={() => setShowExit(false)} onConfirm={() => void handleConfirmExit()} />}
        <StatusToast toast={toast} onClose={dismiss} />

        {isPadChannelOpen && (
          <ChannelSelectPopup
            title={tr('Canal dos Pads')}
            value={prefs.padsChannel}
            onSelect={(ch) => { prefsStore.set({ padsChannel: ch }); showMessage(tr('Canal dos Pads: {n}', { n: ch }), 'info', 1500); }}
            onClose={() => setIsPadChannelOpen(false)}
          />
        )}

        <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg-app)]">
          {activeTab === 'keyboard' && (
            <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                <div className="py-1"><VuMeter level={vuLevel} /></div>
                <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                  <MidiKeyboard
                    ref={keyboardRef}
                    startOctave={startOctave}
                    isConnected={canPlay}
                    selectedChannel={prefs.channel}
                    onSelectChannel={(channel) => { prefsStore.set({ channel }); showMessage(tr('Canal: {n}', { n: channel }), 'info', 1500); }}
                    onNoteOn={(note) => handleNoteOn(note, prefs.channel)}
                    onNoteOff={(note) => handleNoteOff(note, prefs.channel)}
                    onDisabledPress={handleDisabledPress}
                    onActiveNotesChange={setActiveNotes}
                    isActive={keyboardEnabled}
                    isSustainActive={prefs.sustain}
                    onToggleSustain={handleToggleSustain}
                    selectedVelocity={prefs.velocity}
                    onSelectVelocity={(velocity) => prefsStore.set({ velocity })}
                    onPitchBend={(val) => void midiManager.sendPitchBend(prefs.channel, val)}
                    onModWheel={(val) => void midiManager.sendControlChange(prefs.channel, 1, val)}
                  />
                </div>
              </div>
              <MidiStatusBar connectedCount={devices.connected.length} canPlay={canPlay} activeNotes={activeNotes} />
            </div>
          )}

          {activeTab === 'pads' && (
            <div className="nexus-pads-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                <div className="py-1"><VuMeter level={vuLevel} /></div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <MidiPadGrid 
                    bank={padBank} 
                    isActive={keyboardEnabled} 
                    isConnected={canPlay} 
                    onNoteOn={(note, velocity) => handleNoteOn(note, prefs.padsChannel, velocity)} 
                    onNoteOff={(note) => handleNoteOff(note, prefs.padsChannel)} 
                    onDisabledPress={handleDisabledPress} 
                    isEditMode={isPadEditMode}
                  />
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
