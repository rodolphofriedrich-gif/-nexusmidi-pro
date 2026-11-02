import React, { useState } from 'react';
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
      {/* Header do Estúdio */}
      <div className="flex items-center gap-1 p-2 bg-[#0f172a] border-b border-[#1e293b] shrink-0">
        <button
          onClick={() => setActiveTab('synth')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'synth' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <AudioWaveform size={16} /> Sintetizador
        </button>
        <button
          onClick={() => setActiveTab('mixer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'mixer' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <SlidersHorizontal size={16} /> Mixer / CC
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'tools' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <WandSparkles size={16} /> Ferramentas
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === 'synth' && <SoundFontScreen onStatus={onStatus} />}
        {activeTab === 'mixer' && <MidiControlsScreen channel={1} isConnected={true} onStatus={onStatus} />} {/* O canal 1 pode ser dinâmico depois */}
        {activeTab === 'tools' && <ToolsScreen onStatus={onStatus} />}
      </div>
    </div>
  );
}
