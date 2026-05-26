import React, { useState } from 'react';
import { IconEye, IconEyeOff, IconGoogle, IconWallet } from './icons.jsx';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');

  const submit = () => {
    setErr('');
    if (mode === 'signup' && !name.trim()) return setErr('Name required.');
    if (!email.includes('@')) return setErr('Valid email required.');
    if (password.length < 6) return setErr('Password must be 6+ characters.');
    onLogin({ name: name.trim() || email.split('@')[0], email, provider: 'email' });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div className="fade-up" data-testid="auth-screen" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 16px',
              background: 'var(--accent)',
              color: 'var(--ink-on-accent)',
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconWallet size={28} />
          </div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>CashFlow Tracker</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            Quiet, thoughtful personal finance
          </p>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              background: 'var(--surface)',
              borderRadius: 10,
              padding: 3,
              marginBottom: 20,
            }}
          >
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErr('');
                }}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === m ? 'var(--bg-elev)' : 'transparent',
                  color: mode === m ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <button
            onClick={() => onLogin({ name: 'Google User', email: 'user@gmail.com', provider: 'google' })}
            className="btn outline block"
            style={{ marginBottom: 16 }}
          >
            <IconGoogle /> Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'signup' && (
              <input
                className="input"
                placeholder="Full Name"
                data-testid="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="input"
              type="email"
              placeholder="Email"
              data-testid="auth-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="Password (6+)"
                data-testid="auth-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                style={{ paddingRight: 40 }}
              />
              <button
                className="btn ghost icon"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {err && (
            <p style={{ color: 'var(--negative)', fontSize: 12, marginTop: 10 }}>{err}</p>
          )}

          <button
            className="btn primary block"
            onClick={submit}
            data-testid="auth-submit"
            style={{ marginTop: 16, padding: '11px 0' }}
          >
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
