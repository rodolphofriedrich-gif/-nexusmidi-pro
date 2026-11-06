/**
 * Wake Lock (manter tela acesa) — usa a API nativa `navigator.wakeLock`.
 * Suportado em WebView Android (Chromium 84+) e Safari iOS 16.4+.
 * Requer contexto seguro (HTTPS ou localhost) — o Capacitor atende isso em produção.
 * Se não houver suporte, as operações são no-op e `isWakeLockSupported()` retorna false.
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
  released?: boolean;
}

let sentinel: WakeLockSentinelLike | null = null;
let support: boolean | null = null;
let warned = false;

function checkSupport(): boolean {
  if (support === null) {
    support =
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      typeof (navigator as Navigator & { wakeLock?: { request?: (type: string) => Promise<WakeLockSentinelLike> } })
        .wakeLock?.request === 'function';
  }
  return support;
}

export function isWakeLockSupported(): boolean {
  return checkSupport();
}

export async function acquireWakeLock(): Promise<boolean> {
  if (!checkSupport()) {
    if (!warned) {
      console.info('[wakeLock] API não suportada neste dispositivo.');
      warned = true;
    }
    return false;
  }
  if (sentinel && !sentinel.released) return true;
  try {
    const api = (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinelLike> } }).wakeLock;
    sentinel = await api.request('screen');
    sentinel?.addEventListener?.('release', () => {
      sentinel = null;
    });
    return true;
  } catch (error) {
    console.warn('[wakeLock] Falha ao adquirir:', error);
    sentinel = null;
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch (error) {
    console.warn('[wakeLock] Falha ao liberar:', error);
  }
  sentinel = null;
}

export function isWakeLockActive(): boolean {
  return sentinel !== null && !sentinel.released;
}
