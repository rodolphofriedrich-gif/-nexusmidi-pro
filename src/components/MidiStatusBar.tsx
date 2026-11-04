import { useSyncExternalStore } from 'react';
import { tr } from '../i18n';
import { midiManager } from '../services/midiService';

interface Props {
  connectedCount: number;
  canPlay: boolean;
  activeNotes: number;
}

/** Barra inferior do teclado. Assina o log MIDI aqui para que só ela re-renderize a cada mensagem. */
export function MidiStatusBar({ connectedCount, canPlay, activeNotes }: Props) {
  const log = useSyncExternalStore(midiManager.subscribeLog, midiManager.getLog, midiManager.getLog);
  const lastTx = log.find((entry) => entry.direction === 'TX');

  return (
    <div className="nexus-midi-status flex shrink-0 items-center justify-between gap-3 rounded-lg border border-[#2e323b] bg-[#121316] px-3 py-1">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: canPlay ? '#10b981' : '#f59e0b', boxShadow: canPlay ? '0 0 10px rgba(16,185,129,0.55)' : 'none' }}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300">
            {connectedCount > 0 ? tr('{count} Conectados', { count: connectedCount }) : canPlay ? tr('Pronto') : tr('Aguardando')}
          </span>
        </div>
        <span className="border-l border-slate-700 pl-4 font-mono text-[10px] text-slate-500">
          {activeNotes === 0
            ? tr('Nenhuma nota ativa')
            : activeNotes === 1
              ? tr('1 nota ativa')
              : tr('{count} notas ativas', { count: activeNotes })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${lastTx ? 'bg-cyan-400' : 'bg-gray-600'}`} />
        <span className="text-[10px] font-bold tracking-wider text-gray-400">MIDI TX</span>
        {lastTx ? (
          <span className="font-mono text-[10px] text-gray-200">
            {lastTx.type} · CH{lastTx.channel} · {lastTx.noteName} · V{lastTx.velocity}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-gray-500">{tr('Aguardando')}</span>
        )}
      </div>
    </div>
  );
}
