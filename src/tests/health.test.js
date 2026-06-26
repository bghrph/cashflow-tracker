import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcHealth } from '../lib/health.js';

// calcHealth reads `new Date()` for the 3-month window and current month, so we
// pin the clock to a mid-month date (avoids month/day rollover across TZ).
const NOW = '2026-06-15T12:00:00';

function makeData(overrides = {}) {
  return {
    primaryCurrency: 'USD',
    transactions: [],
    budgetTargets: {},
    savingsGoals: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('calcHealth — empty data', () => {
  it('falls back to neutral sub-scores', () => {
    const h = calcHealth(makeData());
    expect(h.savings.score).toBe(0); // no income → 0 savings score
    expect(h.adherence.score).toBe(100); // no budgets → assume adherent
    expect(h.consistency.score).toBe(80); // <2 months → neutral default
    expect(h.goals.score).toBe(50); // no goals → neutral default
    expect(h.overall).toBe(58); // round(0+25+20+12.5)
  });
});

describe('calcHealth — savings rate tiers', () => {
  it('awards a full score for a savings rate of 20%+', () => {
    const h = calcHealth(
      makeData({
        transactions: [
          { date: '2026-06-01', type: 'Income', amount: 1000 },
          { date: '2026-06-02', type: 'Expense', amount: 100, category: 'X' },
        ],
      })
    );
    expect(h.savings.rate).toBe(90);
    expect(h.savings.score).toBe(100);
  });

  it('scores the 10–20% band on the 60+ ramp', () => {
    const h = calcHealth(
      makeData({
        transactions: [
          { date: '2026-06-01', type: 'Income', amount: 100 },
          { date: '2026-06-02', type: 'Expense', amount: 85, category: 'X' }, // 15% rate
        ],
      })
    );
    expect(h.savings.rate).toBe(15);
    expect(h.savings.score).toBe(80); // 60 + (15-10)*4
  });

  it('scores below 10% on the steep low ramp', () => {
    const h = calcHealth(
      makeData({
        transactions: [
          { date: '2026-06-01', type: 'Income', amount: 100 },
          { date: '2026-06-02', type: 'Expense', amount: 95, category: 'X' }, // 5% rate
        ],
      })
    );
    expect(h.savings.score).toBe(30); // 5 * 6
  });

  it('excludes transactions older than three months from the window', () => {
    const h = calcHealth(
      makeData({
        transactions: [
          { date: '2026-01-01', type: 'Income', amount: 999999 }, // out of window
          { date: '2026-06-01', type: 'Income', amount: 100 },
          { date: '2026-06-02', type: 'Expense', amount: 100, category: 'X' },
        ],
      })
    );
    expect(h.savings.rate).toBe(0); // income 100, expense 100 → 0% saved
  });
});

describe('calcHealth — budget adherence', () => {
  it('is full when current-month spending is within budget', () => {
    const h = calcHealth(
      makeData({
        budgetTargets: { Groceries: { monthly: 200 } },
        transactions: [{ date: '2026-06-10', type: 'Expense', amount: 150, category: 'Groceries' }],
      })
    );
    expect(h.adherence.score).toBe(100);
    expect(h.adherence.count).toBe(1);
  });

  it('drops to zero at 50% over budget', () => {
    const h = calcHealth(
      makeData({
        budgetTargets: { Groceries: { monthly: 100 } },
        transactions: [{ date: '2026-06-10', type: 'Expense', amount: 150, category: 'Groceries' }],
      })
    );
    // ratio 1.5 → 100 - (0.5 * 200) = 0
    expect(h.adherence.score).toBe(0);
  });
});

describe('calcHealth — goals', () => {
  it('reflects partial goal progress', () => {
    const h = calcHealth(makeData({ savingsGoals: [{ current: 50, target: 100 }] }));
    expect(h.goals.score).toBe(50);
    expect(h.goals.count).toBe(1);
  });

  it('caps each goal contribution at 100% even when over-funded', () => {
    const h = calcHealth(
      makeData({ savingsGoals: [{ current: 300, target: 100 }, { current: 100, target: 100 }] })
    );
    expect(h.goals.score).toBe(100);
  });
});
