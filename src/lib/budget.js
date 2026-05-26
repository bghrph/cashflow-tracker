import { convert } from './currencies.js';
import { monthRange } from './dates.js';

// Compute spent / surplus / rollover-amount for one category in one month.
// Returns null if no budget is configured for that category.
export function calcRollover(data, category, year, monthIndex) {
  const cfg = data.budgetTargets[category];
  if (!cfg || cfg.monthly <= 0) return null;
  const pc = data.primaryCurrency;
  const range = monthRange(year, monthIndex);
  const spent = data.transactions
    .filter(
      (t) => t.date >= range.start && t.date <= range.end && t.type === 'Expense' && t.category === category
    )
    .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
  const surplus = cfg.monthly - spent;
  const rolloverType = cfg.rollover || 'none';
  let rolloverAmount;
  if (surplus <= 0) rolloverAmount = 0;
  else if (rolloverType === 'limited') rolloverAmount = Math.min(surplus, cfg.rolloverLimit || 0);
  else if (rolloverType === 'none') rolloverAmount = 0;
  else rolloverAmount = surplus;
  return {
    budget: cfg.monthly,
    spent,
    surplus,
    rolloverAmount,
    rolloverType,
  };
}
