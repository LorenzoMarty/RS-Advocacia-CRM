import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { api, isApiEnabled } from '../api';

export function LoginPage() {
  const location = useLocation();
  const [googleError, setGoogleError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectParams = new URLSearchParams(location.search);
  const redirectError = redirectParams.get('google_error') || '';
  const requiresConsent = redirectParams.get('google_consent') === 'required';
  const visibleError = googleError || redirectError;

  function handleGoogleRedirect() {
    if (!isApiEnabled) {
      setGoogleError('API não configurada.');
      return;
    }

    setGoogleError('');
    setIsRedirecting(true);
    window.location.assign(
      requiresConsent ? api.urlReauthorizeGoogle() : api.urlLoginGoogle(),
    );
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true">RS</div>
          <div className="login-brand-copy">
            <span className="login-kicker">Plataforma jurídica</span>
            <strong>RS Advocacia</strong>
          </div>
        </div>

        <header className="login-header">
          <h1 className="login-title" id="login-title">Entrar</h1>
          <p className="login-subtitle">Continue pela página segura do Google.</p>
        </header>

        <p className="login-purpose">
          Plataforma de gestão jurídica interna do escritório RS Advocacia:
          clientes, processos, agenda, prazos e petições em um só lugar.
        </p>

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
            {isRedirecting
              ? 'Redirecionando…'
              : requiresConsent
                ? 'Autorizar Google Calendar'
                : 'Entrar com Google'}
          </button>
        </div>

        <footer className="login-footer" id="login-help">
          <p>Depois do login, você volta automaticamente para o painel.</p>
          <nav className="login-legal-links" aria-label="Links legais">
            <Link to="/politica-privacidade">Política de Privacidade</Link>
            <span aria-hidden="true">·</span>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </nav>
        </footer>
      </section>
    </main>
  );
}
