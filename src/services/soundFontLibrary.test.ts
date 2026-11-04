import { beforeEach, describe, expect, it } from 'vitest';
import { makeSf2 } from '../lib/testSf2';
import { createMemoryStorage, createStore } from '../lib/storeCore';
import { SoundFontLibrary } from './soundFontLibrary';
import type { SoundFontMeta, SoundFontStorage } from './storageService';

function makeStorage(): SoundFontStorage & { data: Map<string, { meta: SoundFontMeta; data: ArrayBuffer }> } {
  const data = new Map<string, { meta: SoundFontMeta; data: ArrayBuffer }>();
  let seq = 0;
  return {
    data,
    list: async () => [...data.values()].map((v) => v.meta).sort((a, b) => b.addedAt - a.addedAt),
    add: async (name, buffer, extras) => {
      const meta = { id: `sf-${++seq}`, name, size: buffer.byteLength, addedAt: seq, ...extras };
      data.set(meta.id, { meta, data: buffer });
      return meta;
    },
    get: async (id) => data.get(id) ?? null,
    remove: async (id) => void data.delete(id),
  };
}

type Prefs = { activeIds: string[] | null; activeId?: string | null };

const piano = makeSf2([{ name: 'Grand', bank: 0, program: 0 }]);
const drums = makeSf2([
  { name: 'Rock Kit', bank: 128, program: 0 },
  { name: 'Jazz Kit', bank: 128, program: 32 },
]);
const file = (name: string, content: ArrayBuffer = piano): File => new File([content], name);

describe('SoundFontLibrary (vários SoundFonts ao mesmo tempo)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let loaded: string[]; // nomes carregados no motor, na ordem
  let orders: string[][];
  let loadOk: boolean;
  let prefs: ReturnType<typeof createStore<Prefs>>;

  const build = () =>
    new SoundFontLibrary(
      storage,
      {
        addSoundBank: async (id, _b, name) => {
          if (!loadOk) return false;
          loaded.push(`${id}=${name}`);
          return true;
        },
        removeSoundBank: async (id) => {
          loaded = loaded.filter((l) => !l.startsWith(`${id}=`));
        },
        setSoundBankOrder: (ids) => void orders.push(ids),
      },
      prefs,
    );
  let library: SoundFontLibrary;

  beforeEach(() => {
    storage = makeStorage();
    loaded = [];
    orders = [];
    loadOk = true;
    prefs = createStore<Prefs>('p', { activeIds: null }, { storage: createMemoryStorage(), persistDelayMs: 0 });
    library = build();
  });

  it('importa, salva e liga o SoundFont, lendo os instrumentos do arquivo', async () => {
    expect(await library.importFile(file('piano.sf2'))).toBe(true);
    const snap = library.getSnapshot();
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0]).toMatchObject({ presetCount: 1, drumKitCount: 0 });
    expect(snap.activeIds).toEqual([snap.items[0].id]);
    expect(snap.presets[snap.items[0].id]).toEqual([{ name: 'Grand', bank: 0, program: 0 }]);
    expect(prefs.get().activeIds).toEqual(snap.activeIds);
  });

  it('conta os kits de bateria encontrados no arquivo', async () => {
    await library.importFile(file('kits.sf2', drums));
    expect(library.getSnapshot().items[0]).toMatchObject({ presetCount: 2, drumKitCount: 2 });
  });

  it('rejeita arquivos que não são .sf2', async () => {
    expect(await library.importFile(file('musica.mp3'))).toBe(false);
    expect(library.getSnapshot().error).toBeTruthy();
    expect(storage.data.size).toBe(0);
  });

  it('mantém dois SoundFonts ligados ao mesmo tempo; o último importado tem prioridade', async () => {
    await library.importFile(file('piano.sf2'));
    await library.importFile(file('kits.sf2', drums));
    const snap = library.getSnapshot();
    const [kits, pianoItem] = snap.items;
    expect(snap.activeIds).toEqual([kits.id, pianoItem.id]);
    expect(loaded).toHaveLength(2);
    expect(orders.at(-1)).toEqual([kits.id, pianoItem.id]);
  });

  it('desligar uma biblioteca remove do motor sem apagar da biblioteca', async () => {
    await library.importFile(file('piano.sf2'));
    const id = library.getSnapshot().items[0].id;
    await library.toggle(id);
    const snap = library.getSnapshot();
    expect(snap.activeIds).toEqual([]);
    expect(snap.items).toHaveLength(1);
    expect(loaded).toEqual([]);
    expect(prefs.get().activeIds).toEqual([]);
  });

  it('ligar de novo carrega do armazenamento e dá a maior prioridade', async () => {
    await library.importFile(file('piano.sf2'));
    await library.importFile(file('kits.sf2', drums));
    const [kits, pianoItem] = library.getSnapshot().items;
    await library.toggle(pianoItem.id);
    await library.toggle(pianoItem.id);
    expect(library.getSnapshot().activeIds).toEqual([pianoItem.id, kits.id]);
  });

  it('move() troca a prioridade e avisa o motor sem recarregar nada', async () => {
    await library.importFile(file('piano.sf2'));
    await library.importFile(file('kits.sf2', drums));
    const loadedBefore = [...loaded];
    const [kits, pianoItem] = library.getSnapshot().items;
    library.move(kits.id, 1);
    expect(library.getSnapshot().activeIds).toEqual([pianoItem.id, kits.id]);
    expect(orders.at(-1)).toEqual([pianoItem.id, kits.id]);
    expect(loaded).toEqual(loadedBefore);
  });

  it('move() nas pontas da lista não faz nada', async () => {
    await library.importFile(file('piano.sf2'));
    const id = library.getSnapshot().items[0].id;
    library.move(id, -1);
    library.move(id, 1);
    expect(library.getSnapshot().activeIds).toEqual([id]);
  });

  it('restore() religa exatamente os SoundFonts que estavam ligados', async () => {
    await library.importFile(file('piano.sf2'));
    await library.importFile(file('kits.sf2', drums));
    const [kits] = library.getSnapshot().items;
    await library.toggle(kits.id); // deixa só o piano ligado

    loaded = [];
    const reopened = build();
    expect(await reopened.restore()).toBe(true);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].endsWith('=piano.sf2')).toBe(true);
    expect(reopened.getSnapshot().presets[reopened.getSnapshot().activeIds[0]]).toHaveLength(1);
  });

  it('restore() respeita "tudo desligado" (não religa sozinho)', async () => {
    await library.importFile(file('piano.sf2'));
    await library.toggle(library.getSnapshot().items[0].id);
    loaded = [];
    const reopened = build();
    await reopened.restore();
    expect(reopened.getSnapshot().activeIds).toEqual([]);
    expect(loaded).toEqual([]);
  });

  it('restore() na primeira execução liga o primeiro SoundFont da lista', async () => {
    await storage.add('velho.sf2', piano);
    const first = build();
    expect(await first.restore()).toBe(true);
    expect(first.getSnapshot().activeIds).toHaveLength(1);
  });

  it('restore() aceita a preferência antiga (um único activeId)', async () => {
    const meta = await storage.add('velho.sf2', piano);
    await storage.add('outro.sf2', piano);
    prefs.set({ activeIds: null, activeId: meta.id });
    const reopened = build();
    await reopened.restore();
    expect(reopened.getSnapshot().activeIds).toEqual([meta.id]);
  });

  it('restore() com biblioteca vazia não faz nada e é idempotente', async () => {
    expect(await library.restore()).toBe(false);
    await storage.add('a.sf2', piano);
    loaded = [];
    const reopened = build();
    await Promise.all([reopened.restore(), reopened.restore()]);
    expect(loaded).toHaveLength(1);
  });

  it('remover um SoundFont ligado tira do motor e da lista de instrumentos', async () => {
    await library.importFile(file('a.sf2'));
    await library.importFile(file('b.sf2', drums));
    const [b] = library.getSnapshot().items;
    await library.remove(b.id);
    const snap = library.getSnapshot();
    expect(snap.items).toHaveLength(1);
    expect(snap.activeIds).not.toContain(b.id);
    expect(snap.presets[b.id]).toBeUndefined();
    expect(loaded).toHaveLength(1);
  });

  it('remover o último deixa a biblioteca vazia e sem ativos', async () => {
    await library.importFile(file('a.sf2'));
    await library.remove(library.getSnapshot().items[0].id);
    expect(library.getSnapshot()).toMatchObject({ items: [], activeIds: [] });
  });

  it('falha no motor de áudio vira mensagem de erro e libera o "busy"', async () => {
    loadOk = false;
    expect(await library.importFile(file('a.sf2'))).toBe(false);
    const snap = library.getSnapshot();
    expect(snap.busy).toBe(false);
    expect(snap.error).toBeTruthy();
    expect(snap.activeIds).toEqual([]);
  });

  it('chama onLoaded quando o conjunto de SoundFonts muda', async () => {
    let count = 0;
    library.setOnLoaded(() => count++);
    await library.importFile(file('a.sf2'));
    expect(count).toBe(1);
    library.move(library.getSnapshot().items[0].id, 1); // ponta da lista: sem efeito
    expect(count).toBe(1);
    await library.toggle(library.getSnapshot().items[0].id);
    expect(count).toBe(2);
  });
});
