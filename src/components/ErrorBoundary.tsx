import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center max-w-2xl w-full">
            <p className="text-gray-500 text-sm mt-2">
              Ocorreu um erro inesperado. Recarregue a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-black"
            >
              Recarregar
            </button>
            {import.meta.env.DEV && (
              <pre className="mt-4 text-xs text-left bg-red-50 border border-red-200 rounded p-3 overflow-auto text-red-700 max-h-96 whitespace-pre-wrap">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
                {this.state.componentStack ? '\n\nComponent Stack:' + this.state.componentStack : ''}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
