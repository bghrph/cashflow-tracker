// IMPORTANT: these tests force the parser into LOCAL mode so no Anthropic API
// calls happen during CI. The AI path is verified separately via curl in dev.

import { Selector } from 'testcafe';
import {
  BASE_URL,
  clearLocalStorage,
  seedApp,
  DEFAULT_AUTH,
  SEED_DATA_WITH_BUDGET,
} from './helpers.js';
import AppShell from './pages/AppShell.js';
import TransactionsPage from './pages/TransactionsPage.js';

fixture('Smart Input — local-mode parsing')
  .page(BASE_URL)
  .beforeEach(async (t) => {
    await clearLocalStorage();
    await seedApp(DEFAULT_AUTH, { ...SEED_DATA_WITH_BUDGET, aiPreference: 'local' });
    await t.navigateTo(BASE_URL);
  });

test('Local parser turns "Salary 5000, rent 1500" into 2 rows with Local badges', async (t) => {
  await AppShell.gotoTab('transactions');
  await t.click(TransactionsPage.smartInputHeader);
  await t.typeText(TransactionsPage.smartTextarea, 'Salary 5000, rent 1500');
  await t.click(TransactionsPage.smartParseLocal);

  await t.expect(TransactionsPage.localBadges.count).eql(2);
  await t.expect(TransactionsPage.aiBadges.count).eql(0);

  await t.click(TransactionsPage.smartConfirm);
  await t.expect(Selector('.card.tight').withText('Salary').exists).ok();
  await t.expect(Selector('.card.tight').withText(/Rent/).exists).ok();
});

test('Warning row appears when local parser cannot extract amount', async (t) => {
  await AppShell.gotoTab('transactions');
  await t.click(TransactionsPage.smartInputHeader);
  await t.typeText(TransactionsPage.smartTextarea, 'uber ride home');
  await t.click(TransactionsPage.smartParseLocal);
  await t.expect(Selector('div').withText(/No amount found/).exists).ok();
});
