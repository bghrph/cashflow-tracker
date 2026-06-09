// Local-persistence preference, read BEFORE the first initializeFirestore() call.
// Firestore cache settings are immutable once the client initializes, so this
// must be a localStorage read at module-load time, not a runtime toggle.
const STORAGE_KEY = 'cashflow-local-persistence';

export function isLocalPersistenceEnabled() {
  try {
    if (typeof localStorage === 'undefined') return true;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'on';
  } catch {
    return true;
  }
}

// Stores the preference for the *next* app load and signals callers that a
// reload is required — flipping it doesn't change the already-initialized client.
export function setLocalPersistencePreference(enabled) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    }
  } catch {
    // ignore — preference falls back to default (on) next load
  }
}
