// Shared terminate→clear sequence used by both sign-out hygiene and the
// local-persistence preference toggle (plan item 7) — both need to safely tear
// down the cached Firestore client before the app reloads into a fresh state.
import { terminate, clearIndexedDbPersistence, waitForPendingWrites } from 'firebase/firestore';
import { db } from './firebase.js';

const PENDING_WRITES_TIMEOUT_MS = 8000;

let mutationsFrozen = false;

export function freezeMutations() {
  mutationsFrozen = true;
}

// Used to back out of a freeze when the user cancels a sign-out/cache-clear
// after seeing the discard-pending-writes warning.
export function unfreezeMutations() {
  mutationsFrozen = false;
}

export function areMutationsFrozen() {
  return mutationsFrozen;
}

function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// waitForPendingWrites() only accounts for writes pending *at the moment it's
// called* and would otherwise hang indefinitely while offline — race it against
// an explicit timeout so the caller can warn instead of hanging.
//
// Returns:
//   { synced: true }                                  — all pending writes acknowledged
//   { synced: false, discardsPendingWrites: true }    — timed out while offline; proceeding now would drop unsynced writes
//   { synced: false, discardsPendingWrites: false }   — timed out while online; writes are still in flight but not at risk of being silently dropped by a cache clear
export async function awaitPendingWrites() {
  freezeMutations();
  const result = await Promise.race([
    waitForPendingWrites().then(() => 'synced'),
    delay(PENDING_WRITES_TIMEOUT_MS, 'timeout'),
  ]);
  if (result === 'synced') return { synced: true };
  return { synced: false, discardsPendingWrites: !navigator.onLine };
}

// Best-effort: clearIndexedDbPersistence requires every Firestore instance on
// that IndexedDB to be terminated first. A second open Safari tab / installed
// PWA context still holding a connection makes it throw `failed-precondition`
// — that's not a bug, it's the platform telling us another context owns the
// cache right now. We surface that rather than throwing, since the caller
// reloads either way (this tab's `db` is unusable post-terminate).
export async function clearLocalCache() {
  await terminate(db);
  try {
    await clearIndexedDbPersistence(db);
    return { cleared: true };
  } catch (err) {
    if (err?.code === 'failed-precondition') {
      return { cleared: false, reason: 'failed-precondition' };
    }
    throw err;
  }
}
