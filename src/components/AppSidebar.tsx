import { Activity, AudioWaveform, Bluetooth, LogOut, Music2, Settings, Usb, X, type LucideIcon } from 'lucide-react';
import { ConnectionMenu } from '../../components/ConnectionMenu';
import { tr } from '../../i18n';
import type { MidiDestination } from '../../types/midi';

type AppTab = 'play' | 'midi' | 'studio' | 'settings';
type ConnectionMenuKind = 'usb' | 'ble';

const NAV_ITEMS: ReadonlyArray<{ id: AppTab; Icon: LucideIcon; label: string }> = [
  { id: 'play', Icon: Music2, label: 'Tocar' },
  { id: 'midi', Icon: Activity, label: 'MIDI' },
  { id: 'studio', Icon: AudioWaveform, label: 'Estúdio' },
  { id: 'settings', Icon: Settings, label: 'Configurações' },
];

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  openMenu: ConnectionMenuKind | null;
  onToggleConnectionMenu: (kind: ConnectionMenuKind) => void;
  isUsbConnected: boolean;
  isBleConnected: boolean;
  bleServerActive: boolean;
  usbDevices: readonly MidiDestination[];
  bleDevices: readonly MidiDestination[];
  connectedIds: ReadonlySet<string>;
  connectedDeviceCount: number;
  scanningBle: boolean;
  onRefresh: () => void;
  onToggleDevice: (device: MidiDestination) => void;
  onDisconnectAll: () => void;
  onScanBle: () => void;
  onStartBleServer: () => void;
  onExit: () => void;
}

export function AppSidebar(props: AppSidebarProps) {
  const {
    isOpen, onClose, activeTab, onNavigate, openMenu, onToggleConnectionMenu,
    isUsbConnected, isBleConnected, bleServerActive, usbDevices, bleDevices,
    connectedIds, connectedDeviceCount, scanningBle, onRefresh, onToggleDevice,
    onDisconnectAll, onScanBle, onStartBleServer, onExit,
  } = props;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-[100] flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border-color)] shrink-0">
          <span className="text-sm font-extrabold tracking-wider text-[var(--text-main)]">
            NEXUSMIDI <span className="text-[var(--nexus-accent)]">Pro</span>
          </span>
          <button type="button" aria-label={tr('Fechar menu')} onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition">
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
                  onClick={() => onNavigate(id)}
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
            <ConnectionMenu kind="usb" isOpen={openMenu === 'usb'} isConnected={isUsbConnected} statusLabel={isUsbConnected ? tr('Conectado') : tr('Desconectado')} devices={usbDevices} connectedIds={connectedIds} showDisconnectAll={isUsbConnected} onToggleOpen={() => onToggleConnectionMenu('usb')} onRefresh={onRefresh} onToggleDevice={onToggleDevice} onDisconnectAll={onDisconnectAll} />
            <ConnectionMenu kind="ble" isOpen={openMenu === 'ble'} isConnected={isBleConnected || bleServerActive} statusLabel={bleServerActive ? tr('Visível') : isBleConnected ? tr('Conectado') : tr('Desconectado')} devices={bleDevices} connectedIds={connectedIds} showDisconnectAll={connectedDeviceCount > 0 || bleServerActive} onToggleOpen={() => onToggleConnectionMenu('ble')} onRefresh={onRefresh} onToggleDevice={onToggleDevice} onDisconnectAll={onDisconnectAll} isScanning={scanningBle} isServerActive={bleServerActive} onScan={onScanBle} onStartServer={onStartBleServer} />
          </div>
        </div>

        <div className="p-3 border-t border-[var(--border-color)] shrink-0">
          <button type="button" onClick={onExit} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-3 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
            <LogOut size={18} />
            <span className="text-xs font-bold">{tr('Sair')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
