import { LogOut } from 'lucide-react';
import { tr } from '../i18n';

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExitDialog({ onCancel, onConfirm }: Props) {
  return (
    <div
      className="nexus-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <section role="dialog" aria-modal="true" className="nexus-modal w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-2xl sm:p-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <LogOut size={27} />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--text-main)]">{tr('Fechar aplicativo?')}</h2>
        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">{tr('Deseja realmente sair do NexusMIDI Pro?')}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="rounded bg-[var(--bg-elevated)] p-2 text-[var(--text-main)] transition-colors hover:bg-[var(--bg-panel)]">
            {tr('Cancelar')}
          </button>
          <button type="button" onClick={onConfirm} className="flex items-center justify-center gap-2 rounded bg-red-600 p-2 text-white transition-colors hover:bg-red-500">
            <LogOut size={16} /> {tr('Sair')}
          </button>
        </div>
      </section>
    </div>
  );
}
