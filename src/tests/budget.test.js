import { describe, it, expect } from 'vitest';
import { calcRollover } from '../lib/budget.js';

// calcRollover takes (data, category, year, monthIndex) and is date-agnostic
// (the month is passed explicitly), so no clock faking is needed.
function makeData(targets, transactions = []) {
  return { primaryCurrency: 'USD', budgetTargets: targets, transactions };
}

const TX = (over) => ({ date: '2026-03-15', type: 'Expense', category: 'Groceries', amount: 100, ...over });

describe('calcRollover', () => {
  it('returns null when the category has no budget configured', () => {
    expect(calcRollover(makeData({}), 'Groceries', 2026, 2)).toBe(null);
  });
  it('returns null when the configured budget is zero or negative', () => {
    expect(calcRollover(makeData({ Groceries: { monthly: 0 } }), 'Groceries', 2026, 2)).toBe(null);
  });

  it('sums only matching expenses within the month range', () => {
    const data = makeData({ Groceries: { monthly: 500 } }, [
      TX({ amount: 100 }),
      TX({ amount: 50 }),
      TX({ amount: 999, date: '2026-04-01' }), // out of month
      TX({ amount: 999, type: 'Income' }), // not an expense
      TX({ amount: 999, category: 'Rent' }), // other category
    ]);
    const r = calcRollover(data, 'Groceries', 2026, 2);
    expect(r.spent).toBe(150);
    expect(r.surplus).toBe(350);
  });

  it('clamps rollover to zero when over budget (negative surplus)', () => {
    const data = makeData({ Groceries: { monthly: 100, rollover: 'unlimited' } }, [TX({ amount: 150 })]);
    const r = calcRollover(data, 'Groceries', 2026, 2);
    expect(r.surplus).toBe(-50);
    expect(r.rolloverAmount).toBe(0);
  });

  it('rolls over the full surplus for an accumulating budget', () => {
    const data = makeData({ Groceries: { monthly: 500, rollover: 'accumulate' } }, [TX({ amount: 100 })]);
    expect(calcRollover(data, 'Groceries', 2026, 2).rolloverAmount).toBe(400);
  });

  it('defaults to no rollover when rollover type is unset', () => {
    const data = makeData({ Groceries: { monthly: 500 } }, [TX({ amount: 100 })]);
    const r = calcRollover(data, 'Groceries', 2026, 2);
    expect(r.rolloverType).toBe('none');
    expect(r.rolloverAmount).toBe(0);
  });

  it('caps a limited rollover at rolloverLimit', () => {
    const data = makeData(
      { Groceries: { monthly: 500, rollover: 'limited', rolloverLimit: 100 } },
      [TX({ amount: 100 })]
    );
    // surplus is 400 but the limit caps it at 100
    expect(calcRollover(data, 'Groceries', 2026, 2).rolloverAmount).toBe(100);
  });

  it('treats a missing rolloverLimit as zero for limited rollover', () => {
    const data = makeData(
      { Groceries: { monthly: 500, rollover: 'limited' } },
      [TX({ amount: 100 })]
    );
    expect(calcRollover(data, 'Groceries', 2026, 2).rolloverAmount).toBe(0);
  });

  it('converts foreign-currency expenses into the primary currency', () => {
    const data = {
      primaryCurrency: 'USD',
      budgetTargets: { Groceries: { monthly: 500 } },
      transactions: [TX({ amount: 100, currencyCode: 'EUR' })], // 100 EUR = 108 USD
    };
    expect(calcRollover(data, 'Groceries', 2026, 2).spent).toBeCloseTo(108, 5);
  });
});
