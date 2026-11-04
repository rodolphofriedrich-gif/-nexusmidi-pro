import type { ReactNode } from 'react';
import { Bluetooth, CheckCircle2, Circle, Power, Radio, RefreshCw, Usb, X } from 'lucide-react';
import { tr } from '../i18n';
import type { MidiDestination } from '../types/midi';

interface Props {
  kind: 'usb' | 'ble';
  isOpen: boolean;
  isConnected: boolean;
  statusLabel: string;
  devices: readonly MidiDestination[];
  connectedIds: ReadonlySet<string>;
  showDisconnectAll: boolean;
  onToggleOpen: () => void;
  onRefresh: () => void;
  onToggleDevice: (device: MidiDestination) => void;
  onDisconnectAll: () => void;
  /** Somente BLE */
  isScanning?: boolean;
  isServerActive?: boolean;
  onScan?: () => void;
  onStartServer?: () => void;
}

export function ConnectionMenu(props: Props) {
  const { kind, isOpen, isConnected, statusLabel, devices, connectedIds, showDisconnectAll } = props;
  const Icon = kind === 'usb' ? Usb : Bluetooth;
  const title = kind === 'usb' ? 'USB' : 'Bluetooth';

  const header: ReactNode = (
    <div className="flex items-center justify-between border-b border-[#2e323b] px-4 py-3">
      <div>
        <p className="text-[10px] font-bold text-cyan-500">{kind === 'usb' ? tr('CONEXÃO USB') : tr('CONECTIVIDADE')}</p>
        <p className="mt-1 text-sm font-semibold text-white">{kind === 'usb' ? tr('Selecione múltiplos') : tr('Bluetooth MIDI')}</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={tr('Atualizar lista')} onClick={props.onRefresh} className="rounded p-1 text-slate-400 hover:bg-slate-800 transition-colors">
          <RefreshCw size={16} />
        </button>
        <button type="button" onClick={props.onToggleOpen} className="rounded p-1 text-slate-400 hover:bg-slate-800 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={props.onToggleOpen}
        className={`nexus-connection-button flex h-10 w-full items-center gap-2 rounded-lg border border-[#2e323b] bg-[#121316] px-3 transition-colors hover:bg-slate-800 ${isConnected ? 'text-emerald-400' : 'text-slate-300'}`}
      >
        <span className="flex items-center justify-center">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className="flex flex-1 flex-col items-start text-left leading-none">
          <span className="text-[10px] font-bold uppercase text-slate-500">{title}</span>
          <span className="mt-0.5 text-xs">{statusLabel}</span>
        </span>
        {isConnected ? <CheckCircle2 size={16} /> : <span className="h-2 w-2 rounded-full bg-slate-600" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) props.onToggleOpen(); }}>
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#2e323b] bg-[#1a1c21] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {header}
            
            {showDisconnectAll && (
              <button
                type="button"
                onClick={props.onDisconnectAll}
                className="flex w-full items-center justify-center gap-2 border-b border-[#2e323b] bg-red-950/20 px-4 py-2.5 text-xs font-bold uppercase text-red-400 transition-colors hover:bg-red-900/30"
              >
                {tr('Desconectar Todos')}
              </button>
            )}

            <div className="custom-scrollbar max-h-[50vh] min-h-[150px] overflow-y-auto overscroll-contain p-2">
              {devices.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <p className="text-sm text-slate-500">
                    {kind === 'usb' ? tr('Nenhum dispositivo USB encontrado.') : tr('Nenhum dispositivo BLE MIDI encontrado.')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {devices.map((dest) => {
                    const selected = connectedIds.has(dest.id);
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => props.onToggleDevice(dest)}
                        className={`flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-slate-800 ${selected ? 'bg-slate-800/50 text-cyan-400' : 'text-slate-300'}`}
                      >
                        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{dest.displayName}</span>
                        {selected ? <CheckCircle2 size={18} className="text-cyan-400 shrink-0" /> : <Circle size={16} className="text-slate-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {kind === 'ble' && (
              <div className="flex flex-col gap-2 border-t border-[#2e323b] bg-[#121316] p-3">
                <button
                  type="button"
                  onClick={props.onScan}
                  disabled={props.isScanning}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                >
                  <Radio size={18} className={props.isScanning ? 'animate-pulse' : ''} />
                  {props.isScanning ? tr('Buscando...') : tr('Buscar BLE')}
                </button>
                <button
                  type="button"
                  onClick={props.isServerActive ? props.onDisconnectAll : props.onStartServer}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                    props.isServerActive ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {props.isServerActive ? <Power size={18} /> : <Bluetooth size={18} />}
                  {props.isServerActive ? tr('Parar Visibilidade') : tr('Ficar Visível')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
