import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from './firebase.js';

// Popup sign-in can't work in an installed iOS PWA or an in-app webview: the
// popup window either never opens or can't postMessage its result back, so the
// promise hangs forever. A full-page redirect is the supported path there.
// We detect that context two ways because no single signal covers everything:
//  - iOS Safari home-screen apps expose the legacy, non-standard
//    `navigator.standalone` boolean (and DON'T reliably report display-mode).
//  - Every other engine reports the standards-track display-mode media query.
export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const iosStandalone = window.navigator?.standalone === true;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
}

// Popup failures that specifically mean "the popup transport is unavailable, but
// a redirect would work." We fall back to redirect ONLY for these. Deliberate
// user-cancels (`auth/popup-closed-by-user`) and benign double-triggers
// (`auth/cancelled-popup-request`) are rethrown so we don't hijack the user's
// choice or navigate away from a popup that's still open. Non-popup errors
// (e.g. `auth/unauthorized-domain`, network) are rethrown too — redirecting
// would hit the same wall and bury a clear error behind a page navigation.
const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

// Start a Google sign-in. In a standalone display we redirect immediately
// (skip the doomed popup). In a normal browser we prefer the popup — it keeps
// the user on-page — and only fall back to redirect when the popup transport
// is unavailable. On the redirect path this call navigates away, so nothing
// after `await signInWithGoogle()` runs; the result is picked up on reload by
// `completeRedirectSignIn()`.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  if (isStandaloneDisplay()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (POPUP_FALLBACK_CODES.has(err?.code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

// Call once at app startup. `onAuthStateChanged` already delivers the user on a
// successful redirect, but redirect-leg *errors* surface ONLY here — without
// this call a failed redirect silently drops the user back on the login screen
// with no explanation. Returns true if a redirect sign-in just completed.
export async function completeRedirectSignIn() {
  const result = await getRedirectResult(auth);
  return result?.user != null;
}
