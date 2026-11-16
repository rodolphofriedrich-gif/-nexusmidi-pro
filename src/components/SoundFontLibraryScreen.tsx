import { useEffect, useRef, useSyncExternalStore, type ChangeEvent } from 'react';
import { Library, UploadCloud } from 'lucide-react';
import { tr } from '../i18n';
import { soundFontLibrary } from '../services/soundFontLibrary';
import type { ToastType } from '../hooks/useToast';
import { SoundFontLibraryPanel } from './soundfont/SoundFontLibraryPanel';

interface Props {
  onStatus: (message: string, type?: ToastType) => void;
}

/** Gerenciamento isolado dos arquivos SoundFont; usa o serviço existente sem acessar o motor diretamente. */
export function SoundFontLibraryScreen({ onStatus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  useEffect(() => {
    if (library.error) onStatus(library.error, 'error');
  }, [library.error, onStatus]);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onStatus(tr('Importando e analisando SoundFont...'), 'info');
    if (await soundFontLibrary.importFile(file)) {
      onStatus(tr('SoundFont "{name}" importado com sucesso.', { name: file.name }), 'success');
    }
  };

  const remove = async (id: string) => {
    const item = library.items.find((entry) => entry.id === id);
    await soundFontLibrary.remove(id);
    if (!soundFontLibrary.getSnapshot().error) onStatus(tr('SoundFont removido da biblioteca.'), 'info');
    else onStatus(soundFontLibrary.getSnapshot().error ?? tr('Falha ao remover SoundFont.'), 'error');
    void item;
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-[var(--bg-app)] p-3 text-[var(--text-main)]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Library className="shrink-0 text-[var(--nexus-primary)]" size={22} />
          <div className="min-w-0">
            <h2 className="text-sm font-bold">{tr('Biblioteca SoundFont')}</h2>
            <p className="text-xs text-[var(--text-muted)]">{tr('Gerencie os arquivos e os instrumentos disponíveis nos canais MIDI.')}</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".sf2,application/octet-stream" onChange={(event) => void importFile(event)} className="hidden" />
        <button
          type="button"
          disabled={library.busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          <UploadCloud size={16} /> {tr('Importar SF2')}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-3 custom-scrollbar">
        <SoundFontLibraryPanel
          library={library}
          onToggle={(id) => void soundFontLibrary.toggle(id).then((ok) => {
            if (ok) onStatus(tr('Estado da biblioteca atualizado.'), 'success');
          })}
          onMove={(id, delta) => soundFontLibrary.move(id, delta)}
          onRemove={(id) => void remove(id)}
        />
      </div>
      <p className="shrink-0 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {tr('Bibliotecas desligadas continuam armazenadas, mas seus instrumentos não aparecem para seleção. Excluir remove o arquivo salvo no aplicativo.')}
      </p>
    </section>
  );
}
