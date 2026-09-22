import React, { Component, ErrorInfo, ReactNode } from "react";
import { useRouteError } from "react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reloadLatestAppVersion } from "../../lib/lazy-routes";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function getErrorMessage(error: unknown) {
  const fallback = "Đã xảy ra lỗi không mong muốn.";
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed.error && parsed.operationType) {
      return `Lỗi Firestore (${parsed.operationType}): ${parsed.error}`;
    }
  } catch {
    // The ordinary Error message below is already the most useful fallback.
  }
  return rawMessage || fallback;
}

function ErrorScreen({ error }: { error: unknown }) {
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
          {getErrorMessage(error)}
        </p>
        <button
          onClick={() =>
            reloadLatestAppVersion("manual-recovery") || window.location.reload()
          }
          className="brutal-btn bg-primary text-white px-8 py-4 flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Tải bản mới nhất
        </button>
      </div>
    </div>
  );
}

export function RouteErrorBoundary() {
  return <ErrorScreen error={useRouteError()} />;
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
      return <ErrorScreen error={this.state.error} />;
    }

    return this.props.children;
  }
}
