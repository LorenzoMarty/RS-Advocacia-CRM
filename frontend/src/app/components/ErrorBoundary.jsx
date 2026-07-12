import { Component } from 'react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--body-bg)',
            color: 'var(--text)',
          }}
        >
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.75rem', fontWeight: 400 }}>Algo deu errado</h1>
          <p style={{ color: 'var(--soft)' }}>
            Ocorreu um erro inesperado. Por favor, recarregue a página.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
