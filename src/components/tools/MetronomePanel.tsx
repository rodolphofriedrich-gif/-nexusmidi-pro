import { useRef } from 'react';
import { Timer } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { tr } from '../../i18n';
import { TapTempo } from '../../lib/tapTempo';
import { runtimeStore, toolsStore } from '../../services/stores';
import { Card, Field, RangeRow, Segmented, Toggle } from './ui';

export function MetronomePanel() {
  const tools = useStore(toolsStore);
  const runtime = useStore(runtimeStore);
  const tapper = useRef(new TapTempo());

  const setBpm = (bpm: number) => toolsStore.set({ bpm });

  return (
    <Card title={tr('Metrônomo e MIDI Clock')} Icon={Timer} accent="text-[var(--nexus-primary)]">
      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label={tr('Diminuir BPM')} onClick={() => setBpm(tools.bpm - 1)} className="h-11 w-11 rounded-xl bg-[var(--bg-elevated)] text-xl font-bold text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors">
          −
        </button>
        <div className="text-center">
          <div className="font-mono text-4xl font-bold tabular-nums text-[var(--text-main)]">{tools.bpm}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">BPM</div>
        </div>
        <button type="button" aria-label={tr('Aumentar BPM')} onClick={() => setBpm(tools.bpm + 1)} className="h-11 w-11 rounded-xl bg-[var(--bg-elevated)] text-xl font-bold text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors">
          +
        </button>
      </div>
      <input type="range" aria-label="BPM" min={20} max={300} value={tools.bpm} onChange={(e) => setBpm(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--nexus-primary)]" />
      <button
        type="button"
        onClick={() => {
          const bpm = tapper.current.tap(performance.now());
          if (bpm) setBpm(bpm);
        }}
        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-main)] transition hover:bg-[var(--bg-elevated)] active:scale-[0.98]"
      >
        {tr('Tap tempo')}
      </button>

      <Field label={tr('Tempos por compasso')}>
        <Segmented value={tools.beatsPerBar} options={[2, 3, 4, 6].map((n) => ({ id: n, label: String(n) }))} onChange={(beatsPerBar) => toolsStore.set({ beatsPerBar })} />
      </Field>
      <RangeRow label={tr('Volume do clique')} value={tools.metronomeVolume} min={0} max={100} unit="%" onChange={(metronomeVolume) => toolsStore.set({ metronomeVolume })} />
      <Toggle checked={runtime.metronomeOn} onChange={(metronomeOn) => runtimeStore.set({ metronomeOn })} label={tr('Metrônomo (clique)')} />
      <Toggle
        checked={runtime.clockOut}
        onChange={(clockOut) => runtimeStore.set({ clockOut })}
        label={tr('Enviar MIDI Clock')}
        hint={tr('Start/Stop e 24 pulsos por tempo para os dispositivos conectados.')}
      />
    </Card>
  );
}
