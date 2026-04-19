import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

import { api, isApiEnabled } from '../api';
import { useAppState } from '../store';

const envGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginHint, loginWithGoogle } = useAppState();
  const [form, setForm] = useState({
    email: loginHint?.email || '',
    password: loginHint?.password || '',
  });
  const [googleClientId, setGoogleClientId] = useState(envGoogleClientId);
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');

  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    console.log('Google login origin:', window.location.origin);

    if (!credentialResponse?.credential) {
      setGoogleError('Nao foi possivel receber o token do Google.');
      return;
    }

    setError('');
    setGoogleError('');
    const hasSession = await loginWithGoogle(credentialResponse.credential);
    if (!hasSession) {
      setGoogleError('Nao foi possivel entrar com Google.');
      return;
    }

    navigate('/', { replace: true });
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    if (envGoogleClientId || !isApiEnabled) {
      return undefined;
    }

    let cancelled = false;

    async function loadGoogleLoginConfig() {
      try {
        const payload = await api.googleLoginConfig();
        const clientId = String(
          payload.clientId || payload.googleClientId || payload.google?.clientId || '',
        ).trim();
        if (!cancelled) {
          setGoogleClientId(clientId);
        }
      } catch {
        if (!cancelled) {
          setGoogleClientId('');
        }
      }
    }

    loadGoogleLoginConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    console.log('Google login origin:', window.location.origin);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setGoogleError('');

    const hasSession = await login(form.email, form.password);
    if (!hasSession) {
      setError('Email ou senha inválidos.');
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-glow" aria-hidden="true" />

        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true">RS</div>
          <div className="login-brand-copy">
            <span className="login-kicker">Plataforma jurídica</span>
            <strong>RS Advocacia</strong>
          </div>
        </div>

        <header className="login-header">
          <h1 className="login-title" id="login-title">Entrar</h1>
          <p className="login-subtitle">Acesse sua conta para continuar no painel.</p>
        </header>

        {error || googleError ? (
          <div className="login-alert login-alert-error" role="alert">
            <span>{error || googleError}</span>
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <div className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </span>
              <input
                id="login-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
                placeholder="voce@rsadvocacia.com"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <div className="login-field-top">
              <label htmlFor="login-password">Senha</label>
              <a className="login-link" href="#login-help">Esqueci minha senha</a>
            </div>
            <div className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                </svg>
              </span>
              <input
                id="login-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, password: event.target.value }))}
                required
              />
            </div>
          </div>

          <button className="btn login-submit" type="submit">Entrar</button>
        </form>

        {googleClientId ? (
          <div className="login-google">
            <div className="login-divider"><span>ou</span></div>
            <GoogleOAuthProvider clientId={googleClientId}>
              <div className="login-google-button">
                <GoogleLogin
                  onSuccess={handleGoogleCredential}
                  onError={() => setGoogleError('Nao foi possivel entrar com Google.')}
                  useOneTap={false}
                />
              </div>
            </GoogleOAuthProvider>
          </div>
        ) : null}

        <footer className="login-footer" id="login-help">
          <p>Use o email e a senha cadastrados em usuários para acessar.</p>
        </footer>
      </section>
    </main>
  );
}
