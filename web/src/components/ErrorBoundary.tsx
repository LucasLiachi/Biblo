import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  area: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Isola falhas de um painel: o erro aparece no lugar dele e o resto do Biblo continua funcionando. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.area}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel-error" role="alert">
        <strong>{this.props.area} encontrou um erro.</strong>
        <code>{this.state.error.message}</code>
        <button type="button" className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
          Recarregar painel
        </button>
      </div>
    );
  }
}
