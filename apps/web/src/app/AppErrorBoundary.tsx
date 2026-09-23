import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

// Catch render and lazy-import failures without exposing implementation details to users.
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep the fallback generic; sensitive request or clinical details never reach the UI.
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="page-content" role="alert" aria-labelledby="app-error-title">
        <section className="card resource-feedback-card">
          <h1 id="app-error-title">No pudimos cargar esta vista</h1>
          <p>Recarga la aplicación. Si el problema continúa, contacta al equipo de soporte.</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Recargar aplicación
          </button>
        </section>
      </main>
    );
  }
}
