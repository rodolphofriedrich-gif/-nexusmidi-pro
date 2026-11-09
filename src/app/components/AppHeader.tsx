import { useState } from 'react';
import {
  GitBranch, Menu, Music2, Activity, AudioWaveform, Usb, Bluetooth,
  RefreshCw, Plus, Play, Pause, Trash2, ChevronDown, Settings2, LayoutGrid,
  SlidersHorizontal, Lock, Unlock, ShieldAlert,
} from 'lucide-react';
import { tr } from '../../i18n';

type AppTab = 'play' | 'midi' | 'studio' | 'settings';
type PlayTab = 'keyboard' | 'pads';
type MidiTab = 'router' | 'monitor';
type StudioTab = 'synth' | 'mixer' | 'tools';
type MonitorFilter = 'all' | 'RX' | 'TX';

interface AppHeaderProps {
  activeTab: AppTab;
  onOpenSidebar: () => void;

  playTab: PlayTab;
  onPlayTabChange: (tab: PlayTab) => void;
  startOctave: number;
  onStartOctaveChange: (next: number) => void;
  sustain: boolean;
  onToggleSustain: () => void;
  channel: number;
  onOpenKeyboardChannel: () => void;
  onOpenKeyboardSettings: () => void;
  padBank: number;
  onPadBankChange: (bank: number) => void;
  padsChannel: number;
  onOpenPadChannel: () => void;
  isPadEditMode: boolean;
  onTogglePadEditMode: () => void;

  midiTab: MidiTab;
  onMidiTabChange: (tab: MidiTab) => void;
  studioTab: StudioTab;
  onStudioTabChange: (tab: StudioTab) => void;

  isRouterRefreshing: boolean;
  onRefreshRouter: () => void;
  onAddNewRoute: () => void;

  monitorFilter: MonitorFilter;
  onMonitorFilterChange: (filter: MonitorFilter) => void;
  monitorPaused: boolean;
  onToggleMonitorPaused: () => void;
  onClearMonitor: () => void;

  onPanic: () => void;

  isUsbConnected: boolean;
  isBleConnected: boolean;
  bleServerActive: boolean;
}

const btnClass = "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] active:scale-95 px-3 text-xs font-bold";
const btnActiveClass = "border-indigo-500/40 bg-indigo-500/15 text-[var(--nexus-primary)] shadow-[0_0_8px_rgba(99,102,241,0.15)]";

export function AppHeader(props: AppHeaderProps) {
  const {
    activeTab, onOpenSidebar,
    playTab, onPlayTabChange,
    startOctave, onStartOctaveChange,
    sustain, onToggleSustain,
    channel, onOpenKeyboardChannel, onOpenKeyboardSettings,
    padBank, onPadBankChange,
    padsChannel, onOpenPadChannel, isPadEditMode, onTogglePadEditMode,
    midiTab, onMidiTabChange,
    studioTab, onStudioTabChange,
    isRouterRefreshing, onRefreshRouter, onAddNewRoute,
    monitorFilter, onMonitorFilterChange, monitorPaused, onToggleMonitorPaused, onClearMonitor,
    onPanic,
    isUsbConnected, isBleConnected, bleServerActive,
  } = props;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 60, left: 8 });

  return (
    <header className="nexus-header-pad relative z-[80] flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] pt-[env(safe-area-inset-top)]">

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
        <button type="button" aria-label={tr('Abrir menu')} onClick={onOpenSidebar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors">
          <Menu size={22} />
        </button>

        {activeTab === 'play' && (
          <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">

            <div className="flex items-center gap-1 shrink-0 bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-color)] mr-2">
              <button type="button" onClick={() => onPlayTabChange('keyboard')} className={`flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-bold transition-all ${playTab === 'keyboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
                <Music2 size={14} /> <span className="hidden sm:inline">{tr('Teclado')}</span>
              </button>
              <button type="button" onClick={() => onPlayTabChange('pads')} className={`flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-bold transition-all ${playTab === 'pads' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
                <LayoutGrid size={14} /> <span className="hidden sm:inline">{tr('PADS')}</span>
              </button>
            </div>

            {playTab === 'keyboard' && (
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" disabled={startOctave <= 1} onClick={() => onStartOctaveChange(Math.max(1, startOctave - 1))} className={`${btnClass} w-10 text-lg`}>−</button>
                  <div className="flex h-10 min-w-[44px] items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 font-mono text-sm font-bold text-[var(--nexus-primary)]">C{startOctave}</div>
                  <button type="button" disabled={startOctave >= 6} onClick={() => onStartOctaveChange(Math.min(6, startOctave + 1))} className={`${btnClass} w-10 text-lg`}>+</button>
                </div>
                <button type="button" onClick={onToggleSustain} className={`${btnClass} ${sustain ? btnActiveClass : ''} hidden sm:flex`}><Pause size={16} /> SUSTAIN</button>
                <div className="h-6 w-px bg-[var(--border-color)] shrink-0 hidden sm:block mx-1" />
                <button type="button" onClick={onOpenKeyboardChannel} className={`${btnClass}`}>
                  <span className="text-xs font-bold uppercase">CH</span>
                  <span className="min-w-[16px] text-center font-mono text-sm font-bold text-[var(--nexus-primary)]">{String(channel).padStart(2, '0')}</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" aria-label={tr('Configurações do teclado')} onClick={onOpenKeyboardSettings} className={`${btnClass} w-10`}>
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            )}

            {playTab === 'pads' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hidden sm:block">
                    {tr('Bancos')}:
                  </span>
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
                    {[0, 1, 2, 3].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => onPadBankChange(b)}
                        className={`h-9 w-9 flex items-center justify-center rounded-md text-xs font-bold transition-all ${
                          padBank === b
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {b + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={onOpenPadChannel} className={`${btnClass}`}>
                  <span className="text-xs font-bold uppercase">CH</span>
                  <span className="min-w-[16px] text-center font-mono text-sm font-bold text-[var(--nexus-primary)]">{String(padsChannel).padStart(2, '0')}</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={onTogglePadEditMode} className={`${btnClass} ${isPadEditMode ? btnActiveClass : ''} w-10`} title={tr('Modo de Edição dos Pads')}>
                  {isPadEditMode ? <Unlock size={16} /> : <Lock size={16} />}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'midi' && (
          <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">{tr('MIDI')}</h2>
            <div className="flex items-center gap-1 shrink-0 bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-color)]">
              <button type="button" onClick={() => onMidiTabChange('router')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${midiTab === 'router' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><GitBranch size={16} /> <span className="hidden sm:inline">{tr('Roteador')}</span></button>
              <button type="button" onClick={() => onMidiTabChange('monitor')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${midiTab === 'monitor' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><Activity size={16} /> <span className="hidden sm:inline">{tr('Monitor')}</span></button>
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">{tr('Estúdio')}</h2>
            <div className="flex items-center gap-1 shrink-0 bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-color)]">
              <button type="button" onClick={() => onStudioTabChange('synth')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'synth' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><AudioWaveform size={16} /> <span className="hidden sm:inline">{tr('Sintetizador')}</span></button>
              <button type="button" onClick={() => onStudioTabChange('mixer')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'mixer' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><SlidersHorizontal size={16} /> <span className="hidden sm:inline">{tr('Mixer / CC')}</span></button>
              <button type="button" onClick={() => onStudioTabChange('tools')} className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-bold transition-all ${studioTab === 'tools' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><Settings2 size={16} /> <span className="hidden sm:inline">{tr('Ferramentas')}</span></button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex items-center gap-2 lg:flex-1 lg:justify-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--nexus-primary)] mr-2 px-1 shrink-0 hidden sm:block">{tr('Configurações')}</h2>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {activeTab === 'midi' && midiTab === 'router' && (
          <>
            <button type="button" aria-label={tr('Atualizar lista')} onClick={onRefreshRouter} disabled={isRouterRefreshing} className={`${btnClass} w-10`}>
              <RefreshCw size={16} className={isRouterRefreshing ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onAddNewRoute} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 h-10 text-xs font-bold text-white shadow-lg shadow-black/20 transition hover:bg-indigo-500">
              <Plus size={18} /> <span className="hidden sm:inline">{tr('Nova Rota')}</span>
            </button>
          </>
        )}

        {activeTab === 'midi' && midiTab === 'monitor' && (
          <>
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
                    <button type="button" key={f} onClick={() => { onMonitorFilterChange(f); setIsFilterOpen(false); }} className={`w-full px-3 py-3 text-left text-xs hover:bg-[var(--bg-elevated)] ${monitorFilter === f ? 'font-bold text-[var(--nexus-primary)] bg-indigo-500/10' : 'text-[var(--text-main)]'}`}>
                      {f === 'all' ? tr('Todos') : f === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)')}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" aria-label={monitorPaused ? tr('Continuar') : tr('Pausar')} onClick={onToggleMonitorPaused} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${monitorPaused ? 'border-amber-600/60 bg-amber-900/30 text-amber-500' : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
              {monitorPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button type="button" aria-label={tr('Limpar')} onClick={onClearMonitor} className={`${btnClass} w-10 hover:bg-red-950/50 hover:text-red-500`}>
              <Trash2 size={16} />
            </button>
          </>
        )}

        <button
          type="button"
          aria-label={tr('MIDI Panic')}
          title={tr('MIDI Panic')}
          onClick={onPanic}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-800/60 bg-red-950/40 text-[var(--nexus-danger)] transition hover:bg-red-900/60"
        >
          <ShieldAlert size={18} />
        </button>

        {isUsbConnected && (
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-[var(--nexus-success)]/15 text-[var(--nexus-success)] border border-[var(--nexus-success)]/30" title="USB Conectado">
            <Usb size={16} />
          </div>
        )}
        {(isBleConnected || bleServerActive) && (
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-[var(--nexus-success)]/15 text-[var(--nexus-success)] border border-[var(--nexus-success)]/30" title="Bluetooth Conectado">
            <Bluetooth size={16} />
          </div>
        )}
      </div>
    </header>
  );
}
