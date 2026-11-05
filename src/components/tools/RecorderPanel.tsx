import { useState, useSyncExternalStore } from 'react';
import { Circle, Download, Play, Square, Trash2, Mic } from 'lucide-react';
import { tr } from '../../i18n';
import { recorderService } from '../../services/recorderService';
import type { ToastType } from '../../hooks/useToast';
import { Card } from './ui';

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 100) / 10;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(1).padStart(4, '0');
  return `${String(minutes).padStart(2, '0')}:${seconds}`;
};

export function RecorderPanel({ onStatus }: { onStatus: (message: string, type?: ToastType) => void }) {
  const snap = useSyncExternalStore(recorderService.subscribe, recorderService.getSnapshot, recorderService.getSnapshot);
  const [exporting, setExporting] = useState(false);
  const hasTake = snap.eventCount > 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await recorderService.exportMidi();
      if (result === 'downloaded') onStatus(tr('Arquivo .mid baixado.'), 'success');
    } catch (error) {
      onStatus(tr('Não foi possível exportar: {message}', { message: error instanceof Error ? error.message : '' }), 'error');
    } finally {
      setExporting(false);
    }
  };

  const btn = 'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Card title={tr('Gravador MIDI')} Icon={Mic} accent="text-rose-400">
      <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${snap.recording ? 'animate-pulse bg-rose-500' : snap.playing ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {snap.recording ? tr('Gravando') : snap.playing ? tr('Reproduzindo') : tr('Parado')}
          </span>
        </div>
        <span className="font-mono text-lg tabular-nums text-[var(--text-main)]">{formatTime(snap.durationMs)}</span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{tr('{count} eventos', { count: snap.eventCount })}</span>
      </div>

      <div className="flex gap-2">
        {snap.recording ? (
          <button type="button" onClick={() => recorderService.stopRecording()} className={`${btn} bg-rose-600 text-white hover:bg-rose-500`}>
            <Square size={14} /> {tr('Parar')}
          </button>
        ) : (
          <button type="button" onClick={() => recorderService.startRecording()} className={`${btn} bg-rose-700 text-white hover:bg-rose-600`}>
            <Circle size={14} className="fill-current" /> {tr('Gravar')}
          </button>
        )}
        {snap.playing ? (
          <button type="button" onClick={() => recorderService.stopPlayback()} className={`${btn} bg-[var(--bg-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-panel)]`}>
            <Square size={14} /> {tr('Parar')}
          </button>
        ) : (
          <button type="button" disabled={!hasTake || snap.recording} onClick={() => recorderService.play()} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}>
            <Play size={14} className="fill-current" /> {tr('Tocar')}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={!hasTake || snap.recording || exporting} onClick={() => void handleExport()} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]`}>
          <Download size={14} /> {exporting ? tr('Exportando...') : tr('Exportar .mid')}
        </button>
        <button type="button" disabled={!hasTake && !snap.recording} onClick={() => recorderService.clear()} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-red-950/40 hover:text-red-400`}>
          <Trash2 size={14} /> {tr('Limpar')}
        </button>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">{tr('Grava o que você toca e também o que chega de dispositivos conectados.')}</p>
    </Card>
  );
}
