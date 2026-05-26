// Storage abstraction. Uses localStorage in browsers (Vite app) but keeps an
// async signature so callers don't need to change if we move to IndexedDB or a
// server sync later.

export const STORAGE_KEYS = {
  data: 'mbr-data-v4',
  auth: 'mbr-auth-v4',
};

async function get(key) {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

async function set(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — fail silently, the in-memory state still works.
  }
}

export const loadData = () => get(STORAGE_KEYS.data);
export const saveData = (v) => set(STORAGE_KEYS.data, v);
export const loadAuth = () => get(STORAGE_KEYS.auth);
export const saveAuth = (v) => set(STORAGE_KEYS.auth, v);
