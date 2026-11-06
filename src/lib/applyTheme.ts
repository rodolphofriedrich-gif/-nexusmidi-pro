import type { Prefs } from '../services/stores';

export type ResolvedTheme = 'dark' | 'light';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** Resolve 'system' para o valor efetivo do SO; 'dark'/'light' passam direto. */
export function resolveTheme(theme: Prefs['theme']): ResolvedTheme {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
  }
  return theme;
}

/** Aplica a classe `.light` no `<html>` e sincroniza `color-scheme` (para form controls, scrollbars etc.). */
export function applyTheme(theme: Prefs['theme']): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

/**
 * Registra listener de mudança de preferência do SO (só faz sentido quando theme === 'system').
 * Devolve função de cleanup.
 */
export function subscribeSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(LIGHT_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
