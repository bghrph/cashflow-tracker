// Vitest global setup — runs before each test file in Node workers.
// Node 25 ships a native localStorage that requires --localstorage-file to work.
// Replace it with a simple in-memory implementation so tests work without flags.
(function installLocalStorage() {
  const store = new Map();
  const ls = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    get length() { return store.size; },
    key(index) { return [...store.keys()][index] ?? null; },
  };
  // Only override when the native implementation lacks setItem (Node 25 without --localstorage-file)
  if (typeof globalThis.localStorage?.setItem !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: ls,
      writable: true,
      configurable: true,
    });
  }
})();
