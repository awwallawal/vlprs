import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Something went wrong
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            A temporary error occurred. This usually resolves on its own.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-crimson px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-crimson-dark"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-50"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
