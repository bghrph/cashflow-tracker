import { convert, getCurrency } from './currencies.js';
import { dateString, monthRange } from './dates.js';
import { formatMoney } from './format.js';

// Four notification types, priority-sorted:
//   3 danger  — over budget
//   2 warning — 80% before day 18
//   1 success — surplus available to save
//   0 recap   — weekly spending summary
export function generateNotifications(data) {
  const notes = [];
  const pc = data.primaryCurrency;
  const symbol = getCurrency(pc).symbol;
  const now = new Date();
  const day = now.getDate();
  const range = monthRange(now.getFullYear(), now.getMonth());
  const mTx = data.transactions.filter((t) => t.date >= range.start && t.date <= range.end);

  Object.entries(data.budgetTargets).forEach(([cat, cfg]) => {
    if (cfg.monthly <= 0) return;
    const spent = mTx
      .filter((t) => t.type === 'Expense' && t.category === cat)
      .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
    const pct = (spent / cfg.monthly) * 100;
    if (pct >= 80 && day < 18) {
      notes.push({
        type: 'warning',
        icon: '⚠️',
        title: `${cat} at ${Math.round(pct)}%`,
        body: `Used ${formatMoney(symbol, spent)} of ${formatMoney(symbol, cfg.monthly)} budget and only day ${day}.`,
        priority: 2,
      });
    }
    if (spent > cfg.monthly) {
      notes.push({
        type: 'danger',
        icon: '🔴',
        title: `${cat} over budget`,
        body: `Over by ${formatMoney(symbol, spent - cfg.monthly)}. Consider pausing spending.`,
        priority: 3,
      });
    }
  });

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (lastDay - day <= 7) {
    let surplus = 0;
    const cats = [];
    Object.entries(data.budgetTargets).forEach(([cat, cfg]) => {
      if (cfg.monthly <= 0 || cfg.rollover === 'accumulate') return;
      const spent = mTx
        .filter((t) => t.type === 'Expense' && t.category === cat)
        .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
      const diff = cfg.monthly - spent;
      if (diff > 10) {
        surplus += diff;
        cats.push(cat);
      }
    });
    if (surplus > 50) {
      notes.push({
        type: 'success',
        icon: '💰',
        title: `${formatMoney(symbol, surplus)} available to save`,
        body: `${cats.length} categories under budget. Move surplus to savings!`,
        priority: 1,
      });
    }
  }

  const todayStr = dateString(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekStartStr = dateString(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());
  const weekTx = data.transactions.filter(
    (t) => t.date >= weekStartStr && t.date <= todayStr && t.type === 'Expense'
  );
  if (weekTx.length > 0) {
    const total = weekTx.reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
    const byCat = {};
    weekTx.forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + convert(t.amount, t.currencyCode || pc, pc);
    });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    notes.push({
      type: 'recap',
      icon: '📋',
      title: 'Weekly Recap',
      body: `${formatMoney(symbol, total)} spent this week (${weekTx.length} txns).${
        top ? ` Top: ${top[0]} (${formatMoney(symbol, top[1])}).` : ''
      }`,
      priority: 0,
    });
  }

  return notes.sort((a, b) => b.priority - a.priority);
}
