import { convert } from './currencies.js';
import { dateString, monthRange } from './dates.js';

// Composite financial health score (0–100), four equally weighted metrics:
//  - Savings rate (3-mo)
//  - Budget adherence (current month)
//  - Spending consistency (3-mo std/mean)
//  - Goal progress
export function calcHealth(data) {
  const pc = data.primaryCurrency;
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  const startStr = dateString(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), threeMonthsAgo.getDate());
  const recent = data.transactions.filter((t) => t.date >= startStr);

  const incomeTotal = recent
    .filter((t) => t.type === 'Income')
    .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
  const expenseTotal = recent
    .filter((t) => t.type === 'Expense')
    .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);

  const savingsRate = incomeTotal > 0 ? Math.max(0, ((incomeTotal - expenseTotal) / incomeTotal) * 100) : 0;
  const savingsScore = savingsRate >= 20 ? 100 : savingsRate >= 10 ? 60 + (savingsRate - 10) * 4 : savingsRate * 6;

  const targets = Object.entries(data.budgetTargets).filter(([, v]) => v.monthly > 0);
  let adherenceScore = 100;
  if (targets.length > 0) {
    const cm = monthRange(now.getFullYear(), now.getMonth());
    const mTx = data.transactions.filter((t) => t.date >= cm.start && t.date <= cm.end);
    let total = 0;
    targets.forEach(([cat, cfg]) => {
      const spent = mTx
        .filter((t) => t.type === 'Expense' && t.category === cat)
        .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
      const ratio = cfg.monthly > 0 ? spent / cfg.monthly : 0;
      total += ratio <= 1 ? 100 : Math.max(0, 100 - (ratio - 1) * 200);
    });
    adherenceScore = total / targets.length;
  }

  const monthlyExpense = {};
  recent
    .filter((t) => t.type === 'Expense')
    .forEach((t) => {
      const m = t.date.slice(0, 7);
      monthlyExpense[m] = (monthlyExpense[m] || 0) + convert(t.amount, t.currencyCode || pc, pc);
    });
  const monthlyValues = Object.values(monthlyExpense);
  let consistencyScore = 80;
  if (monthlyValues.length >= 2) {
    const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
    const std = Math.sqrt(monthlyValues.reduce((a, v) => a + (v - mean) ** 2, 0) / monthlyValues.length);
    consistencyScore = Math.max(0, Math.min(100, 100 - (mean > 0 ? std / mean : 0) * 200));
  }

  let goalScore = 50;
  if (data.savingsGoals.length > 0) {
    goalScore =
      (data.savingsGoals.reduce((sum, g) => sum + Math.min(1, g.current / Math.max(1, g.target)), 0) /
        data.savingsGoals.length) *
      100;
  }

  return {
    overall: Math.round(savingsScore * 0.25 + adherenceScore * 0.25 + consistencyScore * 0.25 + goalScore * 0.25),
    savings: { score: Math.round(savingsScore), rate: savingsRate },
    adherence: { score: Math.round(adherenceScore), count: targets.length },
    consistency: { score: Math.round(consistencyScore) },
    goals: { score: Math.round(goalScore), count: data.savingsGoals.length },
  };
}
