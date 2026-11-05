import { Component, type ErrorInfo, type ReactNode } from 'react';
import { tr } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Evita a "tela preta": se algo quebrar na interface, mostra uma mensagem e permite recarregar. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erro não tratado na interface:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] p-6 text-[var(--text-main)]">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-red-900/60 bg-[var(--bg-panel)] p-6 text-center shadow-2xl">
          <h1 className="text-lg font-bold text-red-400">{tr('Algo deu errado')}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {tr('O NexusMIDI Pro encontrou um erro inesperado. Suas configurações foram preservadas.')}
          </p>
          <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-[var(--bg-elevated)] p-2 text-left text-[10px] text-[var(--text-muted)]">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
          >
            {tr('Recarregar o app')}
          </button>
        </div>
      </div>
    );
  }
}
