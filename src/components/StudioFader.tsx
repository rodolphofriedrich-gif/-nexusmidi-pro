interface StudioFaderProps {
  label: string;
  sublabel?: string;
  value: number;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  unit?: string;
  /** `level` = medidor de nível (verde → amarelo → vermelho, só para volume). `accent` = índigo (controle). */
  tone?: 'accent' | 'level';
}

export function StudioFader({
  label,
  sublabel,
  value,
  max = 127,
  min = 0,
  onChange,
  onCommit,
  unit = '',
  tone = 'accent',
}: StudioFaderProps) {

  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const getLedColor = () => {
    if (tone === 'accent') return 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.35)]';
    if (percent > 85) return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
    if (percent > 65) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
    return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]';
  };

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-[80px] mx-auto h-full">
      
      {/* Cabeçalho do Fader */}
      <div className="text-center w-full shrink-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)] truncate">{label}</span>
        {sublabel && <span className="mt-0.5 block whitespace-nowrap text-[9px] font-mono text-[var(--text-muted)]">{sublabel}</span>}
      </div>

      {/* Área do Fader Vertical (Flexível). A "pista" fica 16px mais curta em cima e embaixo:
          assim o cabo (32px) nunca passa por cima do nome nem do valor. */}
      <div className="relative w-full flex-1 select-none min-h-[88px]">
        <div className="absolute inset-x-0 top-4 bottom-4">
          {/* Trilho de Fundo (Sulco) */}
          <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] shadow-inner">
            <div
              className={`absolute bottom-0 w-full rounded-full transition-all duration-75 ease-out ${getLedColor()}`}
              style={{ height: `${percent}%` }}
            />
          </div>

          {/* Marcações de Escala (Ticks) */}
          <div className="absolute inset-y-0 right-0 flex w-1.5 flex-col justify-between">
            {[0, 32, 64, 96, 127].map((tick) => (
              <div key={tick} className="h-px w-1.5 bg-[var(--text-muted)]/60" />
            ))}
          </div>

          {/* Input invisível: ocupa a pista +8px de cada lado, que é o curso do polegar nativo */}
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
            className="absolute inset-x-0 -bottom-2 -top-2 z-20 h-[calc(100%+16px)] w-full cursor-ns-resize opacity-0"
            style={{
              WebkitAppearance: 'slider-vertical',
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
          />

          {/* Cabo do Fader: o centro dele acompanha exatamente o fim do preenchimento */}
          <div
            className="pointer-events-none absolute left-1/2 z-10 flex h-8 w-9 -translate-x-1/2 flex-col items-center justify-center gap-[3px] rounded-md border border-slate-400/60 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
            style={{ bottom: `calc(${percent}% - 16px)` }}
          >
            <div className="h-[1.5px] w-5 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
            <div className="h-[1.5px] w-5 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
            <div className="h-[1.5px] w-5 bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          </div>
        </div>
      </div>

      {/* Visor do Valor */}
      <div className="w-full shrink-0 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-md py-1 text-center shadow-inner">
        <span className="font-mono text-[12px] font-bold text-indigo-400">
          {value}
          <span className="text-[9px] text-[var(--text-muted)] ml-0.5">{unit}</span>
        </span>
      </div>
    </div>
  );
}
