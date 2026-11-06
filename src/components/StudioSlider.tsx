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
    <div className="mb-2 flex w-full items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-sm">
      
      <div className="flex w-[90px] shrink-0 flex-col sm:w-[110px]">
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)]">
          {label}
        </span>
        {sublabel && (
          <span className="truncate font-mono text-[9px] text-[var(--text-muted)]">{sublabel}</span>
        )}
      </div>

      <div className="relative flex h-9 flex-1 items-center select-none">
        <div className="absolute inset-x-0 h-2.5 overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] shadow-inner">
          <div
            className="absolute bottom-0 left-0 top-0 rounded-full bg-[var(--nexus-primary)] shadow-[0_0_8px_rgba(99,102,241,0.35)] transition-all duration-75 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div
          className="pointer-events-none absolute z-10 flex h-8 w-5 -translate-x-1/2 flex-col items-center justify-center gap-[2px] rounded-[4px] border border-slate-400/60 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition-all duration-75 ease-out"
          style={{ left: `${percent}%` }}
        >
          <div className="h-[1px] w-3 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="h-[1px] w-3 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="h-[1px] w-3 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <div className="flex w-12 shrink-0 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-app)] py-1 shadow-inner">
        <span className="font-mono text-[12px] font-bold text-[var(--nexus-primary)]">
          {value}
          {unit && <span className="ml-0.5 text-[9px] text-[var(--text-muted)]">{unit}</span>}
        </span>
      </div>
      
    </div>
  );
}
