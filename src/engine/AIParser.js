// Client-side AI parser. Calls the Vite dev-server proxy at /api/parse so the
// Anthropic API key never enters the browser bundle.

import { flattenCategories } from '../lib/categories.js';
import { dateString } from '../lib/dates.js';

export class AIParserError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AIParserError';
    this.status = status;
  }
}

export async function aiParse(text, data) {
  const today = (() => {
    const d = new Date();
    return dateString(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  const categories = {
    income: flattenCategories(data.incomeGroups),
    expense: flattenCategories(data.expenseGroups),
  };

  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      today,
      primaryCurrency: data.primaryCurrency,
      categories,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const j = await response.json();
      detail = j.error || '';
    } catch {
      detail = response.statusText;
    }
    throw new AIParserError(detail || `HTTP ${response.status}`, response.status);
  }

  const json = await response.json();
  const existingIncome = new Set(categories.income);
  const existingExpense = new Set(categories.expense);

  const results = (json.transactions || []).map((t, i) => {
    const existingSet = t.type === 'Income' ? existingIncome : existingExpense;
    return {
      _idx: i,
      type: t.type === 'Income' ? 'Income' : 'Expense',
      category: t.category || (t.type === 'Income' ? 'Other Income' : 'Other Expense'),
      amount: Number(t.amount) || 0,
      date: t.date || today,
      description: t.description || '',
      isNew: !existingSet.has(t.category),
      original: t.description || '',
      currencyCode: data.primaryCurrency,
    };
  });

  return { results, warnings: json.warnings || [] };
}

export async function isApiKeyConfigured() {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j.hasKey);
  } catch {
    return false;
  }
}
