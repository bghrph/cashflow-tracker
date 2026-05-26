import { Selector, t } from 'testcafe';

class TransactionsPage {
  constructor() {
    this.heading = Selector('h2').withText('Transactions');
    this.quickAddGrid = Selector('.quick-add-grid');
    this.dateInput = this.quickAddGrid.find('input[type="date"]');
    this.typeSelect = this.quickAddGrid.find('select').nth(0);
    this.categorySelect = this.quickAddGrid.find('select').nth(1);
    this.currencySelect = this.quickAddGrid.find('select').nth(2);
    this.amountInput = this.quickAddGrid.find('input[type="number"]');
    this.noteInput = this.quickAddGrid.find('input').withAttribute('placeholder', /Optional/i);
    this.addButton = this.quickAddGrid.find('button.primary');
    this.searchInput = Selector('input').withAttribute('placeholder', /Search transactions/);
    this.txRows = Selector('.card.tight');

    // Smart input
    this.smartInputHeader = Selector('button').withText('Smart Input');
    this.smartTextarea = Selector('[data-testid="smart-textarea"]');
    this.smartParseLocal = Selector('[data-testid="smart-parse-local"]');
    this.smartParseAi = Selector('[data-testid="smart-parse-ai"]');
    this.smartConfirm = Selector('[data-testid="smart-confirm"]');
    this.localBadges = Selector('.source-badge.local');
    this.aiBadges = Selector('.source-badge.ai');
  }

  async addExpense({ category, amount, note = '' }) {
    await t.click(this.typeSelect).click(this.typeSelect.find('option').withText('Expense'));
    await t.click(this.categorySelect).click(this.categorySelect.find('option').withText(category));
    await t.typeText(this.amountInput, String(amount));
    if (note) await t.typeText(this.noteInput, note);
    await t.click(this.addButton);
  }

  async addIncome({ category, amount, note = '' }) {
    await t.click(this.typeSelect).click(this.typeSelect.find('option').withText('Income'));
    await t.click(this.categorySelect).click(this.categorySelect.find('option').withText(category));
    await t.typeText(this.amountInput, String(amount));
    if (note) await t.typeText(this.noteInput, note);
    await t.click(this.addButton);
  }
}

export default new TransactionsPage();
