import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { api, isApiEnabled } from '../api';

export function LoginPage() {
  const location = useLocation();
  const [googleError, setGoogleError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectError = new URLSearchParams(location.search).get('google_error') || '';
  const visibleError = googleError || redirectError;

  function handleGoogleRedirect() {
    if (!isApiEnabled) {
      setGoogleError('API nao configurada.');
      return;
    }

    setGoogleError('');
    setIsRedirecting(true);
    window.location.assign(api.googleRedirectUrl());
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-glow" aria-hidden="true" />

        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true">RS</div>
          <div className="login-brand-copy">
            <span className="login-kicker">Plataforma juridica</span>
            <strong>RS Advocacia</strong>
          </div>
        </div>

        <header className="login-header">
          <h1 className="login-title" id="login-title">Entrar</h1>
          <p className="login-subtitle">Continue pela pagina segura do Google.</p>
        </header>

        {visibleError ? (
          <div className="login-alert login-alert-error" role="alert">
            <span>{visibleError}</span>
          </div>
        ) : null}

        <div className="login-google">
          <button
            className="btn login-submit"
            type="button"
            disabled={isRedirecting}
            onClick={handleGoogleRedirect}
          >
            {isRedirecting ? 'Redirecionando...' : 'Entrar com Google'}
          </button>
        </div>

        <footer className="login-footer" id="login-help">
          <p>Depois do login, voce volta automaticamente para o dashboard.</p>
        </footer>
      </section>
    </main>
  );
}
