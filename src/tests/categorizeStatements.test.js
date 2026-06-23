// src/tests/categorizeStatements.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorize, CategorizeError } from '../engine/categorizeStatements.js';

const data = {
  incomeGroups: [{ name: 'Income', categories: ['Salary', 'Other Income'] }],
  expenseGroups: [{ name: 'Spending', categories: ['Groceries', 'Other Expense'] }],
};
const rows = [
  { date: '2026-03-07', description: 'Whole Foods', amount: 60, type: 'Expense' },
  { date: '2026-03-08', description: 'ACME Payroll', amount: 2000, type: 'Income' },
];

function mockFetchOnce(content) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ content }) }));
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('categorize', () => {
  it('applies AI categories and reports progress', async () => {
    global.fetch = mockFetchOnce(JSON.stringify([
      { i: 0, merchant: 'Whole Foods', category: 'Groceries', type: 'Expense', confidence: 'high', needsReview: false },
      { i: 1, merchant: 'ACME Payroll', category: 'Salary', type: 'Income', confidence: 'high', needsReview: false },
    ]));
    const progress = [];
    const out = await categorize(rows, data, 'sk-ant-x', (p) => progress.push(p));
    expect(out[0].category).toBe('Groceries');
    expect(out[1].category).toBe('Salary');
    expect(progress.at(-1)).toEqual({ done: 1, total: 1 });
  });

  it('strips markdown fences before parsing', async () => {
    global.fetch = mockFetchOnce('```json\n[{"i":0,"merchant":"WF","category":"Groceries","type":"Expense","confidence":"high","needsReview":false},{"i":1,"merchant":"P","category":"Salary","type":"Income","confidence":"high","needsReview":false}]\n```');
    const out = await categorize(rows, data, 'sk-ant-x');
    expect(out[0].category).toBe('Groceries');
  });

  it('retries once then falls back to Other + needsReview on malformed JSON', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ content: 'not json' }) }));
    const out = await categorize(rows, data, 'sk-ant-x');
    expect(global.fetch).toHaveBeenCalledTimes(2); // one batch, retried once
    expect(out[0]).toMatchObject({ category: 'Other Expense', needsReview: true });
    expect(out[1]).toMatchObject({ category: 'Other Income', needsReview: true });
  });

  it('throws CategorizeError(401) so the UI can show the key gate', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'key rejected' }) }));
    await expect(categorize(rows, data, 'sk-ant-x')).rejects.toBeInstanceOf(CategorizeError);
    await expect(categorize(rows, data, 'sk-ant-x')).rejects.toMatchObject({ status: 401 });
  });
});
