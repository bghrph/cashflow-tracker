import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { RUNTIME_ID } from './runtimeId.js';

export async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, profile) {
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
}

export async function loadData(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'appdata', 'main'));
  return snap.exists() ? snap.data() : null;
}

export async function saveData(uid, data) {
  await setDoc(doc(db, 'users', uid, 'appdata', 'main'), {
    ...data,
    updatedAt: serverTimestamp(),
    // Tags this write with the originating tab/runtime so the live listener
    // (see dataSync.js) can tell "server-acked my own write" apart from
    // "someone else changed this" — both bump updatedAt identically.
    lastWriterId: RUNTIME_ID,
  });
}

export function loadLegacyData() {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('mbr-data-v4') : null;
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function clearLegacyData() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('mbr-data-v4');
  } catch {
    // ignore
  }
}
