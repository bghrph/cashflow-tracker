import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => args.join('/')),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('../lib/firebase.js', () => ({ db: {} }));

const { loadData, saveData, loadProfile, saveProfile, loadLegacyData, clearLegacyData } =
  await import('../lib/firestore.js');

import { getDoc, setDoc } from 'firebase/firestore';

describe('firestore data layer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loadProfile returns null when document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await loadProfile('uid1')).toBeNull();
  });

  it('loadProfile returns document data when it exists', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ email: 'a@b.com' }) });
    expect(await loadProfile('uid1')).toEqual({ email: 'a@b.com' });
  });

  it('saveProfile calls setDoc with merge:true', async () => {
    setDoc.mockResolvedValueOnce(undefined);
    await saveProfile('uid1', { email: 'a@b.com' });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'a@b.com' },
      { merge: true }
    );
  });

  it('loadData returns null when document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await loadData('uid1')).toBeNull();
  });

  it('loadData returns document data when it exists', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ transactions: [] }) });
    expect(await loadData('uid1')).toEqual({ transactions: [] });
  });

  it('saveData calls setDoc with updatedAt timestamp', async () => {
    setDoc.mockResolvedValueOnce(undefined);
    await saveData('uid1', { transactions: [] });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ updatedAt: 'SERVER_TIMESTAMP' })
    );
  });

  it('loadLegacyData returns null when localStorage has no mbr-data-v4', () => {
    localStorage.clear();
    expect(loadLegacyData()).toBeNull();
  });

  it('loadLegacyData parses data from localStorage', () => {
    localStorage.setItem('mbr-data-v4', JSON.stringify({ transactions: [1] }));
    expect(loadLegacyData()).toEqual({ transactions: [1] });
    localStorage.removeItem('mbr-data-v4');
  });

  it('clearLegacyData removes mbr-data-v4', () => {
    localStorage.setItem('mbr-data-v4', '{}');
    clearLegacyData();
    expect(localStorage.getItem('mbr-data-v4')).toBeNull();
  });
});
