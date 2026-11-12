import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAppServices } from './bootstrap';
import { applyTheme } from './lib/applyTheme';
import { prefsStore } from './services/stores';
import './index.css';
import { recordAudioDiagnostic } from './services/audio/audioDiagnostics';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado no index.html');

// Antes do React montar: evita "flash" de tema errado (usuários light veriam dark por ~1 frame).
applyTheme(prefsStore.get().theme);

recordAudioDiagnostic('app.bootstrap.start');
if (typeof PerformanceObserver !== 'undefined') {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordAudioDiagnostic('mainThread.longTask', { durationMs: Math.round(entry.duration * 10) / 10 });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // Long Task API não disponível em todos os WebViews.
  }
}
startAppServices();
recordAudioDiagnostic('app.bootstrap.servicesStarted');

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
