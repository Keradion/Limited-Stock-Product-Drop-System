import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="app">
          <section className="panel">
            <h1>Something went wrong</h1>
            <p className="message error">{this.state.error.message}</p>
            <p className="muted">Check the browser console for details, then refresh the page.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
