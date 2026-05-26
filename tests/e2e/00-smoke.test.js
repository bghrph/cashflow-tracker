import { Selector } from 'testcafe';
import { BASE_URL, clearLocalStorage, signUp } from './helpers.js';
import AppShell from './pages/AppShell.js';

fixture('Smoke — auth, navigation, theme')
  .page(BASE_URL)
  .beforeEach(async (t) => {
    await clearLocalStorage();
    await t.navigateTo(BASE_URL);
  });

test('Sign-up flow drops user on Overview', async (t) => {
  await t.expect(Selector('[data-testid="auth-screen"]').exists).ok('auth screen renders');
  await signUp(t);
  await t.expect(AppShell.tabContent('overview').exists).ok('overview tab visible after signup');
  await t.expect(AppShell.headerTitle.innerText).contains('Overview');
});

test('All 4 tabs navigate cleanly', async (t) => {
  await signUp(t);
  for (const tabId of ['transactions', 'goals', 'setup', 'overview']) {
    await AppShell.gotoTab(tabId);
    await t.expect(AppShell.tabContent(tabId).exists).ok(`tab ${tabId} mounts`);
  }
});

test('Sign-up validation rejects bad inputs', async (t) => {
  await t.click(Selector('button').withText('Sign Up'));
  await t
    .typeText(Selector('[data-testid="auth-email"]'), 'who@where.com')
    .typeText(Selector('[data-testid="auth-password"]'), 'longenough')
    .click(Selector('[data-testid="auth-submit"]'));
  await t.expect(Selector('p').withText(/Name required/i).exists).ok();
});
