interface StudioSliderProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

/**
 * Slider horizontal com o DNA visual do StudioFader (faders do Mixer/CC):
 * mesma paleta (índigo = controle), mesmo visor do valor em mono, mesma trilha afundada.
 * Diferença: layout horizontal compacto (~34px por slider) e polegar circular.
 */
export function StudioSlider({
  label,
  sublabel,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: StudioSliderProps) {
  const range = max - min;
  const percent = range > 0 ? Math.max(0, Math.min(100, ((value - min) / range) * 100)) : 0;

  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)]">
            {label}
          </span>
          {sublabel && (
            <span className="shrink-0 font-mono text-[9px] text-[var(--text-muted)]">{sublabel}</span>
          )}
        </div>
        <span className="shrink-0 rounded border border-indigo-900/50 bg-indigo-950/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-400">
          {value}
          {unit}
        </span>
      </div>

      <div className="relative h-5">
        <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] shadow-inner">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          style={{ left: `${percent}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
