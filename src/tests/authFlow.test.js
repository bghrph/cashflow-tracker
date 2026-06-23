/**
 * Auth flow tests (iOS PWA sign-in gate — PLAN-IOS-PWA item 13):
 * - standalone-display detection (iOS navigator.standalone + display-mode media query)
 * - signInWithGoogle routing: redirect in standalone, popup otherwise
 * - popup-failure fallback policy: redirect only on popup-transport errors,
 *   rethrow on deliberate user-cancel / non-popup errors
 * - completeRedirectSignIn surfaces the returned user (or null)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: mocks.signInWithPopup,
  signInWithRedirect: mocks.signInWithRedirect,
  getRedirectResult: mocks.getRedirectResult,
  GoogleAuthProvider: class GoogleAuthProvider {},
}));

vi.mock('../lib/firebase.js', () => ({ auth: { marker: 'auth' }, db: {} }));

import { isStandaloneDisplay, signInWithGoogle, completeRedirectSignIn } from '../lib/authFlow.js';
import { auth } from '../lib/firebase.js';

/** Set the two signals that mark a standalone (installed/webview) display. */
function setDisplay({ navStandalone = false, displayMode = false } = {}) {
  Object.defineProperty(window.navigator, 'standalone', {
    value: navStandalone,
    configurable: true,
  });
  window.matchMedia = (query) => ({
    matches: displayMode && query.includes('display-mode: standalone'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

function popupError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

beforeEach(() => {
  mocks.signInWithPopup.mockReset().mockResolvedValue({ user: { uid: 'u1' } });
  mocks.signInWithRedirect.mockReset().mockResolvedValue(undefined);
  mocks.getRedirectResult.mockReset().mockResolvedValue(null);
  setDisplay({ navStandalone: false, displayMode: false });
});

afterEach(() => {
  delete window.navigator.standalone;
});

describe('isStandaloneDisplay', () => {
  it('is true when iOS navigator.standalone is true', () => {
    setDisplay({ navStandalone: true });
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('is true when display-mode:standalone media query matches', () => {
    setDisplay({ displayMode: true });
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    setDisplay({ navStandalone: false, displayMode: false });
    expect(isStandaloneDisplay()).toBe(false);
  });
});

describe('signInWithGoogle — routing', () => {
  it('goes straight to redirect in standalone mode (never opens a popup)', async () => {
    setDisplay({ navStandalone: true });
    await signInWithGoogle();
    expect(mocks.signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithRedirect.mock.calls[0][0]).toBe(auth);
    expect(mocks.signInWithPopup).not.toHaveBeenCalled();
  });

  it('uses a popup in a normal browser and does not redirect on success', async () => {
    await signInWithGoogle();
    expect(mocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithPopup.mock.calls[0][0]).toBe(auth);
    expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle — popup-failure fallback policy (Option 1)', () => {
  it('falls back to redirect when the popup is blocked', async () => {
    mocks.signInWithPopup.mockRejectedValue(popupError('auth/popup-blocked'));
    await signInWithGoogle();
    expect(mocks.signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('falls back to redirect when popups are unsupported in the environment', async () => {
    mocks.signInWithPopup.mockRejectedValue(
      popupError('auth/operation-not-supported-in-this-environment')
    );
    await signInWithGoogle();
    expect(mocks.signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('rethrows (no redirect) when the user deliberately closes the popup', async () => {
    mocks.signInWithPopup.mockRejectedValue(popupError('auth/popup-closed-by-user'));
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
    expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('rethrows (no redirect) on a benign cancelled-popup-request double-trigger', async () => {
    mocks.signInWithPopup.mockRejectedValue(popupError('auth/cancelled-popup-request'));
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'auth/cancelled-popup-request' });
    expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('rethrows (no redirect) on a non-popup error like unauthorized-domain', async () => {
    mocks.signInWithPopup.mockRejectedValue(popupError('auth/unauthorized-domain'));
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'auth/unauthorized-domain' });
    expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
  });
});

describe('completeRedirectSignIn', () => {
  it('returns true when a redirect sign-in just completed with a user', async () => {
    mocks.getRedirectResult.mockResolvedValue({ user: { uid: 'u1' } });
    await expect(completeRedirectSignIn()).resolves.toBe(true);
    expect(mocks.getRedirectResult.mock.calls[0][0]).toBe(auth);
  });

  it('returns false when there is no pending redirect result', async () => {
    mocks.getRedirectResult.mockResolvedValue(null);
    await expect(completeRedirectSignIn()).resolves.toBe(false);
  });

  it('propagates redirect-leg errors so the UI can surface them', async () => {
    mocks.getRedirectResult.mockRejectedValue(popupError('auth/account-exists-with-different-credential'));
    await expect(completeRedirectSignIn()).rejects.toMatchObject({
      code: 'auth/account-exists-with-different-credential',
    });
  });
});
