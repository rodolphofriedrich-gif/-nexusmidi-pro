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
      active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`;

  return (
    <div className="flex w-full h-full flex-col bg-[#0a0f1c]">
      
      {/* SUB-ABAS DE FERRAMENTAS */}
      <div className="flex items-center gap-2 p-2 border-b border-[#1e293b] bg-[#0f172a] shrink-0">
        <button onClick={() => setActiveTool('performance')} className={btnClass(activeTool === 'performance')}>
          <Sparkles size={14} className="text-cyan-400" /> {tr('PERFORMANCE')}
        </button>
        <button onClick={() => setActiveTool('arp')} className={btnClass(activeTool === 'arp')}>
          <Music size={14} className="text-fuchsia-400" /> {tr('ARRANJADOR')}
        </button>
        <button onClick={() => setActiveTool('metronome')} className={btnClass(activeTool === 'metronome')}>
          <Timer size={14} className="text-emerald-400" /> {tr('Metrônomo e MIDI Clock')}
        </button>
      </div>

      {/* CONTEÚDO DA ABA ATIVA */}
      <div className="custom-scrollbar w-full flex-1 overflow-y-auto p-2 sm:p-4 text-slate-100">
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
