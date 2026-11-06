import { MidiControlsScreen } from './MidiControlsScreen';
import { SoundFontScreen } from './SoundFontScreen';
import { ToolsScreen } from './ToolsScreen';

interface StudioScreenProps {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  activeTab: 'synth' | 'mixer' | 'tools';
  channel: number;
  isConnected: boolean;
}

export function StudioScreen({ onStatus, activeTab, channel, isConnected }: StudioScreenProps) {
  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-[var(--bg-app)]">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'synth' && <SoundFontScreen onStatus={onStatus} />}
        {activeTab === 'mixer' && <MidiControlsScreen channel={channel} isConnected={isConnected} onStatus={onStatus} />}
        {activeTab === 'tools' && <ToolsScreen onStatus={onStatus} />}
      </div>
    </div>
  );
}
