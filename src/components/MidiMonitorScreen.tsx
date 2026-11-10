import { useMemo, useRef, useSyncExternalStore } from 'react';
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

/**
 * Throttle de renders do Monitor.
 *
 * Em vez de re-renderizar a cada mensagem (pitch bend = ~100 msgs/s), só
 * notifica o React 1x por frame (~60 fps) via requestAnimationFrame.
 *
 * Funcionamento:
 *   - `midiManager.subscribeLog` dispara a cada pushLog (síncrono, mantém
 *     os 188 testes de midiCore.ts intactos).
 *   - Aqui, o primeiro disparo do frame agenda um rAF. Disparos subsequentes
 *     no mesmo frame são descartados (rafId !== null).
 *   - No rAF, atualizamos `committedLog` (referência estável que o React vê)
 *     e chamamos `pendingNotify` — o callback do useSyncExternalStore.
 *
 * Estado de módulo (fora do componente) porque o Monitor é a única tela que
 * assina o log do midiManager, e useSyncExternalStore exige subscribe estável.
 */
let committedLog: readonly MidiLogEntry[] | null = null;
let pendingNotify: (() => void) | null = null;
let rafId: number | null = null;

function commitAndNotify(): void {
  rafId = null;
  committedLog = midiManager.getLog();
  const fn = pendingNotify;
  pendingNotify = null;
  fn?.();
}

function subscribeThrottled(cb: () => void): () => void {
  pendingNotify = cb;
  // Inicializa o cache na primeira montagem, lendo o log atual (pode ter
  // mensagens acumuladas antes do Monitor abrir — não queremos perder).
  if (committedLog === null) committedLog = midiManager.getLog();
  const unsubscribe = midiManager.subscribeLog(() => {
    if (rafId === null) rafId = requestAnimationFrame(commitAndNotify);
  });
  return () => {
    unsubscribe();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingNotify = null;
  };
}

function getSnapshotThrottled(): readonly MidiLogEntry[] {
  // Fallback para o caso de getSnapshot ser chamado antes do subscribe
  // (React pode chamar getSnapshot no render inicial antes de assinar).
  return committedLog ?? midiManager.getLog();
}

export function MidiMonitorScreen({ maxVisible = 150, filter, paused }: Props) {
  const log = useSyncExternalStore(subscribeThrottled, getSnapshotThrottled, getSnapshotThrottled);

  // Captura o log no momento em que `paused` vira true, para congelar a UI.
  // Usa useRef (não useMemo) porque a dep `log` mudaria a cada frame e
  // recapturaria o valor — o `prevPaused` guard garante que só capturamos
  // na transição false → true, preservando a semântica de "pausa".
  const frozenRef = useRef<readonly MidiLogEntry[]>(log);
  const prevPausedRef = useRef(paused);
  if (prevPausedRef.current !== paused && paused) {
    frozenRef.current = log;
  }
  prevPausedRef.current = paused;

  const source = paused ? frozenRef.current : log;
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
