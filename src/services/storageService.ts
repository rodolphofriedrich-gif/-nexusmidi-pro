/**
 * Biblioteca de SoundFonts no IndexedDB. Metadados e dados ficam em stores separados para listar
 * a biblioteca sem carregar centenas de MB na memória.
 */
import { uid } from '../lib/id';

const DB_NAME = 'NexusMIDI_DB';
const DB_VERSION = 2;
const META_STORE = 'sf_meta';
const DATA_STORE = 'sf_data';
const LEGACY_STORE = 'soundfonts'; // versão 1: um único arquivo em 'active_sf2'
const LEGACY_KEY = 'active_sf2';

export interface SoundFontMeta {
  id: string;
  name: string;
  size: number;
  addedAt: number;
  /** Quantidade de instrumentos e de kits de bateria (preenchido na importação). */
  presetCount?: number;
  drumKitCount?: number;
}

export type SoundFontExtras = Pick<SoundFontMeta, 'presetCount' | 'drumKitCount'>;

/** Contrato usado pela biblioteca (permite um falso em memória nos testes). */
export interface SoundFontStorage {
  list(): Promise<SoundFontMeta[]>;
  add(name: string, data: ArrayBuffer, extras?: SoundFontExtras): Promise<SoundFontMeta>;
  get(id: string): Promise<{ meta: SoundFontMeta; data: ArrayBuffer } | null>;
  remove(id: string): Promise<void>;
}

const wrap = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erro no IndexedDB'));
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transação falhou'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada'));
  });

class IndexedDbSoundFontStorage implements SoundFontStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private migrated = false;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(LEGACY_STORE)) db.createObjectStore(LEGACY_STORE);
          if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          this.dbPromise = null;
          reject(request.error ?? new Error('Não foi possível abrir o IndexedDB'));
        };
      });
    }
    return this.dbPromise;
  }

  /** Importa o SoundFont salvo pela versão antiga do app (uma única vez). */
  private async migrateLegacy(db: IDBDatabase): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;
    try {
      const tx = db.transaction(LEGACY_STORE, 'readonly');
      const legacy = (await wrap(tx.objectStore(LEGACY_STORE).get(LEGACY_KEY))) as
        | { name?: string; data?: ArrayBuffer }
        | undefined;
      if (!legacy?.data || !legacy.name) return;
      const metas = await wrap(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).getAll());
      if (metas.length === 0) await this.add(legacy.name, legacy.data);
      const clear = db.transaction(LEGACY_STORE, 'readwrite');
      clear.objectStore(LEGACY_STORE).delete(LEGACY_KEY);
      await done(clear);
    } catch (error) {
      console.warn('Migração do SoundFont antigo falhou:', error);
    }
  }

  async list(): Promise<SoundFontMeta[]> {
    const db = await this.open();
    await this.migrateLegacy(db);
    const metas = (await wrap(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).getAll())) as SoundFontMeta[];
    return metas.sort((a, b) => b.addedAt - a.addedAt);
  }

  async add(name: string, data: ArrayBuffer, extras: SoundFontExtras = {}): Promise<SoundFontMeta> {
    const db = await this.open();
    const meta: SoundFontMeta = { id: uid('sf-'), name, size: data.byteLength, addedAt: Date.now(), ...extras };
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(DATA_STORE).put(data, meta.id);
    await done(tx);
    // Pede ao navegador para não apagar o armazenamento sob pressão de espaço.
    void navigator.storage?.persist?.().catch(() => undefined);
    return meta;
  }

  async get(id: string): Promise<{ meta: SoundFontMeta; data: ArrayBuffer } | null> {
    const db = await this.open();
    const tx = db.transaction([META_STORE, DATA_STORE], 'readonly');
    const [meta, data] = await Promise.all([
      wrap(tx.objectStore(META_STORE).get(id)) as Promise<SoundFontMeta | undefined>,
      wrap(tx.objectStore(DATA_STORE).get(id)) as Promise<ArrayBuffer | undefined>,
    ]);
    return meta && data ? { meta, data } : null;
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(DATA_STORE).delete(id);
    await done(tx);
  }
}

export const storageService: SoundFontStorage = new IndexedDbSoundFontStorage();
