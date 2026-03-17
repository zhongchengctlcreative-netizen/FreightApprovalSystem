import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 bg-red-50/50 rounded-xl border border-red-100 animate-fade-in">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-600 mb-6 text-center max-w-md">
            The application encountered an unexpected error. This might be due to a connectivity issue or data inconsistency.
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-md"
            >
              <RefreshCw size={16} /> Reload Page
            </button>
            <button 
              onClick={this.handleHome}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white transition-colors"
            >
              <Home size={16} /> Go Home
            </button>
          </div>

          {this.state.error && (
            <div className="mt-8 w-full max-w-lg">
              <details className="text-xs text-slate-500 cursor-pointer">
                <summary className="mb-2 font-mono hover:text-slate-700">View Error Details</summary>
                <div className="p-4 bg-slate-100 rounded-lg font-mono whitespace-pre-wrap overflow-auto max-h-48 border border-slate-200 text-red-700">
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;