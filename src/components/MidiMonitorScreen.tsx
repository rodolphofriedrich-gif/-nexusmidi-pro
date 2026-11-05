import { useMemo, useSyncExternalStore } from 'react';
import { tr } from '../i18n';
import { midiManager } from '../services/midiService';
import type { MidiLogEntry } from '../types/midi';

const TYPE_COLORS: Partial<Record<MidiLogEntry['type'], string>> = {
  'Note On': 'text-[var(--nexus-accent)]',
  'Note Off': 'text-[var(--text-muted)]',
  'Control Change': 'text-[var(--nexus-primary)]',
  'Program Change': 'text-[var(--nexus-primary)]',
  'Pitch Bend': 'text-[var(--nexus-primary)]',
  'Channel Pressure': 'text-amber-400',
  'Poly Aftertouch': 'text-amber-400',
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)]">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-xs text-[var(--text-muted)]">
            {tr('Nenhuma mensagem ainda. Toque no teclado ou envie MIDI de um dispositivo.')}
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-[var(--bg-panel)] text-[10px] uppercase text-[var(--text-muted)]">
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
                <tr key={entry.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-panel)]/60">
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{entry.timestamp}</td>
                  <td className={`px-2 py-1.5 font-bold ${entry.direction === 'TX' ? 'text-[var(--nexus-accent)]' : 'text-emerald-400'}`}>{entry.direction}</td>
                  <td className={`px-2 py-1.5 ${TYPE_COLORS[entry.type] ?? 'text-[var(--text-main)]'}`}>{entry.type}</td>
                  <td className="px-2 py-1.5 text-[var(--text-main)]">{entry.channel || '-'}</td>
                  <td className="px-2 py-1.5 text-[var(--text-main)]">{entry.noteName}</td>
                  <td className="px-2 py-1.5 text-[var(--text-main)]">{entry.velocity}</td>
                  <td className="hidden px-2 py-1.5 text-[var(--text-muted)] sm:table-cell">{entry.bytesHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
