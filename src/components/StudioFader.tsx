interface StudioFaderProps {
  label: string;
  sublabel?: string;
  value: number;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  unit?: string;
}

export function StudioFader({
  label,
  sublabel,
  value,
  max = 127,
  min = 0,
  onChange,
  onCommit,
  unit = ''
}: StudioFaderProps) {

  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const getLedColor = () => {
    if (percent > 85) return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
    if (percent > 65) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
    return 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]';
  };

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-lg w-full max-w-[80px] mx-auto h-full">
      
      {/* Cabeçalho do Fader */}
      <div className="text-center w-full shrink-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate">{label}</span>
        {sublabel && <span className="block text-[9px] text-slate-500 font-mono mt-0.5">{sublabel}</span>}
      </div>

      {/* Área do Fader Vertical (Flexível) */}
      <div className="relative flex-1 w-full flex justify-center select-none min-h-[80px]">
        
        {/* Trilho de Fundo (Sulco) */}
        <div className="absolute top-2 bottom-2 w-2 bg-[#05080f] rounded-full border border-[#1e293b] overflow-hidden shadow-inner">
          <div 
            className={`absolute bottom-0 w-full rounded-full transition-all duration-75 ease-out ${getLedColor()}`}
            style={{ height: `${percent}%` }}
          />
        </div>

        {/* Marcações de Escala (Ticks) */}
        <div className="absolute top-2 bottom-2 right-0 w-1.5 flex flex-col justify-between">
          {[0, 32, 64, 96, 127].map((tick) => (
            <div key={tick} className="w-1.5 h-px bg-slate-600/50" />
          ))}
        </div>

        {/* Input Invisível */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
          style={{
            WebkitAppearance: 'slider-vertical',
            writingMode: 'vertical-lr',
            direction: 'rtl'
          }}
        />

        {/* Cabo do Fader - Maior e mais tátil */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-8 h-10 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 border border-slate-400/80 rounded-md shadow-[0_4px_8px_rgba(0,0,0,0.8)] z-10 pointer-events-none flex flex-col items-center justify-center gap-[3px]"
          style={{ bottom: `calc(${percent}% - 20px)` }}
        >
          <div className="w-5 h-[1.5px] bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="w-5 h-[1.5px] bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="w-5 h-[1.5px] bg-slate-900/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
        </div>
      </div>

      {/* Visor do Valor */}
      <div className="w-full shrink-0 bg-[#0a0f1c] border border-[#1e293b] rounded-md py-1 text-center shadow-inner">
        <span className="font-mono text-[12px] font-bold text-cyan-400">
          {value}
          <span className="text-[9px] text-slate-500 ml-0.5">{unit}</span>
        </span>
      </div>
    </div>
  );
}
