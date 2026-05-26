import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

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
