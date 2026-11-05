import { Sparkles } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { tr } from '../../i18n';
import { NOTE_ROOTS } from '../../lib/midiMath';
import { CHORDS, SCALES, type ChordId, type ScaleId } from '../../lib/scales';
import { VELOCITY_CURVES, type VelocityCurve } from '../../lib/velocity';
import { prefsStore, toolsStore } from '../../services/stores';
import { Card, Field, RangeRow, Segmented, selectClass } from './ui';

const CURVE_LABELS: Record<VelocityCurve, string> = {
  linear: 'Linear',
  soft: 'Suave',
  hard: 'Forte',
  fixed: 'Fixa',
};

export function PerformancePanel() {
  const prefs = useStore(prefsStore);
  const tools = useStore(toolsStore);

  return (
    <Card title={tr('Performance')} Icon={Sparkles} accent="text-indigo-400">
      <Field label={tr('Curva de velocity')}>
        <Segmented
          value={prefs.velocityCurve}
          options={VELOCITY_CURVES.map((c) => ({ id: c.id, label: tr(CURVE_LABELS[c.id]) }))}
          onChange={(velocityCurve) => prefsStore.set({ velocityCurve })}
        />
      </Field>
      {prefs.velocityCurve === 'fixed' && (
        <RangeRow label={tr('Velocity fixa')} value={tools.fixedVelocity} min={1} max={127} onChange={(fixedVelocity) => toolsStore.set({ fixedVelocity })} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={tr('Tônica')}>
          <select className={selectClass} value={tools.scaleRoot} onChange={(e) => toolsStore.set({ scaleRoot: Number(e.target.value) })}>
            {NOTE_ROOTS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('Escala')}>
          <select className={selectClass} value={tools.scale} onChange={(e) => toolsStore.set({ scale: e.target.value as ScaleId })}>
            {(Object.keys(SCALES) as ScaleId[]).map((id) => (
              <option key={id} value={id}>
                {tr(SCALES[id].name)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-1 text-[10px] text-[var(--text-muted)]">{tr('Com uma escala ativa, notas fora dela são ajustadas para a mais próxima.')}</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tr('Acorde de um toque')}>
          <select className={selectClass} value={tools.chord} onChange={(e) => toolsStore.set({ chord: e.target.value as ChordId })}>
            {(Object.keys(CHORDS) as ChordId[]).map((id) => (
              <option key={id} value={id}>
                {tr(CHORDS[id].name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('Inversão')}>
          <Segmented
            value={tools.chordInversion}
            options={[0, 1, 2, 3].map((n) => ({ id: n, label: String(n) }))}
            onChange={(chordInversion) => toolsStore.set({ chordInversion })}
          />
        </Field>
      </div>
    </Card>
  );
}
