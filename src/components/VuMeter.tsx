import { useEffect, useRef } from 'react';

interface VuMeterProps {
  level: number; // 0 a 127
}

export function VuMeter({ level }: VuMeterProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const displayLevelRef = useRef(0);

  useEffect(() => {
    let rafId: number;
    
    const animate = () => {
      const target = level;
      const current = displayLevelRef.current;

      if (target > current) {
        // Sobe instantaneamente para responder ao toque
        displayLevelRef.current = target;
      } else if (current > target) {
        // Desce suavemente (decay)
        displayLevelRef.current = Math.max(0, current - 4);
      }

      // Atualiza o DOM diretamente (muito mais rápido que setState)
      if (fillRef.current) {
        const percent = Math.max(0, Math.min(100, (displayLevelRef.current / 127) * 100));
        fillRef.current.style.height = `${percent}%`;
      }

      // Continua o loop se ainda houver diferença entre o valor atual e o alvo
      if (displayLevelRef.current !== target || displayLevelRef.current > 0) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId);
  }, [level]);

  return (
    <div className="w-3 h-full bg-[var(--nexus-bg-bottom)] border border-[var(--nexus-border-strong)] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-end p-[2px]">
      <div
        ref={fillRef}
        className="w-full rounded-full transition-none"
        style={{
          height: '0%', // O React não controla mais isso, quem controla é o rAF
          background: 'linear-gradient(to top, #22d3ee 0%, #22d3ee 60%, #fbbf24 85%, #ef4444 100%)',
          boxShadow: '0 0 8px rgba(34, 211, 238, 0.5)'
        }}
      />
    </div>
  );
}
