import { useState } from 'react';
import { Library, Search } from 'lucide-react';
import { channelColor } from '../../constants/channelColors';
import { PRESET_CATEGORIES } from '../../constants/gm';
import { tr } from '../../i18n';
import type { SoundFontPreset } from '../../types/soundfont';

interface SoundFontListProps {
  /** Instrumentos realmente presentes nos SoundFonts ligados (vazio = nada importado/ligado). */
  instruments: SoundFontPreset[];
  activeChannel: number;
  channelAssignments: Record<number, number>;
  channelBanks: Record<number, number>;
  onAssignProgram: (preset: SoundFontPreset) => void;
  /** Há SoundFonts na biblioteca (mesmo que todos estejam desligados)? */
  hasLibrary: boolean;
  /** Mais de um SoundFont ligado: mostra de qual vem cada instrumento. */
  showLibraryName: boolean;
  onOpenLibrary: () => void;
}

export function SoundFontList({
  instruments, activeChannel, channelAssignments, channelBanks, onAssignProgram,
  hasLibrary, showLibraryName, onOpenLibrary,
}: SoundFontListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const term = searchTerm.toLowerCase();
  const filtered = instruments.filter((preset) => {
    const matchesSearch = preset.name.toLowerCase().includes(term) || String(preset.programNumber).includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || preset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const bankOf = (ch: number): number => channelBanks[ch] ?? 0;
  const isAssigned = (preset: SoundFontPreset, ch: number): boolean =>
    channelAssignments[ch] === preset.programNumber && bankOf(ch) === preset.bankNumber;
  const channelsOf = (preset: SoundFontPreset): number[] =>
    Object.keys(channelAssignments).map(Number).filter((ch) => isAssigned(preset, ch)).sort((a, b) => a - b);

  if (instruments.length === 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2E323B] p-6 text-center text-slate-400">
        <Library size={36} className="mb-3 opacity-40" />
        <p className="text-sm font-semibold text-slate-300">
          {hasLibrary ? tr('Nenhuma biblioteca ligada.') : tr('Nenhum instrumento ainda.')}
        </p>
        <p className="mt-1 max-w-xs text-xs">
          {hasLibrary
            ? tr('Abra a Biblioteca e ligue um ou mais SoundFonts para ver os instrumentos.')
            : tr('Toque em "Importar SF2" para adicionar um SoundFont. Os instrumentos dele aparecem aqui.')}
        </p>
        {hasLibrary && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="mt-3 flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-xs font-bold text-white hover:bg-cyan-500"
          >
            <Library size={14} /> {tr('Abrir Biblioteca')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={tr('Buscar preset...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#2E323B] bg-[#121316] py-1 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-400">
            <span className="font-semibold text-slate-200">{filtered.length}</span> {tr('sons')}
            {filtered.length !== instruments.length && <span className="text-slate-500"> / {instruments.length}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PRESET_CATEGORIES.map((cat) => {
            const count = cat === 'Todos' ? instruments.length : instruments.filter((i) => i.category === cat).length;
            if (cat !== 'Todos' && count === 0) return null; // só mostra categorias que existem nos SoundFonts
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                  selectedCategory === cat ? 'bg-cyan-600 text-white' : 'bg-[#23262D] text-slate-300 hover:bg-[#2E323B]'
                }`}
              >
                {tr(cat)} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1.5">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">{tr('Nenhum instrumento encontrado.')}</p>
        )}
        {filtered.map((preset) => {
          const isActive = isAssigned(preset, activeChannel);
          const channels = channelsOf(preset);
          return (
            <div
              key={preset.id}
              onClick={() => onAssignProgram(preset)}
              className={`group flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 transition-all ${
                isActive
                  ? 'border-cyan-500/70 bg-cyan-500/10'
                  : 'border-[#2E323B] bg-[#1A1C21] hover:border-slate-500 hover:bg-[#23262D]'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md font-mono ${isActive ? 'bg-cyan-600 text-white' : 'bg-[#121316] text-slate-300'}`}>
                  <span className="text-[7px] uppercase opacity-80">{preset.isDrum ? 'KIT' : 'PRG'}</span>
                  <span className="text-[11px] font-bold">{String(preset.programNumber).padStart(3, '0')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={`truncate text-sm font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-100'}`}>{preset.name}</h4>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-slate-400">
                    <span className="font-medium">{tr(preset.category)}</span>
                    {preset.bankNumber > 0 && !preset.isDrum && <span className="font-mono text-slate-500">B{preset.bankNumber}</span>}
                    {showLibraryName && <span className="truncate text-slate-500">· {preset.libraryName}</span>}
                  </div>
                </div>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                {channels.map((ch) => (
                  <span
                    key={ch}
                    title={tr('Canal {n}', { n: ch })}
                    className="flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-bold text-[#121316]"
                    style={{ backgroundColor: channelColor(ch) }}
                  >
                    {ch}
                  </span>
                ))}
                {channels.length === 0 && (
                  <span className="rounded px-2 py-0.5 text-[9px] font-semibold text-slate-500 group-hover:text-cyan-400">{tr('ALOCAR')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
