import { MidiControlsScreen } from './MidiControlsScreen';
import { SoundFontScreen } from './SoundFontScreen';
import { ToolsScreen } from './ToolsScreen';

interface StudioScreenProps {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  activeTab: 'synth' | 'mixer' | 'tools';
}

export function StudioScreen({ onStatus, activeTab }: StudioScreenProps) {
  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-[#121316]">
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === 'synth' && <SoundFontScreen onStatus={onStatus} />}
        {activeTab === 'mixer' && <MidiControlsScreen channel={1} isConnected={true} onStatus={onStatus} />}
        {activeTab === 'tools' && <ToolsScreen onStatus={onStatus} />}
      </div>
    </div>
  );
}
