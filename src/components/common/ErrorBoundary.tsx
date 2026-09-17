import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
  showBackToStudents?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro não tratado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="error-boundary-container"
          className="min-h-[400px] flex items-center justify-center p-6 bg-[#0e0f12]"
        >
          <div className="max-w-lg w-full p-6 sm:p-8 bg-[#141619] border border-[#262930] rounded-2xl text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-neutral-100">
                {this.props.fallbackTitle || 'Ocorreu um imprevisto nesta tela'}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400">
                {this.props.fallbackDescription ||
                  'Os dados estão seguros. A interface detectou uma oscilação e evitou o travamento da página.'}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#0d0e10] border border-neutral-800 rounded-xl text-left overflow-auto max-h-32 text-xs font-mono text-rose-400">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="btn-error-boundary-retry"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>

              <button
                id="btn-error-boundary-students"
                onClick={() => {
                  window.location.href = '/admin/alunos';
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e2025] hover:bg-[#282b32] text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ir para Alunos</span>
              </button>

              <button
                id="btn-error-boundary-home"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#121316] hover:bg-[#1c1d22] text-neutral-400 hover:text-white text-xs font-semibold rounded-xl border border-neutral-800 transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Início</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
