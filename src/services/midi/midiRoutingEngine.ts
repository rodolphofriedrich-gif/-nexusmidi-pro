import { uid } from '../../lib/id';
import { clampInt } from '../../lib/midiMath';
import { createStore, type StorageLike, type Store } from '../../lib/storeCore';
import type { MidiDestination, MidiRoute } from '../../types/midi';
import { VIRTUAL_ID } from './midiConstants';

export interface MidiRoutingEngineDeps {
  storage?: StorageLike;
  /** Retorna o destino conectado pelo id, ou `undefined` se não estiver mais conectado. */
  getDestination: (id: string) => MidiDestination | undefined;
  /** Envia bytes para o destino. Tipicamente ligado a `sendQueue.sendToDevice`. */
  send: (destination: MidiDestination, bytes: number[]) => void;
}

/**
 * Concentra APENAS a lógica de rotas:
 *   - Persistência das rotas (via `createStore`).
 *   - CRUD (`addRoute` / `updateRoute` / `removeRoute`).
 *   - Rota padrão criada ao conectar um destino que só recebe.
 *   - Aplicação das rotas a uma mensagem (`dispatch` e `dispatchRealtime`).
 *
 * Não conhece conexões, filas, monitor nem panic. Recebe as duas callbacks
 * necessárias no construtor, o que mantém a Fase 3 reversível: se algo der
 * errado, dá pra apagar `midiRoutingEngine.ts` e voltar o store pro core sem
 * mexer em mais nada.
 *
 * Foi extraído do `midiCore.ts` (feedback item 3).
 */
export class MidiRoutingEngine {
  private readonly routesStore: Store<{ routes: MidiRoute[] }>;
  private readonly getDestination: (id: string) => MidiDestination | undefined;
  private readonly send: (destination: MidiDestination, bytes: number[]) => void;

  constructor(deps: MidiRoutingEngineDeps) {
    this.routesStore = createStore('nexusmidi.routes', { routes: [] as MidiRoute[] }, { storage: deps.storage, persistDelayMs: 0 });
    this.getDestination = deps.getDestination;
    this.send = deps.send;
  }

  public getRoutes = (): MidiRoute[] => this.routesStore.get().routes;

  public subscribeRoutes = (listener: () => void): (() => void) => this.routesStore.subscribe(listener);

  public addRoute(route: Partial<MidiRoute> & { destinationId: string }): MidiRoute {
    const full: MidiRoute = {
      id: route.id ?? uid('route-'),
      enabled: route.enabled ?? true,
      sourceId: route.sourceId === undefined ? VIRTUAL_ID : route.sourceId,
      destinationId: route.destinationId,
      inputChannel: route.inputChannel ?? 0,
      outputChannel: route.outputChannel ?? 0,
      transpose: route.transpose ?? 0,
    };
    this.routesStore.set((s) => ({ routes: [...s.routes, full] }));
    return full;
  }

  public updateRoute(id: string, updates: Partial<MidiRoute>): void {
    this.routesStore.set((s) => ({ routes: s.routes.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
  }

  public removeRoute(id: string): void {
    this.routesStore.set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
  }

  public ensureDefaultRoute(dest: MidiDestination): void {
    if (this.getRoutes().some((r) => r.destinationId === dest.id)) return;
    this.addRoute({ sourceId: VIRTUAL_ID, destinationId: dest.id });
  }

  /**
   * Aplica as rotas a uma mensagem "channel voice" (Note On/Off, CC, PC, PB, etc).
   *
   * Regras (idênticas ao antigo loop em `MidiService.routeMessage`):
   *   - `enabled === false` → ignora a rota.
   *   - `sourceId` definido e diferente da mensagem → ignora.
   *   - `inputChannel > 0` e diferente do canal de entrada → ignora.
   *   - Transposição aplicada só em Note On/Off e Poly Pressure.
   *   - `outputChannel` sobrescreve o canal de entrada, se > 0.
   */
  public dispatch(status: number, data1: number, data2: number, sourceId?: string): void {
    const command = status & 0xf0;
    const inputChannel = (status & 0x0f) + 1;

    for (const route of this.getRoutes()) {
      if (!route.enabled) continue;
      if (route.sourceId && route.sourceId !== sourceId) continue;
      if (route.inputChannel > 0 && inputChannel !== route.inputChannel) continue;

      let out1 = clampInt(data1, 0, 127);
      const out2 = clampInt(data2, 0, 127);
      if (command === 0x90 || command === 0x80 || command === 0xa0) out1 = clampInt(out1 + route.transpose, 0, 127);

      const outputChannel = route.outputChannel > 0 ? clampInt(route.outputChannel, 1, 16) : inputChannel;
      const dest = this.getDestination(route.destinationId);
      if (dest) this.send(dest, this.encode(command, outputChannel, out1, out2));
    }
  }

  /**
   * Aplica as rotas a uma mensagem realtime (1 byte). Realtime não tem canal,
   * então as regras `inputChannel` / `outputChannel` / `transpose` não valem.
   * Mesmo assim mantém `enabled` e `sourceId`.
   */
  public dispatchRealtime(status: number, sourceId?: string): void {
    for (const route of this.getRoutes()) {
      if (!route.enabled) continue;
      if (route.sourceId && route.sourceId !== sourceId) continue;
      const dest = this.getDestination(route.destinationId);
      if (dest) this.send(dest, [status]);
    }
  }

  private encode(command: number, channel: number, data1: number, data2: number): number[] {
    const status = command + channel - 1;
    return command === 0xc0 || command === 0xd0 ? [status, data1] : [status, data1, data2];
  }
}
