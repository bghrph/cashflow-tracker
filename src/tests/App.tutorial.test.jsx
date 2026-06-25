import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'uid1', displayName: 'Test User', email: 'test@example.com', photoURL: null });
    return () => {};
  }),
  signOut: vi.fn(async () => {}),
  // App.jsx completes any pending redirect sign-in on mount (PWA sign-in gate).
  getRedirectResult: vi.fn(async () => null),
}));

vi.mock('../lib/firebase.js', () => ({ auth: {}, db: {} }));

vi.mock('../lib/dataSync.js', () => ({
  startDataSync: vi.fn(),
  stopDataSync: vi.fn(),
  subscribeDataSync: vi.fn((fn) => {
    fn({ saveStatus: 'idle', remoteChange: false });
    return () => {};
  }),
  dismissRemoteChangeNotice: vi.fn(),
  markSavePending: vi.fn(),
  markSaveFailed: vi.fn(),
}));

vi.mock('../lib/firestore.js', () => ({
  loadProfile: vi.fn(async () => ({ hasSeenTutorial: true })),
  saveProfile: vi.fn(async () => {}),
  loadData: vi.fn(async () => ({ transactions: [] })),
  saveData: vi.fn(async () => {}),
  loadLegacyData: vi.fn(() => null),
  clearLegacyData: vi.fn(),
}));

vi.mock('../lib/migrate.js', () => ({
  migrate: vi.fn((d) => d),
  DEFAULT_STATE: { transactions: [] },
}));

vi.mock('../lib/notifications.js', () => ({ generateNotifications: vi.fn(() => []) }));
vi.mock('../lib/categories.js', () => ({ flattenCategories: vi.fn(() => []) }));

vi.mock('../components/Auth.jsx', () => ({ default: () => <div>auth</div> }));
vi.mock('../tabs/SetupTab.jsx', () => ({ default: () => null }));
vi.mock('../tabs/TransactionsTab.jsx', () => ({ default: () => null }));
vi.mock('../tabs/OverviewTab.jsx', () => ({ default: () => null }));
vi.mock('../tabs/GoalsTab.jsx', () => ({ default: () => null }));

vi.mock('../components/Shell.jsx', () => ({
  default: ({ onOpenTutorial, children }) => (
    <div data-testid="shell">
      <button onClick={onOpenTutorial}>open-tutorial</button>
      {children}
    </div>
  ),
}));

vi.mock('../components/TutorialOverlay.jsx', () => ({
  default: ({ open, onClose, onComplete }) =>
    open ? (
      <div data-testid="tutorial-overlay">
        <button onClick={onClose}>close-tutorial</button>
        <button onClick={onComplete}>complete-tutorial</button>
      </div>
    ) : null,
}));

const { default: App } = await import('../App.jsx');

describe('App — .app-background inertness lifecycle', () => {
  it('keeps the background interactive by default, inerts it while the tutorial is open, and restores it on close', async () => {
    render(<App />);

    const background = await waitFor(() => {
      const el = document.querySelector('.app-background');
      expect(el).toBeTruthy();
      return el;
    });

    expect(background).not.toHaveAttribute('inert');
    expect(background).not.toHaveAttribute('aria-hidden');

    await userEvent.click(screen.getByText('open-tutorial'));
    expect(background).toHaveAttribute('inert');
    expect(background).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(screen.getByText('close-tutorial'));
    expect(background).not.toHaveAttribute('inert');
    expect(background).not.toHaveAttribute('aria-hidden');
  });
});
