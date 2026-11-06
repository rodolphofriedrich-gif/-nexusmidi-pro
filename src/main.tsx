import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAppServices } from './bootstrap';
import { applyTheme } from './lib/applyTheme';
import { prefsStore } from './services/stores';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado no index.html');

// Antes do React montar: evita "flash" de tema errado (usuários light veriam dark por ~1 frame).
applyTheme(prefsStore.get().theme);

startAppServices();

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
