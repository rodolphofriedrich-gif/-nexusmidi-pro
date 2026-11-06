import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Card({ title, Icon, accent = 'text-[var(--nexus-primary)]', children }: { title: string; Icon: LucideIcon; accent?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-md">
      <h3 className={`mb-3 flex items-center gap-2 border-b border-[var(--border-color)] pb-2 text-xs font-bold uppercase tracking-wider ${accent}`}>
        <Icon size={15} /> {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      {children}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-0.5">
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors ${
            option.id === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--text-main)]">{label}</p>
        {hint && <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-[var(--bg-elevated)]'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function RangeRow({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[11px] font-bold text-[var(--text-main)]">
        <span>{label}</span>
        <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[var(--nexus-primary)]">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--nexus-primary)]" />
    </label>
  );
}

export const selectClass =
  'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-2 text-xs font-semibold text-[var(--text-main)] outline-none focus:border-indigo-500';
