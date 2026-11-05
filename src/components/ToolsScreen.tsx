import { useState } from 'react';
import { Sparkles, Music, Timer } from 'lucide-react';
import type { ToastType } from '../hooks/useToast';
import { tr } from '../i18n';
import { ArpPanel } from './tools/ArpPanel';
import { GeneralPanel } from './tools/GeneralPanel';
import { LearnPanel } from './tools/LearnPanel';
import { MetronomePanel } from './tools/MetronomePanel';
import { PerformancePanel } from './tools/PerformancePanel';
import { RecorderPanel } from './tools/RecorderPanel';

export function ToolsScreen({ onStatus }: { onStatus: (message: string, type?: ToastType) => void }) {
  const [activeTool, setActiveTool] = useState<'performance' | 'arp' | 'metronome'>('performance');

  const btnClass = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${
      active ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-main)]'
    }`;

  const iconClass = (active: boolean) => (active ? 'text-white' : 'text-indigo-400/70');

  return (
    <div className="flex w-full h-full flex-col bg-[var(--bg-app)]">
      
      {/* SUB-ABAS DE FERRAMENTAS */}
      <div className="flex items-center gap-2 p-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0">
        <button onClick={() => setActiveTool('performance')} className={btnClass(activeTool === 'performance')}>
          <Sparkles size={14} className={iconClass(activeTool === 'performance')} /> {tr('PERFORMANCE')}
        </button>
        <button onClick={() => setActiveTool('arp')} className={btnClass(activeTool === 'arp')}>
          <Music size={14} className={iconClass(activeTool === 'arp')} /> {tr('ARRANJADOR')}
        </button>
        <button onClick={() => setActiveTool('metronome')} className={btnClass(activeTool === 'metronome')}>
          <Timer size={14} className={iconClass(activeTool === 'metronome')} /> {tr('Metrônomo e MIDI Clock')}
        </button>
      </div>

      {/* CONTEÚDO DA ABA ATIVA */}
      <div className="custom-scrollbar w-full flex-1 overflow-y-auto p-2 sm:p-4 text-[var(--text-main)]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 lg:grid-cols-2">
          {activeTool === 'performance' && (
            <>
              <div className="flex flex-col gap-3">
                <PerformancePanel />
                <LearnPanel />
              </div>
              <div className="flex flex-col gap-3">
                <GeneralPanel />
              </div>
            </>
          )}

          {activeTool === 'arp' && (
            <>
              <div className="flex flex-col gap-3">
                <ArpPanel />
              </div>
              <div className="flex flex-col gap-3">
                <RecorderPanel onStatus={onStatus} />
              </div>
            </>
          )}

          {activeTool === 'metronome' && (
            <div className="flex flex-col gap-3 lg:col-span-2">
              <MetronomePanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
