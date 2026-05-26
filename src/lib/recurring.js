import { convert } from './currencies.js';

const DAY_MS = 86_400_000;

// Detect probable recurring expenses by interval clustering (avg interval
// between 20 and 40 days with low std deviation → looks monthly).
export function detectRecurring(transactions, primaryCurrency) {
  const byCategory = {};
  transactions
    .filter((t) => t.type === 'Expense')
    .forEach((t) => {
      (byCategory[t.category] = byCategory[t.category] || []).push(t);
    });

  const out = [];
  for (const [category, txs] of Object.entries(byCategory)) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(`${sorted[i - 1].date}T12:00:00`);
      const d2 = new Date(`${sorted[i].date}T12:00:00`);
      intervals.push(Math.round((d2 - d1) / DAY_MS));
    }
    if (!intervals.length) continue;
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const std = Math.sqrt(
      intervals.reduce((a, v) => a + (v - avgInterval) ** 2, 0) / intervals.length
    );
    if (avgInterval >= 20 && avgInterval <= 40 && std < 10) {
      const amounts = sorted.map((t) => convert(t.amount, t.currencyCode || primaryCurrency, primaryCurrency));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const last = new Date(`${sorted[sorted.length - 1].date}T12:00:00`);
      const next = new Date(last.getTime() + avgInterval * DAY_MS);
      out.push({
        category,
        avgAmount,
        avgInterval,
        confidence: Math.max(0, Math.min(100, 100 - (std / avgInterval) * 100)),
        nextDate: next,
        occurrences: sorted.length,
      });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
