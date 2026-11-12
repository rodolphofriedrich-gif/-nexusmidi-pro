/**
 * Diagnóstico leve do pipeline de áudio.
 * Ative temporariamente acrescentando ?audioDiagnostics=1 à URL do app.
 * Não registra eventos MIDI individuais nem altera o caminho de áudio.
 */
type DiagnosticDetails = Record<string, string | number | boolean | null | undefined>;

type DiagnosticEntry = {
  name: string;
  elapsedMs: number;
  details?: DiagnosticDetails;
};

declare global {
  interface Window {
    __NEXUS_AUDIO_DIAGNOSTICS__?: DiagnosticEntry[];
  }
}

const enabled = (): boolean => {
  try {
    return (
      new URLSearchParams(window.location.search).get('audioDiagnostics') === '1' ||
      window.localStorage.getItem('nexusmidi.audioDiagnostics') === '1'
    );
  } catch {
    return false;
  }
};

const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;

export function recordAudioDiagnostic(name: string, details?: DiagnosticDetails): void {
  if (!enabled()) return;
  const entry: DiagnosticEntry = {
    name,
    elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
    ...(details ? { details } : {}),
  };
  const entries = (window.__NEXUS_AUDIO_DIAGNOSTICS__ ??= []);
  entries.push(entry);
  if (entries.length > 100) entries.splice(0, entries.length - 100);
  console.info('[NexusMIDI audio diagnostic]', entry);
}

export function startAudioDiagnostic(name: string): () => void {
  if (!enabled()) return () => undefined;
  const started = performance.now();
  recordAudioDiagnostic(`${name}.start`);
  return () => {
    recordAudioDiagnostic(`${name}.complete`, {
      durationMs: Math.round((performance.now() - started) * 10) / 10,
    });
  };
}
