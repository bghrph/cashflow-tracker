import { describe, it, expect } from 'vitest';
import {
  parseTransactions,
  extractAmount,
  extractDateFromSeg,
  classifyType,
  splitInput,
} from '../engine/NLPParser.js';
import { DEFAULT_STATE } from '../lib/migrate.js';

const data = { ...DEFAULT_STATE };

describe('extractAmount', () => {
  it('parses dollar with sign', () => expect(extractAmount('paid $50')).toBe(50));
  it('parses 5k', () => expect(extractAmount('salary 5k')).toBe(5000));
  it('parses comma-separated thousands', () => expect(extractAmount('rent 1,500')).toBe(1500));
  it('parses word numbers', () => expect(extractAmount('two thousand')).toBe(2000));
  it('returns 0 when no amount', () => expect(extractAmount('uber ride home')).toBe(0));
  it('parses decimal', () => expect(extractAmount('coffee 4.75')).toBe(4.75));
});

describe('classifyType', () => {
  it('classifies salary as income', () => expect(classifyType('got my salary')).toBe('Income'));
  it('classifies rent as expense', () => expect(classifyType('paid rent')).toBe('Expense'));
  it('defaults ambiguous to Expense', () => expect(classifyType('something 50')).toBe('Expense'));
});

describe('splitInput', () => {
  it('splits on comma', () => expect(splitInput('a, b, c').length).toBe(3));
  it('splits on " and "', () => expect(splitInput('a and b').length).toBe(2));
  it('preserves commas in numbers', () =>
    expect(splitInput('rent 1,500, groceries 80')).toEqual(['rent 1,500', 'groceries 80']));
});

describe('extractDateFromSeg', () => {
  it('detects today by default', () => {
    const r = extractDateFromSeg('uber 20');
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('detects yesterday', () => {
    const r = extractDateFromSeg('coffee 5 yesterday');
    expect(r.matched).toContain('yesterday');
  });
  it('detects "3 days ago"', () => {
    const r = extractDateFromSeg('groceries 80 3 days ago');
    expect(r.matched).toMatch(/days ago/);
  });
});

describe('parseTransactions', () => {
  it('parses 2 simple txns', () => {
    const { results } = parseTransactions('Salary 5000, rent 1500', data);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('Income');
    expect(results[0].amount).toBe(5000);
    expect(results[1].type).toBe('Expense');
    expect(results[1].amount).toBe(1500);
  });

  it('warns on missing amount', () => {
    const { warnings } = parseTransactions('uber ride home', data);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('respects existing categories', () => {
    const { results } = parseTransactions('groceries 80', data);
    expect(results[0].category).toBe('Groceries');
    expect(results[0].isNew).toBe(false);
  });

  it('handles k suffix', () => {
    const { results } = parseTransactions('salary 5k', data);
    expect(results[0].amount).toBe(5000);
  });
});
