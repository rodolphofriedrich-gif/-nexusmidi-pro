import { useMemo, useSyncExternalStore } from 'react';
import { tr } from '../i18n';
import { midiManager } from '../services/midiService';
import type { MidiLogEntry } from '../types/midi';

const TYPE_COLORS: Partial<Record<MidiLogEntry['type'], string>> = {
  'Note On': 'text-emerald-400',
  'Note Off': 'text-slate-400',
  'Control Change': 'text-amber-400',
  'Program Change': 'text-cyan-400',
  'Pitch Bend': 'text-cyan-400',
  'Channel Pressure': 'text-rose-400',
  'Poly Aftertouch': 'text-rose-400',
  System: 'text-purple-400',
};

interface Props {
  maxVisible?: number;
  filter: 'all' | 'RX' | 'TX';
  paused: boolean;
}

export function MidiMonitorScreen({ maxVisible = 150, filter, paused }: Props) {
  const log = useSyncExternalStore(midiManager.subscribeLog, midiManager.getLog, midiManager.getLog);
  const frozen = useMemo(() => log, [paused]); // Simplificação para evitar complexidade extra

  const source = paused ? frozen : log;
  const visible = useMemo(
    () => (filter === 'all' ? source : source.filter((e) => e.direction === filter)).slice(0, maxVisible),
    [source, filter, maxVisible],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#121316] text-slate-100">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-500">
            {tr('Nenhuma mensagem ainda. Toque no teclado ou envie MIDI de um dispositivo.')}
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-[#1a1c21] text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{tr('Hora')}</th>
                <th className="px-2 py-2">{tr('Dir.')}</th>
                <th className="px-2 py-2">{tr('Tipo')}</th>
                <th className="px-2 py-2">CH</th>
                <th className="px-2 py-2">{tr('Nota')}</th>
                <th className="px-2 py-2">Vel/Val</th>
                <th className="hidden px-2 py-2 sm:table-cell">Hex</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-900 hover:bg-slate-900/60">
                  <td className="px-3 py-1.5 text-slate-500">{entry.timestamp}</td>
                  <td className={`px-2 py-1.5 font-bold ${entry.direction === 'TX' ? 'text-cyan-400' : 'text-emerald-400'}`}>{entry.direction}</td>
                  <td className={`px-2 py-1.5 ${TYPE_COLORS[entry.type] ?? 'text-slate-300'}`}>{entry.type}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.channel || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.noteName}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.velocity}</td>
                  <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">{entry.bytesHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
