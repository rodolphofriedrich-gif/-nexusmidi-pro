import { useEffect, useState } from 'react';

interface VuMeterProps {
  level: number; // 0 a 127
}

export function VuMeter({ level }: VuMeterProps) {
  const [displayLevel, setDisplayLevel] = useState(0);

  useEffect(() => {
    if (level > displayLevel) {
      setDisplayLevel(level);
    } else {
      const timer = setInterval(() => {
        setDisplayLevel((prev) => {
          if (prev <= level) {
            clearInterval(timer);
            return level;
          }
          return Math.max(0, prev - 5);
        });
      }, 30);
      return () => clearInterval(timer);
    }
  }, [level, displayLevel]);

  // Altura em porcentagem (0 a 100)
  const percent = Math.max(0, Math.min(100, (displayLevel / 127) * 100));

  return (
    <div className="w-3 h-full bg-[#0e0f12] border border-[#2e323b] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-end p-[2px]">
      <div
        className="w-full rounded-full transition-all duration-75 ease-out"
        style={{
          height: `${percent}%`,
          // Gradiente estilo mesa de som: Verde -> Amarelo -> Vermelho
          background: 'linear-gradient(to top, #10b981 0%, #10b981 60%, #f59e0b 85%, #ef4444 100%)',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
        }}
      />
    </div>
  );
}
