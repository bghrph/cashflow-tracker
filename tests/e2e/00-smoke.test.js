import { Selector } from 'testcafe';
import { BASE_URL, clearLocalStorage, seedApp, DEFAULT_AUTH } from './helpers.js';
import AppShell from './pages/AppShell.js';

fixture('Smoke — auth, navigation, theme')
  .page(BASE_URL)
  .beforeEach(async (t) => {
    await clearLocalStorage();
    await t.navigateTo(BASE_URL);
  });

test('Auth screen renders Google Sign-In button', async (t) => {
  await t.expect(Selector('[data-testid="auth-screen"]').exists).ok('auth screen renders');
  await t
    .expect(Selector('[data-testid="google-signin-btn"]').exists)
    .ok('Google sign-in button present');
});

test('All 4 tabs navigate cleanly (seeded session)', async (t) => {
  await seedApp(DEFAULT_AUTH, null);
  await t.navigateTo(BASE_URL);
  for (const tabId of ['transactions', 'goals', 'setup', 'overview']) {
    await AppShell.gotoTab(tabId);
    await t.expect(AppShell.tabContent(tabId).exists).ok(`tab ${tabId} mounts`);
  }
});
