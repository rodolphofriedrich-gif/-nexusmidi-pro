import { useCallback, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import { AppHeader } from './app/components/AppHeader';
import { AppSidebar } from './app/components/AppSidebar';
import { ChannelSelectPopup } from './app/components/ChannelSelectPopup';
import {
  useAndroidBackButton,
  useLanguageAndTheme,
  useVuMeter,
  useWakeLock,
} from './app/useAppEffects';
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

type AppTab = 'play' | 'midi' | 'studio' | 'settings';

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

  // Effects extraídos para hooks especializados (ver src/app/useAppEffects.ts).
  useAndroidBackButton({
    isSidebarOpen,
    openMenu,
    isPadChannelOpen,
    showExit,
    setIsSidebarOpen,
    setOpenMenu,
    setIsPadChannelOpen,
    setShowExit,
  });
  useLanguageAndTheme(prefs.language, prefs.theme);
  useWakeLock(prefs.wakeLock);
  const vuLevel = useVuMeter();

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
