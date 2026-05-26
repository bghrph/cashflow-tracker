// Client-side AI parser. Calls the Netlify function at /.netlify/functions/parse,
// forwarding the user's own Anthropic API key via the x-api-key header. The
// system prompt (with categories, date, and currency) is built client-side by
// promptTemplate.js and sent alongside the raw text so the Netlify function only
// needs to relay both fields to the Anthropic API.

import { flattenCategories } from '../lib/categories.js';
import { dateString } from '../lib/dates.js';
import { buildSystemPrompt } from './promptTemplate.js';

export class AIParserError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AIParserError';
    this.status = status;
  }
}

export async function aiParse(text, data, apiKey) {
  const today = (() => {
    const d = new Date();
    return dateString(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  const categories = {
    income: flattenCategories(data.incomeGroups),
    expense: flattenCategories(data.expenseGroups),
  };

  const systemPrompt = buildSystemPrompt({ categories, today, primaryCurrency: data.primaryCurrency });

  const response = await fetch('/.netlify/functions/parse', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ text, systemPrompt }),
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
  // The Netlify function returns { content: '<raw JSON string>' }; parse it.
  const parsed = typeof json.content === 'string' ? JSON.parse(json.content) : json;

  const existingIncome = new Set(categories.income);
  const existingExpense = new Set(categories.expense);

  const results = (parsed.transactions || []).map((t, i) => {
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

  return { results, warnings: parsed.warnings || [] };
}

export function isApiKeyConfigured(apiKey) {
  return Boolean(apiKey && apiKey.startsWith('sk-ant-'));
}
