import { useState } from 'react';
import { Search } from 'lucide-react';
import { PRESET_CATEGORIES } from '../../constants/gm';
import { tr } from '../../i18n';
import type { SoundFontPreset } from '../../types/soundfont';

interface SoundFontListProps {
  soundFonts: SoundFontPreset[];
  activeChannel: number;
  channelAssignments: Record<number, number>;
  onAssignProgram: (preset: SoundFontPreset) => void;
}

export function SoundFontList({
  soundFonts, activeChannel, channelAssignments, onAssignProgram,
}: SoundFontListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const categories = PRESET_CATEGORIES;

  const filteredPresets = soundFonts.filter((preset) => {
    const matchesSearch = preset.name.toLowerCase().includes(searchTerm.toLowerCase()) || String(preset.programNumber).includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || preset.category.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const isPresetActive = (progNum: number) => channelAssignments[activeChannel] === progNum;

  const getPresetChannels = (progNum: number) => {
    const channels: number[] = [];
    Object.entries(channelAssignments).forEach(([ch, prog]) => {
      if (prog === progNum) channels.push(Number(ch));
    });
    return channels;
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      
      <div className="flex flex-col gap-1.5 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder={tr('Buscar preset...')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1 rounded-lg text-xs bg-[#0a0f1c] border border-[#1e293b] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-7 sm:h-8" />
          </div>
          <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">
            <span className="font-semibold text-slate-300">{filteredPresets.length}</span> {tr('sons')}
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <button type="button" key={cat} onClick={() => setSelectedCategory(cat)} className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-cyan-600 text-white shadow-xs font-semibold' : 'bg-[#0a0f1c] text-slate-400 hover:bg-slate-800'}`}>
              {tr(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0 custom-scrollbar">
        {filteredPresets.map((preset) => {
          const isActive = isPresetActive(preset.programNumber);
          const activeChannels = getPresetChannels(preset.programNumber);
          
          return (
            <div key={preset.id} onClick={() => onAssignProgram(preset)} className={`group flex items-center justify-between py-2 px-2.5 rounded-xl border cursor-pointer transition-all ${isActive ? 'border-cyan-500 bg-cyan-900/20 ring-1 ring-cyan-500/30' : 'border-[#1e293b] bg-[#0f172a] hover:border-slate-600 hover:bg-slate-800'}`}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-mono shrink-0 transition-colors ${isActive ? 'bg-cyan-600 text-white shadow-xs' : 'bg-[#0a0f1c] text-slate-400'}`}>
                  <span className="text-[7px] uppercase opacity-80">PRG</span>
                  <span className="text-[11px] font-bold">{String(preset.programNumber).padStart(3, '0')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>{preset.name}</h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate mt-0.5">
                    <span className="font-medium text-slate-400">{tr(preset.category)}</span>
                    {activeChannels.length > 0 && (
                      <span className="text-cyan-500/80 font-mono ml-1">
                        {tr('(Ativo: CH {channels})', { channels: activeChannels.join(', ') })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded transition-colors ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`}>
                {isActive ? tr('ATIVO') : tr('ALOCAR')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
