import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        console.error('[PaperGrid Error]', error, errorInfo);
        // Persist error details to localStorage for debugging
        try {
            localStorage.setItem('papergrid_last_error', JSON.stringify({
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
            }));
        } catch { /* ignore serialization errors */ }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={32} className="text-red-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                        <p className="text-gray-500 text-sm mb-6">
                            Papera encountered an unexpected error. Your data is safe — try refreshing the page.
                        </p>

                        {this.state.error && (
                            <details className="text-left mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100" open>
                                <summary className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600">
                                    Error details
                                </summary>
                                <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                                    {this.state.error.message}
                                </pre>
                                {this.state.error.stack && (
                                    <pre className="text-[10px] text-gray-500 mt-2 overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                        {this.state.error.stack}
                                    </pre>
                                )}
                            </details>
                        )}
                        {this.state.errorInfo?.componentStack && (
                            <details className="text-left mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <summary className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600">
                                    Component stack
                                </summary>
                                <pre className="text-[10px] text-gray-500 mt-2 overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors shadow-md"
                            >
                                <RefreshCw size={16} />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors"
                            >
                                <Home size={16} />
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
