import { useEffect, useRef } from 'react';
import { Menu, type LucideIcon } from 'lucide-react';
import { tr } from '../i18n';

export interface NavItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Classe de cor do texto (ex.: `text-cyan-400`). */
  textClass: string;
}

interface Props {
  items: readonly NavItem[];
  activeId: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function NavMenu({ items, activeId, isOpen, onToggle, onClose, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={tr('Menu de navegação')}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="nexus-brand flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-800"
      >
        <Menu size={18} className="text-cyan-400" />
        <span className="nexus-brand-name hidden whitespace-nowrap text-xs font-extrabold tracking-wider xs:inline sm:text-sm">
          NEXUSMIDI <span>Pro</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[150] mt-2 flex max-h-[80vh] w-56 flex-col overflow-hidden rounded-xl border border-[#2e323b] bg-[#1a1c21] shadow-2xl">
          <div className="shrink-0 border-b border-[#2e323b] bg-[#121316] px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tr('Navegação')}</p>
          </div>
          <div className="custom-scrollbar flex flex-col gap-0.5 overflow-y-auto p-1">
            {items.map(({ id, label, Icon, textClass }) => {
              const selected = activeId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    selected ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <div className={`rounded-md p-1.5 ${selected ? 'bg-slate-700' : 'bg-[#121316]'}`}>
                    <Icon size={16} className={selected ? textClass : ''} />
                  </div>
                  <span className={`text-xs font-semibold ${selected ? 'text-white' : ''}`}>{label}</span>
                  {selected && <div className={`ml-auto h-1.5 w-1.5 rounded-full ${textClass.replace('text-', 'bg-')}`} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
