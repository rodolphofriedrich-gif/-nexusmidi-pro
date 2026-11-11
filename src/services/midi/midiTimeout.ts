/**
 * Envolve uma Promise com timeout.
 *
 * Se a Promise original não resolver/rejeitar dentro de `ms`, a retornada
 * rejeita com `Error` identificando `label`. O `clearTimeout` no `finally`
 * evita timers pendentes após resolução normal.
 *
 * Extraído para módulo próprio porque tanto `MidiSendQueue` (envios) quanto
 * `MidiService.sendPanic` (timeout global do panic) precisam dele.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
