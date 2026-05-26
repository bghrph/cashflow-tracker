// Default state shape + a forward-compatible migrator. The storage key
// (mbr-data-v4) is intentionally preserved so users coming from the legacy
// HTML build carry their data over with no action required.

export const DEFAULT_STATE = {
  primaryCurrency: 'USD',
  incomeGroups: [{ name: 'General', categories: ['Salary', 'Freelance', 'Investments'] }],
  expenseGroups: [
    { name: 'Bills & Housing', categories: ['Rent', 'Utilities'] },
    { name: 'Living', categories: ['Groceries', 'Transport'] },
  ],
  transactions: [],
  nextId: 1,
  budgetTargets: {},
  savingsGoals: [],
  nextGoalId: 1,
  notifications: [],
  nextNotifId: 1,
  monthlySavingsTarget: 0,
  recurringTemplates: [],
  nextTplId: 1,
  lastAutoFillMonth: '',
  aiPreference: 'fallback', // 'local' | 'fallback' | 'always'
};

export function migrate(input) {
  const data = input || {};
  const result = { ...DEFAULT_STATE, ...data };

  // Legacy flat-category → grouped-category migration
  if (data.incomeCategories && !data.incomeGroups) {
    result.incomeGroups = [{ name: 'General', categories: [...data.incomeCategories] }];
  }
  if (data.expenseCategories && !data.expenseGroups) {
    result.expenseGroups = [{ name: 'General', categories: [...data.expenseCategories] }];
  }

  // Defensive defaults
  if (!result.budgetTargets) result.budgetTargets = {};
  if (!result.savingsGoals) result.savingsGoals = [];
  if (!result.notifications) result.notifications = [];
  if (!result.nextGoalId) result.nextGoalId = 1;
  if (!result.nextNotifId) result.nextNotifId = 1;
  if (!result.monthlySavingsTarget) result.monthlySavingsTarget = 0;
  if (!result.recurringTemplates) result.recurringTemplates = [];
  if (!result.nextTplId) result.nextTplId = 1;
  if (!result.lastAutoFillMonth) result.lastAutoFillMonth = '';
  if (!result.aiPreference) result.aiPreference = 'fallback';

  // Per-transaction currency tagging
  result.transactions = (result.transactions || []).map((t) =>
    t.currencyCode ? t : { ...t, currencyCode: result.primaryCurrency || 'USD' }
  );

  // Drop deprecated top-level currency string
  if (result.currency) delete result.currency;

  return result;
}
