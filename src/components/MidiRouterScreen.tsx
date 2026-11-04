import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRightLeft, ChevronDown, Download, Upload, Trash2 } from 'lucide-react';
import { tr } from '../i18n';
import { midiManager } from '../services/midiService';
import type { MidiDestination, MidiRoute } from '../types/midi';

interface Props {
  destinations: MidiDestination[];
  connectedDestinations: MidiDestination[];
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

const ALL_INPUTS = '__all__';

export function MidiRouterScreen({ destinations, connectedDestinations, isRefreshing }: Props) {
  const routes = useSyncExternalStore(midiManager.subscribeRoutes, midiManager.getRoutes, midiManager.getRoutes);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateRoute = <K extends keyof MidiRoute>(id: string, field: K, value: MidiRoute[K]) => {
    midiManager.updateRoute(id, { [field]: value } as Partial<MidiRoute>);
    setOpenDropdown(null);
  };

  const availableInputs: Array<{ id: string; name: string }> = [
    { id: ALL_INPUTS, name: tr('Todas as entradas') },
    { id: 'virtual', name: tr('Teclado Virtual') },
    ...destinations
      .filter((d) => d.type !== 'virtual')
      .map((d) => ({ id: d.id, name: `${d.displayName} (${d.type.toUpperCase()})` })),
  ];
  
  const inputName = (route: MidiRoute) =>
    availableInputs.find((i) => i.id === (route.sourceId ?? ALL_INPUTS))?.name ?? tr('Selecione...');

  const channelOptions = (current: number, zeroLabel: string, field: 'inputChannel' | 'outputChannel', routeId: string) => (
    <>
      <button
        type="button"
        onClick={() => updateRoute(routeId, field, 0)}
        className={`w-full px-2 py-1.5 text-center font-mono text-xs hover:bg-slate-800 ${current === 0 ? 'bg-slate-800/50 font-bold text-cyan-400' : 'text-slate-300'}`}
      >
        {zeroLabel}
      </button>
      {Array.from({ length: 16 }, (_, i) => (
        <button
          type="button"
          key={i + 1}
          onClick={() => updateRoute(routeId, field, i + 1)}
          className={`w-full px-2 py-1.5 text-center font-mono text-xs hover:bg-slate-800 ${current === i + 1 ? 'bg-slate-800/50 font-bold text-cyan-400' : 'text-slate-300'}`}
        >
          {String(i + 1).padStart(2, '0')}
        </button>
      ))}
    </>
  );

  return (
    <div className="custom-scrollbar flex w-full flex-1 flex-col gap-4 overflow-y-auto bg-[#121316] p-3 pb-32 text-slate-100 sm:p-5">
      {routes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 py-20 text-slate-500">
          <ArrowRightLeft size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">{tr('Nenhuma rota configurada.')}</p>
          <p className="mt-1 px-6 text-center text-xs">
            {tr('Ao conectar um dispositivo, uma rota do Teclado Virtual para ele é criada automaticamente.')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" ref={dropdownRef}>
          {routes.map((route, index) => (
            <div
              key={route.id}
              className={`relative z-20 flex flex-col gap-3 rounded-xl border border-[#2e323b] bg-[#1a1c21] p-3 shadow-md transition-opacity sm:p-4 ${route.enabled ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between border-b border-[#2e323b] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{tr('Rota {n}', { n: index + 1 })}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={route.enabled}
                    aria-label={tr('Ativar rota')}
                    onClick={() => updateRoute(route.id, 'enabled', !route.enabled)}
                    className={`relative h-4 w-8 rounded-full transition-colors ${route.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${route.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                  <button
                    type="button"
                    aria-label={tr('Excluir rota')}
                    onClick={() => midiManager.removeRoute(route.id)}
                    className="p-1 text-slate-500 transition hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                <div className="relative flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-500">{tr('Entrada (MIDI In)')}</label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === `in-${route.id}` ? null : `in-${route.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-[#121316] p-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-500/50"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Download size={14} className="shrink-0 text-emerald-500" />
                      <span className="truncate">{inputName(route)}</span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform ${openDropdown === `in-${route.id}` ? 'rotate-180' : ''}`} />
                  </button>
                  {openDropdown === `in-${route.id}` && (
                    <div className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-[#1a1c21] shadow-2xl">
                      {availableInputs.map((input) => (
                        <button
                          type="button"
                          key={input.id}
                          onClick={() => updateRoute(route.id, 'sourceId', input.id === ALL_INPUTS ? null : input.id)}
                          className={`w-full truncate px-3 py-2 text-left text-xs hover:bg-slate-800 ${(route.sourceId ?? ALL_INPUTS) === input.id ? 'bg-slate-800/50 font-bold text-emerald-400' : 'text-slate-300'}`}
                        >
                          {input.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-500">{tr('Saída (MIDI Out)')}</label>
                  {connectedDestinations.length === 0 ? (
                    <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-2 text-center text-xs text-amber-500">
                      {tr('Conecte um dispositivo USB/BLE no topo.')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === `out-${route.id}` ? null : `out-${route.id}`)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-[#121316] p-2 text-xs font-semibold text-cyan-300 transition hover:border-cyan-500/50"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Upload size={14} className="shrink-0 text-cyan-500" />
                        <span className="truncate">
                          {connectedDestinations.find((d) => d.id === route.destinationId)?.displayName ?? tr('Selecione...')}
                        </span>
                      </div>
                      <ChevronDown size={14} className={`transition-transform ${openDropdown === `out-${route.id}` ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {openDropdown === `out-${route.id}` && (
                    <div className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-[#1a1c21] shadow-2xl">
                      {connectedDestinations.map((dest) => (
                        <button
                          type="button"
                          key={dest.id}
                          onClick={() => updateRoute(route.id, 'destinationId', dest.id)}
                          className={`w-full truncate px-3 py-2 text-left text-xs hover:bg-slate-800 ${route.destinationId === dest.id ? 'bg-slate-800/50 font-bold text-cyan-400' : 'text-slate-300'}`}
                        >
                          {dest.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#2e323b] bg-[#121316] p-2">
                {(['inputChannel', 'outputChannel'] as const).map((field) => {
                  const key = `${field === 'inputChannel' ? 'chin' : 'chout'}-${route.id}`;
                  const value = route[field];
                  const zeroLabel = field === 'inputChannel' ? tr('Omni') : tr('Manter');
                  return (
                    <div key={field} className="relative flex flex-col gap-1">
                      <label className="text-center text-[9px] font-bold uppercase text-slate-500">
                        {field === 'inputChannel' ? tr('Canal In') : tr('Canal Out')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === key ? null : key)}
                        className="flex w-full items-center justify-between rounded border border-slate-700 bg-[#1a1c21] px-2 py-1.5 text-center font-mono text-xs text-slate-300 transition hover:border-slate-500"
                      >
                        <span>{value === 0 ? zeroLabel : String(value).padStart(2, '0')}</span>
                        <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === key ? 'rotate-180' : ''}`} />
                      </button>
                      {openDropdown === key && (
                        <div className="custom-scrollbar absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-[#1a1c21] shadow-2xl">
                          {channelOptions(value, zeroLabel, field, route.id)}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-col gap-1">
                  <label className="text-center text-[9px] font-bold uppercase text-slate-500">{tr('Transp.')}</label>
                  <input
                    type="number"
                    min={-24}
                    max={24}
                    value={route.transpose === 0 ? '' : route.transpose}
                    onChange={(e) => updateRoute(route.id, 'transpose', Math.max(-24, Math.min(24, Number(e.target.value) || 0)))}
                    placeholder="0"
                    className="rounded border border-slate-700 bg-[#1a1c21] px-2 py-1.5 text-center font-mono text-xs text-slate-300 outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
