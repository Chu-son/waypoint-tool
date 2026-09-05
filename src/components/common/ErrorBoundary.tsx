import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] h-full w-full p-6 bg-surface-base text-text-base select-none">
          <div className="max-w-md w-full bg-surface-panel/80 border border-danger-base/40 rounded-xl p-6 shadow-xl backdrop-blur flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-danger-base/10 text-danger-base flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-semibold text-text-base mb-1">
              {this.props.fallbackTitle || '画面の描画中にエラーが発生しました'}
            </h3>

            <p className="text-sm text-text-muted mb-4">
              予期せぬエラーが発生したため、コンポーネントの表示を保護しました。
            </p>

            {this.state.error && (
              <div className="w-full bg-surface-base/80 border border-border-base/50 rounded-lg p-3 text-left mb-5 overflow-auto max-h-36">
                <p className="text-xs font-mono text-danger-base break-all font-semibold">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] font-mono text-text-muted mt-2 opacity-70 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.trim().slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                onClick={this.handleReset}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-base hover:bg-surface-base/80 text-text-base border border-border-base transition-colors flex items-center gap-1.5"
              >
                再試行
              </button>
              <button
                onClick={this.handleReload}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-base hover:bg-primary-hover text-white transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
