import { ChevronDown, ChevronUp, Library, Trash2 } from 'lucide-react';
import { tr } from '../../i18n';
import type { LibrarySnapshot } from '../../services/soundFontLibrary';

interface Props {
  library: LibrarySnapshot;
  onToggle: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function SoundFontLibraryPanel({ library, onToggle, onMove, onRemove }: Props) {
  if (library.items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2E323B] p-6 text-center text-slate-400">
        <Library size={40} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">{tr('Sua biblioteca está vazia.')}</p>
        <p className="mt-1 text-xs">{tr('Toque em "Importar SF2" para adicionar seu primeiro SoundFont.')}</p>
      </div>
    );
  }

  // Ligadas primeiro (na ordem de prioridade), depois as desligadas.
  const byId = new Map(library.items.map((item) => [item.id, item] as const));
  const active = library.activeIds.flatMap((id) => byId.get(id) ?? []);
  const inactive = library.items.filter((item) => !library.activeIds.includes(item.id));
  const ordered = [...active, ...inactive];

  const totalInstruments = library.activeIds.reduce((sum, id) => sum + (library.presets[id]?.length ?? byId.get(id)?.presetCount ?? 0), 0);

  return (
    <div className="space-y-1.5 pr-1.5">
      <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-slate-400">
        <span>
          <b className="text-slate-100">{active.length}</b> {tr('de')} {library.items.length} {tr('ligadas')}
        </span>
        <span>
          <b className="text-slate-100">{totalInstruments}</b> {tr('instrumentos')}
        </span>
      </div>

      {ordered.map((item) => {
        const position = library.activeIds.indexOf(item.id);
        const isOn = position >= 0;
        const count = library.presets[item.id]?.length ?? item.presetCount;
        const drums = item.drumKitCount ?? library.presets[item.id]?.filter((p) => p.bank >= 128).length;
        return (
          <div
            key={item.id}
            className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
              isOn ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-[#2E323B] bg-[#1A1C21]'
            }`}
          >
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              aria-label={tr('Ligar {name}', { name: item.name })}
              disabled={library.busy}
              onClick={() => onToggle(item.id)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${isOn ? 'bg-cyan-500' : 'bg-[#3A3E47]'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${isOn ? 'left-[22px]' : 'left-0.5'}`} />
            </button>

            <div className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-semibold ${isOn ? 'text-cyan-200' : 'text-slate-300'}`}>{item.name}</span>
              <span className="block truncate text-[10px] text-slate-400">
                {formatSize(item.size)}
                {count !== undefined && <> · {count} {tr('instrumentos')}</>}
                {drums ? <> · {drums} {tr('baterias')}</> : null}
              </span>
            </div>

            {isOn && (
              <div className="flex shrink-0 items-center gap-0.5" title={tr('Prioridade')}>
                <button
                  type="button"
                  aria-label={tr('Aumentar prioridade')}
                  disabled={library.busy || position === 0}
                  onClick={() => onMove(item.id, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-[#2E323B] disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <span className="w-5 text-center font-mono text-xs font-bold text-cyan-300">{position + 1}</span>
                <button
                  type="button"
                  aria-label={tr('Diminuir prioridade')}
                  disabled={library.busy || position === library.activeIds.length - 1}
                  onClick={() => onMove(item.id, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-[#2E323B] disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}

            <button
              type="button"
              aria-label={tr('Excluir {name}', { name: item.name })}
              disabled={library.busy}
              onClick={() => onRemove(item.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      {active.length > 1 && (
        <p className="px-1 pt-1 text-[10px] leading-snug text-slate-500">
          {tr('Se dois SoundFonts tiverem o mesmo instrumento, vale o que estiver mais acima (prioridade 1).')}
        </p>
      )}
    </div>
  );
}
