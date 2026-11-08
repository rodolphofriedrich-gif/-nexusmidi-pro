import { Globe, Moon, Sun, Monitor, Info, SunDim } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { tr, LANGUAGES, setLanguage } from '../i18n';
import { prefsStore } from '../services/stores';
import { isWakeLockSupported } from '../services/wakeLockService';
import type { ToastType } from '../hooks/useToast';

const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? '1.1.0' : __APP_VERSION__;

interface Props {
  onStatus: (message: string, type?: ToastType) => void;
}

export function SettingsScreen({ onStatus }: Props) {
  const prefs = useStore(prefsStore);

  const handleToggleWakeLock = () => {
    const next = !prefs.wakeLock;
    prefsStore.set({ wakeLock: next });
    if (next) {
      if (!isWakeLockSupported()) {
        onStatus(tr('Este dispositivo não suporta manter a tela acesa'), 'warn');
      } else {
        onStatus(tr('Tela sempre acesa'), 'info');
      }
    } else {
      onStatus(tr('Tela pode apagar'), 'info');
    }
  };

  return (
    <div className="custom-scrollbar flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[var(--bg-app)] p-4 sm:p-6">
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
        
        {/* CARD APARÊNCIA */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-md">
          <h3 className="mb-3 flex items-center gap-2 border-b border-[var(--border-color)] pb-2 text-xs font-bold uppercase tracking-wider text-[var(--nexus-primary)]">
            <Monitor size={15} /> {tr('Aparência')}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => prefsStore.set({ theme: 'dark' })}
              className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
                prefs.theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-500/10 text-[var(--nexus-primary)] shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Moon size={20} className="mb-1" />
              <span className="text-xs font-bold">Dark</span>
            </button>
            <button
              onClick={() => prefsStore.set({ theme: 'light' })}
              className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
                prefs.theme === 'light'
                  ? 'border-indigo-500 bg-indigo-500/10 text-[var(--nexus-primary)] shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Sun size={20} className="mb-1" />
              <span className="text-xs font-bold">Light</span>
            </button>
            <button
              onClick={() => prefsStore.set({ theme: 'system' })}
              className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
                prefs.theme === 'system'
                  ? 'border-indigo-500 bg-indigo-500/10 text-[var(--nexus-primary)] shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Monitor size={20} className="mb-1" />
              <span className="text-xs font-bold">Auto</span>
            </button>
          </div>
        </section>

        {/* CARD IDIOMA */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-md">
          <h3 className="mb-3 flex items-center gap-2 border-b border-[var(--border-color)] pb-2 text-xs font-bold uppercase tracking-wider text-[var(--nexus-primary)]">
            <Globe size={15} /> {tr('Idioma')}
          </h3>
          <div className="flex flex-col gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm font-semibold transition-all ${
                  prefs.language === lang.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-[var(--nexus-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <span>{lang.label}</span>
                {prefs.language === lang.id && <div className="h-2 w-2 rounded-full bg-[var(--nexus-primary)]" />}
              </button>
            ))}
          </div>
        </section>

        {/* CARD PREFERÊNCIAS GERAIS */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-md md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 border-b border-[var(--border-color)] pb-2 text-xs font-bold uppercase tracking-wider text-[var(--nexus-primary)]">
            <SunDim size={15} /> {tr('Preferências Gerais')}
          </h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">{tr('Manter tela acesa')}</p>
              <p className="text-xs text-[var(--text-muted)]">{tr('Impede que a tela apague durante o uso (Wake Lock).')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.wakeLock}
              onClick={handleToggleWakeLock}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs.wakeLock ? 'bg-indigo-500' : 'bg-[var(--bg-elevated)]'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs.wakeLock ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </section>

        {/* CARD SOBRE */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-md md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 border-b border-[var(--border-color)] pb-2 text-xs font-bold uppercase tracking-wider text-[var(--nexus-primary)]">
            <Info size={15} /> {tr('Sobre o App')}
          </h3>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-[var(--text-main)]">NexusMIDI Pro</p>
            <p className="text-xs text-[var(--text-muted)]">{tr('Versão')} v{APP_VERSION}</p>
          </div>
        </section>

      </div>
    </div>
  );
}
