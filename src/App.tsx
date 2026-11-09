import { applyTheme, subscribeSystemTheme } from './lib/applyTheme';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { X } from 'lucide-react';
import { AppHeader } from './app/components/AppHeader';
import { AppSidebar } from './app/components/AppSidebar';
import { useAppHandlers } from './app/useAppHandlers';
import { ExitDialog } from './components/ExitDialog';
import { MidiKeyboard, MidiKeyboardHandle } from './components/MidiKeyboard';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiPadGrid } from './components/MidiPadGrid';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiStatusBar } from './components/MidiStatusBar';
import { SettingsScreen } from './components/SettingsScreen';
import { StatusToast } from './components/StatusToast';
import { StudioScreen } from './components/StudioScreen';
import { VuMeter } from './components/VuMeter';
import { useMidiDevices } from './hooks/useMidiDevices';
import { useStore } from './hooks/useStore';
import { useToast, type ToastType } from './hooks/useToast';
import { tr } from './i18n';
import { midiManager } from './services/midiService';
import { prefsStore } from './services/stores';
import { synthService } from './services/synthService';
import { acquireWakeLock, releaseWakeLock } from './services/wakeLockService';

type AppTab = 'play' | 'midi' | 'studio' | 'settings';

function ChannelSelectPopup({ title, value, onSelect, onClose }: { title: string; value: number; onSelect: (ch: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">{title}</h3>
          <button type="button" aria-label={tr('Fechar')} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition hover:text-[var(--text-main)]">
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

  const [activeTab, setActiveTab] = useState<AppTab>('play');
  const [playTab, setPlayTab] = useState<'keyboard' | 'pads'>('keyboard');
  const [openMenu, setOpenMenu] = useState<'usb' | 'ble' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);
  const [activeNotes, setActiveNotes] = useState(0);
  const [isPadEditMode, setIsPadEditMode] = useState(false);
  const [isPadChannelOpen, setIsPadChannelOpen] = useState(false);

  const [startOctave, setStartOctave] = useState(3);
  const [padBank, setPadBank] = useState(0);
  const keyboardRef = useRef<MidiKeyboardHandle>(null);

  const [studioTab, setStudioTab] = useState<'synth' | 'mixer' | 'tools'>('synth');
  const [midiTab, setMidiTab] = useState<'router' | 'monitor'>('router');

  const [isRouterRefreshing, setIsRouterRefreshing] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'RX' | 'TX'>('all');
  const [monitorPaused, setMonitorPaused] = useState(false);

  const {
    handleNoteOn,
    handleNoteOff,
    handleDisabledPress,
    handleToggleSustain,
    handlePanic,
    handleConfirmExit,
    handleRefreshRouter,
    addNewRoute,
  } = useAppHandlers({
    prefs,
    showMessage,
    setShowExit,
    setIsRouterRefreshing,
    refreshDevices: devices.refresh,
    firstConnectedDeviceId: devices.connected[0]?.id,
  });

  const handleClearMonitor = useCallback(() => {
    midiManager.clearLog();
    setMonitorPaused(false);
  }, []);

  const uiStateRef = useRef({ isSidebarOpen, openMenu, isPadChannelOpen, showExit });
  useEffect(() => {
    uiStateRef.current = { isSidebarOpen, openMenu, isPadChannelOpen, showExit };
  }, [isSidebarOpen, openMenu, isPadChannelOpen, showExit]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let backListener: any;
    const handleBack = () => {
      const state = uiStateRef.current;
      if (state.isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (state.openMenu) { setOpenMenu(null); return; }
      if (state.isPadChannelOpen) { setIsPadChannelOpen(false); return; }
      if (state.showExit) { setShowExit(false); return; }
      setShowExit(true);
    };
    CapApp.addListener('backButton', handleBack).then(l => { backListener = l; });
    return () => { if (backListener) backListener.remove(); };
  }, []);

  useEffect(() => {
    document.documentElement.lang = prefs.language;
  }, [prefs.language]);

  useEffect(() => {
    applyTheme(prefs.theme);
    if (prefs.theme !== 'system') return;
    return subscribeSystemTheme(() => applyTheme('system'));
  }, [prefs.theme]);

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

  const toggleMenu = (menu: 'usb' | 'ble') => {
    setOpenMenu((current) => (current === menu ? null : menu));
    void devices.refresh();
  };

  return (
    <div className="nexus-app fixed inset-0 flex h-[100dvh] w-full select-none overflow-hidden font-sans antialiased bg-[var(--bg-app)] text-[var(--text-main)]">

      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onNavigate={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); setOpenMenu(null); }}
        openMenu={openMenu}
        onToggleConnectionMenu={toggleMenu}
        isUsbConnected={isUsbConnected}
        isBleConnected={isBleConnected}
        bleServerActive={devices.bleServerActive}
        usbDevices={usbDevices}
        bleDevices={bleDevices}
        connectedIds={connectedIds}
        connectedDeviceCount={devices.connected.length}
        scanningBle={devices.scanningBle}
        onRefresh={() => void devices.refresh()}
        onToggleDevice={(device) => void devices.toggleConnect(device)}
        onDisconnectAll={() => { setOpenMenu(null); void devices.disconnectAll(); }}
        onScanBle={() => void devices.scanBle()}
        onStartBleServer={() => void devices.startBleServer()}
        onExit={() => { setIsSidebarOpen(false); setShowExit(true); }}
      />

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <AppHeader
          activeTab={activeTab}
          onOpenSidebar={() => setIsSidebarOpen(true)}

          playTab={playTab}
          onPlayTabChange={setPlayTab}
          startOctave={startOctave}
          onStartOctaveChange={setStartOctave}
          sustain={prefs.sustain}
          onToggleSustain={handleToggleSustain}
          channel={prefs.channel}
          onOpenKeyboardChannel={() => keyboardRef.current?.openChannelPopup()}
          onOpenKeyboardSettings={() => keyboardRef.current?.openSettingsPopup()}
          padBank={padBank}
          onPadBankChange={setPadBank}
          padsChannel={prefs.padsChannel}
          onOpenPadChannel={() => setIsPadChannelOpen(true)}
          isPadEditMode={isPadEditMode}
          onTogglePadEditMode={() => setIsPadEditMode(!isPadEditMode)}

          midiTab={midiTab}
          onMidiTabChange={setMidiTab}
          studioTab={studioTab}
          onStudioTabChange={setStudioTab}

          isRouterRefreshing={isRouterRefreshing}
          onRefreshRouter={() => void handleRefreshRouter()}
          onAddNewRoute={addNewRoute}

          monitorFilter={monitorFilter}
          onMonitorFilterChange={setMonitorFilter}
          monitorPaused={monitorPaused}
          onToggleMonitorPaused={() => setMonitorPaused(!monitorPaused)}
          onClearMonitor={handleClearMonitor}

          onPanic={handlePanic}

          isUsbConnected={isUsbConnected}
          isBleConnected={isBleConnected}
          bleServerActive={devices.bleServerActive}
        />

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
          {activeTab === 'play' && playTab === 'keyboard' && (
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
                    onNoteOn={(note) => handleNoteOn(note, prefs.channel, undefined, 'keyboard')}
                    onNoteOff={(note) => handleNoteOff(note, prefs.channel, 'keyboard')}
                    onDisabledPress={handleDisabledPress}
                    onActiveNotesChange={setActiveNotes}
                    isActive={true}
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

          {activeTab === 'play' && playTab === 'pads' && (
            <div className="nexus-pads-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 pb-[env(safe-area-inset-bottom)] sm:p-1.5">
              <div className="flex min-h-0 flex-1 flex-row gap-1">
                <div className="py-1"><VuMeter level={vuLevel} /></div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <MidiPadGrid
                    bank={padBank}
                    isActive={true}
                    isConnected={canPlay}
                    onNoteOn={(note, velocity, sourceId) => handleNoteOn(note, prefs.padsChannel, velocity, sourceId)}
                    onNoteOff={(note, sourceId) => handleNoteOff(note, prefs.padsChannel, sourceId)}
                    onDisabledPress={handleDisabledPress}
                    isEditMode={isPadEditMode}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'midi' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              {midiTab === 'router' ? (
                <MidiRouterScreen destinations={devices.destinations} connectedDestinations={devices.connected} onRefresh={devices.refresh} isRefreshing={isRouterRefreshing} />
              ) : (
                <MidiMonitorScreen filter={monitorFilter} paused={monitorPaused} />
              )}
            </div>
          )}

          {activeTab === 'studio' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              <StudioScreen activeTab={studioTab} channel={prefs.channel} isConnected={canPlay} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
              <SettingsScreen onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
