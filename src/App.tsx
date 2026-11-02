import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Activity, AudioWaveform, GitBranch, LogOut, Music2, SlidersHorizontal, WandSparkles, type LucideIcon, Maximize, Minimize } from 'lucide-react';
import { ConnectionMenu } from './components/ConnectionMenu';
import { ExitDialog } from './components/ExitDialog';
import { MidiKeyboard } from './components/MidiKeyboard';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiStatusBar } from './components/MidiStatusBar';
import { NavMenu, type NavItem } from './components/NavMenu';
import { StatusToast } from './components/StatusToast';
import { StudioScreen } from './components/StudioScreen'; // NOVO
import { VuMeter } from './components/VuMeter';
import { KEYBOARD_PALETTES } from './constants/palettes';
import { useMidiDevices } from './hooks/useMidiDevices';
import { useStore } from './hooks/useStore';
import { useToast, type ToastType } from './hooks/useToast';
import { tr } from './i18n';
import { midiManager } from './services/midiService';
import { NativeMidi } from './services/nativeMidi';
import { performanceEngine } from './services/performanceService';
import { prefsStore } from './services/stores';
import { synthService } from './services/synthService';

type AppTab = 'keyboard' | 'router' | 'studio' | 'monitor';

const TABS: ReadonlyArray<{ id: AppTab; Icon: LucideIcon; textClass: string }> = [
  { id: 'keyboard', Icon: Music2, textClass: 'text-blue-400' },
  { id: 'router', Icon: GitBranch, textClass: 'text-emerald-400' },
  { id: 'studio', Icon: AudioWaveform, textClass: 'text-cyan-400' }, // UNIFICADO
  { id: 'monitor', Icon: Activity, textClass: 'text-purple-400' },
];

const tabLabel = (id: AppTab): string => ({ keyboard: tr('Teclado'), router: tr('Roteador'), studio: tr('Estúdio'), monitor: tr('Monitor') })[id];
const tabTitle = (id: AppTab): string => ({ keyboard: tr('Modo Teclado / Pads'), router: tr('Roteador MIDI Matrix'), studio: tr('Estúdio de Produção'), monitor: tr('Monitor MIDI') })[id];

export default function App() {
  // ... (states mantidos)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ... (lógica de callbacks e devices mantidos)

  // Função para lidar com o botão "Voltar" do Android
  useEffect(() => {
    if (!isFullscreen) return;
    // Se estiver em fullscreen, o botão voltar sai do fullscreen
    // Isso requer @capacitor/app, mas simulamos com popstate se não houver nativo
    const handleBack = () => setIsFullscreen(false);
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [isFullscreen]);

  return (
    <div className={`nexus-app fixed inset-0 flex h-[100dvh] w-full select-none flex-col overflow-hidden font-sans antialiased ${isFullscreen ? 'is-fullscreen' : ''}`}>
      
      {!isFullscreen && (
        <header className="nexus-header relative z-[100] flex h-14 w-full shrink-0 items-center justify-between gap-3 px-3 sm:px-5 pt-[env(safe-area-inset-top)]">
          {/* ... (Header NavMenu e Connections mantidos) ... */}
        </header>
      )}

      {showExit && <ExitDialog onCancel={() => setShowExit(false)} onConfirm={() => void handleConfirmExit()} />}
      <StatusToast toast={toast} onClose={dismiss} />

      <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {activeTab === 'keyboard' && (
          <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 sm:p-1.5 pb-[env(safe-area-inset-bottom)]">
            <div className="flex min-h-0 flex-1 flex-row gap-1">
              {!isFullscreen && <div className="py-1"><VuMeter level={vuLevel} /></div>}
              <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                <MidiKeyboard
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
                  onToggleActive={() => { setKeyboardEnabled(!keyboardEnabled); showMessage(!keyboardEnabled ? tr('Teclado Virtual Ligado') : tr('Teclado Virtual Desligado'), 'info', 1500); }}
                  isSustainActive={sustain}
                  onToggleSustain={() => void handleToggleSustain()}
                  selectedVelocity={prefs.velocity}
                  onSelectVelocity={(velocity) => prefsStore.set({ velocity })}
                  selectedPaletteId={prefs.paletteId}
                  onSelectPalette={(paletteId) => prefsStore.set({ paletteId })}
                  // Novas Props
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

        {/* ... (Router e Monitor mantidos) ... */}

        {activeTab === 'studio' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <StudioScreen onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        )}
      </main>
    </div>
  );
}
