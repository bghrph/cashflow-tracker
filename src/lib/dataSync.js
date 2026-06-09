// Centralized save-status + remote-change awareness, both derived from a
// single live `onSnapshot` listener on the user's appdata document (plan item
// 6 + the `lastWriterId` mitigation in Risks). Combining them avoids running
// two listeners that would each re-derive the same `hasPendingWrites`/
// `updatedAt` bookkeeping.
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { RUNTIME_ID } from './runtimeId.js';

let listeners = [];
let state = { saveStatus: 'idle', remoteChange: false };
let unsubscribeSnapshot = null;
let knownUpdatedAtMs = null;
let initialized = false;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function subscribeDataSync(fn) {
  listeners.push(fn);
  fn(state);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function startDataSync(uid) {
  stopDataSync();
  knownUpdatedAtMs = null;
  initialized = false;
  state = { saveStatus: 'idle', remoteChange: false };

  unsubscribeSnapshot = onSnapshot(
    doc(db, 'users', uid, 'appdata', 'main'),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) return;
      const docData = snap.data();
      const updatedAtMs = docData.updatedAt?.toMillis ? docData.updatedAt.toMillis() : null;
      const lastWriterId = docData.lastWriterId;
      const { hasPendingWrites } = snap.metadata;

      if (hasPendingWrites) {
        setState({ saveStatus: navigator.onLine ? 'pending' : 'offline-queued' });
      } else if (state.saveStatus === 'pending' || state.saveStatus === 'offline-queued') {
        setState({ saveStatus: 'synced' });
      }

      if (!initialized) {
        // First emission is the existing baseline, not a "change" — recording
        // it without comparing avoids firing the notice on initial load.
        initialized = true;
        knownUpdatedAtMs = updatedAtMs;
        return;
      }

      // A newer `updatedAt` with someone else's `lastWriterId` is a genuine
      // remote change. Without the id check, the server-ack of THIS client's
      // own pending write (which also bumps `updatedAt` and flips
      // `hasPendingWrites` false) would look identical to a remote edit.
      if (
        updatedAtMs != null &&
        (knownUpdatedAtMs == null || updatedAtMs > knownUpdatedAtMs) &&
        lastWriterId &&
        lastWriterId !== RUNTIME_ID
      ) {
        setState({ remoteChange: true });
      }
      knownUpdatedAtMs = updatedAtMs;
    },
    () => setState({ saveStatus: 'failed' })
  );
}

export function stopDataSync() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  listeners = [];
  state = { saveStatus: 'idle', remoteChange: false };
}

export function dismissRemoteChangeNotice() {
  setState({ remoteChange: false });
}

// Called synchronously when `update()` queues a write — the snapshot listener
// will confirm/correct this once Firestore reports `hasPendingWrites`, but
// marking it immediately means the indicator reflects "saving…" without
// waiting a tick for the round trip.
export function markSavePending() {
  setState({ saveStatus: navigator.onLine ? 'pending' : 'offline-queued' });
}

export function markSaveFailed() {
  setState({ saveStatus: 'failed' });
}
