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
      <section className="login-brand-panel" aria-hidden="true">
        <span className="login-kicker">Plataforma interna</span>
        <span className="brand-logo brand-logo-full login-logo" />
        <span className="login-copyright">© RS Advocacia</span>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form">
          <header className="login-header">
            <span className="brand-logo brand-logo-mono login-mono" role="img" aria-label="RS Advocacia" />
            <h1 className="login-title" id="login-title">Entrar</h1>
            <p className="login-subtitle">
              Use a conta Google do escritório. A autenticação acontece na página segura do Google.
            </p>
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
              <span className="login-google-icon"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" /><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" /></svg></span>
              <span>
                {isRedirecting
                  ? 'Redirecionando…'
                  : requiresConsent
                    ? 'Autorizar Google Calendar'
                    : 'Entrar com Google'}
              </span>
              <span className="login-google-icon" aria-hidden="true" />
            </button>
            <span className="login-hint">Depois do login, você volta direto para o painel.</span>
          </div>

          <footer className="login-footer" id="login-help">
            <p>
              Gestão jurídica interna do escritório: clientes, processos, agenda, prazos e petições em um só lugar.
            </p>
            <nav className="login-legal-links" aria-label="Links legais">
              <Link to="/politica-privacidade">Política de Privacidade</Link>
              <Link to="/termos-de-uso">Termos de Uso</Link>
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}
