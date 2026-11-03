import type { ToastType } from '../hooks/useToast';
import { ArpPanel } from './tools/ArpPanel';
import { GeneralPanel } from './tools/GeneralPanel';
import { LearnPanel } from './tools/LearnPanel';
import { MetronomePanel } from './tools/MetronomePanel';
import { PerformancePanel } from './tools/PerformancePanel';
import { RecorderPanel } from './tools/RecorderPanel';

export function ToolsScreen({ onStatus }: { onStatus: (message: string, type?: ToastType) => void }) {
  return (
    <div className="custom-scrollbar w-full h-full overflow-y-auto bg-[#0a0f1c] p-2 sm:p-4 text-slate-100">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <PerformancePanel />
          <ArpPanel />
        </div>
        <div className="flex flex-col gap-3">
          <MetronomePanel />
          <RecorderPanel onStatus={onStatus} />
          <LearnPanel />
          <GeneralPanel />
        </div>
      </div>
    </div>
  );
}
