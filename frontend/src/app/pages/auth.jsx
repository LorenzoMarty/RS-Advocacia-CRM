import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppState } from '../store';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginHint } = useAppState();
  const [form, setForm] = useState({
    email: loginHint.email,
    password: loginHint.password,
  });
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    const hasSession = login(form.email, form.password);
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

        {error ? (
          <div className="login-alert login-alert-error" role="alert">
            <span>{error}</span>
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

        <footer className="login-footer" id="login-help">
          <p>Use o email e a senha cadastrados em usuários para acessar.</p>
        </footer>
      </section>
    </main>
  );
}
