import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { IconGoogle, IconWallet } from './icons.jsx';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged in App.jsx will handle the rest
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
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
