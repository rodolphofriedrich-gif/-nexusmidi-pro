import { X } from 'lucide-react';
import { tr } from '../../i18n';

interface ChannelSelectPopupProps {
  title: string;
  value: number;
  onSelect: (ch: number) => void;
  onClose: () => void;
}

export function ChannelSelectPopup({ title, value, onSelect, onClose }: ChannelSelectPopupProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">{title}</h3>
          <button type="button" aria-label={tr('Fechar')} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4">
          {Array.from({ length: 16 }, (_, i) => {
            const ch = i + 1;
            const selected = value === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => { onSelect(ch); onClose(); }}
                className={`h-12 rounded-lg border font-mono text-sm transition-colors ${
                  selected
                    ? 'border-indigo-500/60 bg-indigo-500/20 font-bold text-[var(--nexus-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {String(ch).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
