import { createStore, type Store } from '../lib/storeCore';
import { parseSf2Presets, summarizePresets, type Sf2Preset } from '../lib/sf2';
import { storageService, type SoundFontMeta, type SoundFontStorage } from './storageService';
import { synthService } from './synthService';
import { recordAudioDiagnostic, startAudioDiagnostic } from './audio/audioDiagnostics';

export interface LibrarySnapshot {
  items: SoundFontMeta[];
  /** Bibliotecas ligadas, em ordem de prioridade (a primeira vence em instrumentos repetidos). */
  activeIds: string[];
  /** Instrumentos lidos de cada SoundFont já carregado nesta sessão. */
  presets: Record<string, Sf2Preset[]>;
  busy: boolean;
  error: string | null;
}

interface SynthLoader {
  addSoundBank(id: string, buffer: ArrayBuffer, name: string): Promise<boolean>;
  removeSoundBank(id: string): Promise<void>;
  setSoundBankOrder(ids: string[]): void;
}

interface LibraryPrefs {
  /** `null` = nunca escolhido (primeira execução): liga o primeiro SoundFont da lista. */
  activeIds: string[] | null;
  /** Formato antigo (um único SoundFont ativo). Só lido na migração. */
  activeId?: string | null;
}

/**
 * Biblioteca de SoundFonts: importar, remover e escolher QUAIS ficam ligados ao mesmo tempo.
 * Os ligados são carregados no motor de áudio; a ordem define a prioridade entre eles.
 */
export class SoundFontLibrary {
  private snapshot: LibrarySnapshot = { items: [], activeIds: [], presets: {}, busy: false, error: null };
  private readonly listeners = new Set<() => void>();
  private readonly prefs: Store<LibraryPrefs>;
  private onLoaded?: () => void;
  private restored: Promise<boolean> | null = null;
  /** O que realmente está carregado no motor (pode diferir momentaneamente de `activeIds`). */
  private readonly loaded = new Set<string>();

  constructor(
    private readonly storage: SoundFontStorage,
    private readonly synth: SynthLoader,
    prefs?: Store<LibraryPrefs>,
  ) {
    this.prefs = prefs ?? createStore<LibraryPrefs>('nexusmidi.soundfonts', { activeIds: null });
  }

  getSnapshot = (): LibrarySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Chamado sempre que o conjunto de SoundFonts carregados muda (para reaplicar configurações). */
  setOnLoaded(callback: () => void): void {
    this.onLoaded = callback;
  }

  private update(patch: Partial<LibrarySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private fail(error: unknown, fallback: string): void {
    this.update({ busy: false, error: error instanceof Error ? error.message : fallback });
  }

  /** Lista a biblioteca e carrega os SoundFonts ligados. Seguro chamar várias vezes. */
  restore(): Promise<boolean> {
    if (!this.restored) this.restored = this.doRestore();
    return this.restored;
  }

  private async doRestore(): Promise<boolean> {
    const finishRestore = startAudioDiagnostic('soundFont.restore');
    try {
      const items = await this.storage.list();
      recordAudioDiagnostic('soundFont.restore.libraryListed', { count: items.length });
      this.update({ items });
      if (items.length === 0) { finishRestore(); return false; }

      const saved = this.prefs.get();
      const wanted = saved.activeIds ?? (saved.activeId ? [saved.activeId] : null);
      const valid = (wanted ?? [items[0].id]).filter((id) => items.some((i) => i.id === id));
      // Preferência salva apontando para itens que não existem mais → cai para o primeiro.
      const ids = valid.length > 0 || (wanted !== null && wanted.length === 0) ? valid : [items[0].id];
      const result = await this.apply(ids);
      finishRestore();
      recordAudioDiagnostic('soundFont.restore.complete', { activeCount: this.snapshot.activeIds.length, result });
      return result;
    } catch (error) {
      finishRestore();
      this.fail(error, 'Falha ao abrir a biblioteca de SoundFonts.');
      return false;
    }
  }

  async importFile(file: File): Promise<boolean> {
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      this.update({ error: 'Selecione um arquivo .sf2 válido.' });
      return false;
    }
    this.update({ busy: true, error: null });
    try {
      const finishRead = startAudioDiagnostic('soundFont.import.readFile');
      const data = await file.arrayBuffer();
      finishRead();
      recordAudioDiagnostic('soundFont.import.fileRead', { bytes: data.byteLength, fileName: file.name });
      const finishParse = startAudioDiagnostic('soundFont.import.parsePresets');
      const presets = parseSf2Presets(data);
      finishParse();
      recordAudioDiagnostic('soundFont.import.presetsParsed', { presetCount: presets.length });
      const { total, drums } = summarizePresets(presets);
      const meta = await this.storage.add(file.name, data, { presetCount: total, drumKitCount: drums });
      this.update({
        items: await this.storage.list(),
        presets: { ...this.snapshot.presets, [meta.id]: presets },
      });
      // O SoundFont novo entra ligado e com a maior prioridade.
      return await this.apply([meta.id, ...this.snapshot.activeIds], new Map([[meta.id, data]]));
    } catch (error) {
      this.fail(error, 'Falha ao importar o SoundFont.');
      return false;
    }
  }

  /** Liga ou desliga uma biblioteca. Ao ligar, ela passa a ter a maior prioridade. */
  async toggle(id: string): Promise<boolean> {
    const { activeIds } = this.snapshot;
    const next = activeIds.includes(id) ? activeIds.filter((x) => x !== id) : [id, ...activeIds];
    return this.apply(next);
  }

  /** Sobe (-1) ou desce (+1) a prioridade de uma biblioteca ligada. */
  move(id: string, delta: -1 | 1): void {
    const ids = [...this.snapshot.activeIds];
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    this.prefs.set({ activeIds: ids });
    this.update({ activeIds: ids });
    this.synth.setSoundBankOrder(ids);
    this.onLoaded?.();
  }

  async remove(id: string): Promise<void> {
    try {
      await this.storage.remove(id);
      const items = await this.storage.list();
      const presets = { ...this.snapshot.presets };
      delete presets[id];
      this.update({ items, presets });
      if (this.snapshot.activeIds.includes(id) || this.loaded.has(id)) {
        await this.apply(this.snapshot.activeIds.filter((x) => x !== id));
      }
    } catch (error) {
      this.fail(error, 'Falha ao remover o SoundFont.');
    }
  }

  /**
   * Faz o motor de áudio refletir a lista `ids`: remove o que saiu, carrega o que entrou
   * (lendo do armazenamento, ou de `preloaded` quando o dado acabou de ser importado) e aplica a ordem.
   */
  private async apply(ids: string[], preloaded?: Map<string, ArrayBuffer>): Promise<boolean> {
    this.update({ busy: true, error: null });
    let allOk = true;
    const finalIds: string[] = [];
    try {
      for (const id of [...this.loaded]) {
        if (!ids.includes(id)) {
          await this.synth.removeSoundBank(id);
          this.loaded.delete(id);
        }
      }

      const presets = { ...this.snapshot.presets };
      for (const id of ids) {
        if (this.loaded.has(id)) {
          finalIds.push(id);
          continue;
        }
        let data = preloaded?.get(id);
        let name = this.snapshot.items.find((i) => i.id === id)?.name;
        if (!data) {
          const record = await this.storage.get(id);
          if (!record) {
            allOk = false;
            this.update({ error: 'SoundFont não encontrado na biblioteca.' });
            continue;
          }
          data = record.data;
          name = record.meta.name;
        }
        const finishLoad = startAudioDiagnostic('soundFont.engine.addSoundBank');
        const loaded = await this.synth.addSoundBank(id, data, name ?? id);
        finishLoad();
        recordAudioDiagnostic('soundFont.engine.addSoundBank.result', { success: loaded, bytes: data.byteLength });
        if (!loaded) {
          allOk = false;
          this.update({ error: 'O motor de áudio não conseguiu carregar este arquivo.' });
          continue;
        }
        this.loaded.add(id);
        presets[id] ??= parseSf2Presets(data);
        finalIds.push(id);
      }

      this.synth.setSoundBankOrder(finalIds);
      this.prefs.set({ activeIds: finalIds });
      this.update({ activeIds: finalIds, presets, busy: false });
      this.onLoaded?.();
      return allOk;
    } catch (error) {
      this.fail(error, 'Falha ao carregar o SoundFont.');
      return false;
    }
  }
}

export const soundFontLibrary = new SoundFontLibrary(storageService, synthService);
