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

fixture('Transactions — quick add, list, delete')
  .page(BASE_URL)
  .beforeEach(async (t) => {
    await clearLocalStorage();
    await seedApp(DEFAULT_AUTH, SEED_DATA_WITH_BUDGET);
    await t.navigateTo(BASE_URL);
  });

test('Add an income transaction and see it on Overview', async (t) => {
  await AppShell.gotoTab('transactions');
  await TransactionsPage.addIncome({ category: 'Salary', amount: 5000, note: 'May paycheck' });

  await t.expect(TransactionsPage.txRows.count).gte(1);
  await t.expect(Selector('.card.tight').withText('Salary').exists).ok();

  await AppShell.gotoTab('overview');
  await t.expect(Selector('.stat-value').withText(/5,000/).exists).ok('income $5,000 visible');
});

test('Add an expense and verify category', async (t) => {
  await AppShell.gotoTab('transactions');
  await TransactionsPage.addExpense({ category: 'Groceries', amount: 87.50 });
  await t.expect(Selector('.card.tight').withText('Groceries').exists).ok();
  await t.expect(Selector('.card.tight').withText('$87.50').exists).ok();
});

test('Delete a transaction', async (t) => {
  await AppShell.gotoTab('transactions');
  await TransactionsPage.addExpense({ category: 'Rent', amount: 1500 });
  const row = Selector('.card.tight').withText('Rent');
  await t.expect(row.exists).ok();
  await t.click(row.find('button.danger'));
  await t.expect(Selector('.card.tight').withText('Rent').exists).notOk('row removed');
});

test('Search filters the transaction list', async (t) => {
  await AppShell.gotoTab('transactions');
  await TransactionsPage.addExpense({ category: 'Rent', amount: 1500 });
  await TransactionsPage.addExpense({ category: 'Groceries', amount: 80 });
  await t.typeText(TransactionsPage.searchInput, 'rent');
  await t.expect(Selector('.card.tight').withText('Rent').exists).ok();
  await t.expect(Selector('.card.tight').withText('Groceries').exists).notOk();
});
