import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateNotifications } from '../lib/notifications.js';

// generateNotifications branches on the current date (day-of-month and
// days-remaining), so each test pins the clock to exercise a specific window.
function run(data, nowStr) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(nowStr));
  return generateNotifications({ primaryCurrency: 'USD', transactions: [], budgetTargets: {}, ...data });
}

afterEach(() => vi.useRealTimers());

const expense = (date, amount, category = 'Groceries') => ({ date, amount, category, type: 'Expense' });

describe('budget warnings', () => {
  it('warns at 80%+ of budget when it is still early in the month', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 100 } },
        transactions: [expense('2026-06-02', 80)],
      },
      '2026-06-10T12:00:00' // day 10 (< 18)
    );
    expect(notes.some((n) => n.type === 'warning')).toBe(true);
  });

  it('suppresses the warning past day 18', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 100 } },
        transactions: [expense('2026-06-02', 80)],
      },
      '2026-06-20T12:00:00' // day 20 (>= 18)
    );
    expect(notes.some((n) => n.type === 'warning')).toBe(false);
  });

  it('flags a danger when spending exceeds the budget', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 100 } },
        transactions: [expense('2026-06-02', 120)],
      },
      '2026-06-10T12:00:00'
    );
    const danger = notes.find((n) => n.type === 'danger');
    expect(danger).toBeTruthy();
    expect(danger.priority).toBe(3);
  });
});

describe('end-of-month surplus', () => {
  it('suggests saving surplus in the final week of the month', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 200 } },
        transactions: [expense('2026-06-10', 50)], // 150 under budget
      },
      '2026-06-28T12:00:00' // 2 days left in June
    );
    expect(notes.some((n) => n.type === 'success')).toBe(true);
  });

  it('excludes accumulating categories from the surplus suggestion', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 200, rollover: 'accumulate' } },
        transactions: [expense('2026-06-10', 50)],
      },
      '2026-06-28T12:00:00'
    );
    expect(notes.some((n) => n.type === 'success')).toBe(false);
  });
});

describe('weekly recap', () => {
  it('summarizes spending from the last seven days', () => {
    const notes = run(
      { transactions: [expense('2026-06-09', 40), expense('2026-06-10', 60)] },
      '2026-06-10T12:00:00'
    );
    const recap = notes.find((n) => n.type === 'recap');
    expect(recap).toBeTruthy();
    expect(recap.body).toContain('2 txns');
  });

  it('omits the recap when nothing was spent in the last week', () => {
    const notes = run(
      { transactions: [expense('2026-05-01', 40)] },
      '2026-06-10T12:00:00'
    );
    expect(notes.some((n) => n.type === 'recap')).toBe(false);
  });
});

describe('ordering', () => {
  it('sorts notifications by descending priority', () => {
    const notes = run(
      {
        budgetTargets: { Groceries: { monthly: 100 } },
        transactions: [expense('2026-06-02', 120), expense('2026-06-09', 120)],
      },
      '2026-06-10T12:00:00'
    );
    const priorities = notes.map((n) => n.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });
});
