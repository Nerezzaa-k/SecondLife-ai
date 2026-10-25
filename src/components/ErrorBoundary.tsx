import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  silent?: boolean;
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public handleGoHome = () => {
    this.reset();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.silent) {
        return null;
      }

      // Inline page / route fallback
      if (this.props.inline) {
        return (
          <div className="my-6 p-6 bg-white rounded-3xl border border-amber-200/80 shadow-sm text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              {this.props.fallbackTitle || 'This section is temporarily unavailable'}
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred, but the rest of SecondLife AI is still running.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.reset}
                className="py-2 px-3.5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        );
      }

      // Modal/overlay or top-level fallback
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-amber-200">
            <div className="flex items-center gap-2.5 mb-2 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="font-bold text-sm">
                {this.props.fallbackTitle || 'A component encountered an issue'}
              </h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred, but SecondLife AI recovered safely.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={this.reset}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Dismiss & Retry</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
