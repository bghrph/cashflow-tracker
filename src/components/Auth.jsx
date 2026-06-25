import React, { useState } from 'react';
import { signInWithGoogle } from '../lib/authFlow.js';
import { IconGoogle, IconWallet } from './icons.jsx';

export default function Auth({ initialError = '' }) {
  const [loading, setLoading] = useState(false);
  // Seed with any error from a failed redirect leg (surfaced by App.jsx).
  const [error, setError] = useState(initialError);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // Popup path: onAuthStateChanged in App.jsx takes over from here.
      // Redirect path: the call above navigates away, so nothing below runs —
      // we intentionally leave `loading` true until the page unloads.
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Please try again.');
      setLoading(false);
    }
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
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Quiet Wealth, Clear Numbers</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <button
            className="btn outline block"
            onClick={handleGoogle}
            disabled={loading}
            data-testid="google-signin-btn"
            style={{ marginBottom: 16 }}
          >
            <IconGoogle />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error && (
            <p style={{ color: 'var(--negative)', fontSize: 12, marginTop: 8 }}>{error}</p>
          )}

          <p style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 16 }}>
            Your data is private · syncs across all your devices
          </p>
        </div>
      </div>
    </div>
  );
}
