import { describe, it, expect } from 'vitest';
import { buildCategorizationSystemPrompt, buildBatchText } from '../engine/categorizationPrompt.js';

const cats = { income: ['Salary', 'Other Income'], expense: ['Groceries', 'Other Expense'] };

describe('buildCategorizationSystemPrompt', () => {
  const p = buildCategorizationSystemPrompt(cats);
  it('ends with the exact JSON-only instruction', () => {
    expect(p.trim().endsWith('Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation.')).toBe(true);
  });
  it('embeds the user category list (not a hardcoded list)', () => {
    expect(p).toContain('Groceries');
    expect(p).toContain('Salary');
  });
  it('states the Unknown-merchant rule', () => {
    expect(p).toMatch(/Unknown/);
    expect(p).toMatch(/[Nn]ever invent/);
  });
  it('requires confidence and needsReview fields', () => {
    expect(p).toContain('confidence');
    expect(p).toContain('needsReview');
  });
});

describe('buildBatchText', () => {
  it('numbers rows from 0 with description, amount, type', () => {
    const t = buildBatchText([{ description: 'Coffee', amount: 5, type: 'Expense' }]);
    expect(t).toBe('0. Coffee | amount 5 | Expense');
  });
});
