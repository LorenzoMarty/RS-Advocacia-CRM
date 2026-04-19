import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

import { useAppState } from '../store';

const envGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAppState();
  const googleClientId = envGoogleClientId;
  const [googleError, setGoogleError] = useState('');

  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    console.log('Google login origin:', window.location.origin);

    if (!credentialResponse?.credential) {
      setGoogleError('Nao foi possivel receber o token do Google.');
      return;
    }

    setGoogleError('');
    const hasSession = await loginWithGoogle(credentialResponse.credential);
    if (!hasSession) {
      setGoogleError('Nao foi possivel entrar com Google.');
      return;
    }

    navigate('/', { replace: true });
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    console.log('Google login origin:', window.location.origin);
  }, []);

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
          <p className="login-subtitle">Use sua conta Google para continuar no painel.</p>
        </header>

        {googleError ? (
          <div className="login-alert login-alert-error" role="alert">
            <span>{googleError}</span>
          </div>
        ) : null}

        {googleClientId ? (
          <div className="login-google">
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
        ) : (
          <div className="login-alert login-alert-error" role="alert">
            <span>Login com Google nao configurado.</span>
          </div>
        )}

        <footer className="login-footer" id="login-help">
          <p>Entre apenas com o email Google autorizado.</p>
        </footer>
      </section>
    </main>
  );
}
