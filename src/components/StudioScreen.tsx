import { useState } from 'react';
import { AudioWaveform, SlidersHorizontal, WandSparkles } from 'lucide-react';
import { MidiControlsScreen } from './MidiControlsScreen';
import { SoundFontScreen } from './SoundFontScreen';
import { ToolsScreen } from './ToolsScreen';

interface StudioScreenProps {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

export function StudioScreen({ onStatus }: StudioScreenProps) {
  const [activeTab, setActiveTab] = useState<'synth' | 'mixer' | 'tools'>('synth');

  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-[#0a0f1c]">
      {/* Título e Abas em uma única barra */}
      <div className="flex items-center gap-2 p-2 bg-[#0f172a] border-b border-[#1e293b] shrink-0">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 mr-2 px-2">
          Estúdio
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('synth')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === 'synth' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <AudioWaveform size={14} /> Sintetizador
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mixer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === 'mixer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <SlidersHorizontal size={14} /> Mixer / CC
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === 'tools' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <WandSparkles size={14} /> Ferramentas
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === 'synth' && <SoundFontScreen onStatus={onStatus} />}
        {activeTab === 'mixer' && <MidiControlsScreen channel={1} isConnected={true} onStatus={onStatus} />}
        {activeTab === 'tools' && <ToolsScreen onStatus={onStatus} />}
      </div>
    </div>
  );
}
