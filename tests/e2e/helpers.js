import { Selector, ClientFunction } from 'testcafe';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// Clear localStorage so each test starts from a clean slate
export const clearLocalStorage = ClientFunction(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

// Pre-seed app state (login + data) so each test isn't slowed by sign-up flow
export const seedApp = ClientFunction((auth, data) => {
  localStorage.setItem('mbr-auth-v4', JSON.stringify(auth));
  if (data) localStorage.setItem('mbr-data-v4', JSON.stringify(data));
});

export const getLocalStorage = ClientFunction((key) => {
  return localStorage.getItem(key);
});

export const getTheme = ClientFunction(() => {
  return document.documentElement.getAttribute('data-theme');
});

// signUp removed — auth is now Google Sign-In only via Firebase popup.
// E2E tests that need an authenticated session should use seedApp() instead.

export const DEFAULT_AUTH = { name: 'E2E User', email: 'e2e@test.com', provider: 'email' };

export const SEED_DATA_WITH_BUDGET = {
  primaryCurrency: 'USD',
  incomeGroups: [{ name: 'General', categories: ['Salary', 'Freelance', 'Investments'] }],
  expenseGroups: [
    { name: 'Bills & Housing', categories: ['Rent', 'Utilities'] },
    { name: 'Living', categories: ['Groceries', 'Transport'] },
  ],
  transactions: [],
  nextId: 1,
  budgetTargets: { Groceries: { monthly: 400, rollover: 'none', rolloverLimit: 0, surplusGoalId: null } },
  savingsGoals: [],
  nextGoalId: 1,
  notifications: [],
  nextNotifId: 1,
  monthlySavingsTarget: 500,
  recurringTemplates: [],
  nextTplId: 1,
  lastAutoFillMonth: '',
  aiPreference: 'local',
};
