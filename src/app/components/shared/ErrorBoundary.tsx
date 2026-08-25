/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Lỗi Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full brutal-card p-8 text-center bg-white/90 backdrop-blur-md">
            <div className="w-16 h-16 bg-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-hard-sm">
              <AlertTriangle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-black text-primary mb-2 uppercase italic tracking-tighter">
              Rất tiếc, đã có lỗi xảy ra
            </h1>
            <p className="text-primary/70 mb-8 leading-relaxed font-bold">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="brutal-btn bg-primary text-white px-8 py-4 flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
