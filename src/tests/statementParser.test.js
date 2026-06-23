import { describe, it, expect } from 'vitest';
import {
  detectDelimiter, parseDelimitedLine, normalizeAmount, normalizeDate, parseStatement,
} from '../lib/statementParser.js';

describe('normalizeAmount', () => {
  it('strips $ and commas', () => expect(normalizeAmount('$1,234.56')).toBe(1234.56));
  it('parentheses mean negative', () => expect(normalizeAmount('(45.00)')).toBe(-45));
  it('leading minus is negative', () => expect(normalizeAmount('-45.00')).toBe(-45));
  it('blank is null', () => expect(normalizeAmount('')).toBe(null));
  it('dollar outside parens is negative', () => expect(normalizeAmount('$(45.00)')).toBe(-45));
  it('rejects malformed multi-dot amounts', () => expect(normalizeAmount('1.2.3')).toBe(null));
});

describe('normalizeDate', () => {
  it('MM/DD/YYYY', () => expect(normalizeDate('03/07/2026')).toBe('2026-03-07'));
  it('YYYY-MM-DD passthrough', () => expect(normalizeDate('2026-03-07')).toBe('2026-03-07'));
  it('DD-MMM-YYYY', () => expect(normalizeDate('05-Jan-2026')).toBe('2026-01-05'));
  it('M/D/YY', () => expect(normalizeDate('3/7/26')).toBe('2026-03-07'));
  it('garbage is null', () => expect(normalizeDate('not a date')).toBe(null));
});

describe('parseDelimitedLine', () => {
  it('respects quotes around commas', () =>
    expect(parseDelimitedLine('2026-03-07,"AMAZON, INC",45.00', ',')).toEqual(['2026-03-07', 'AMAZON, INC', '45.00']));
  it('handles escaped quotes', () =>
    expect(parseDelimitedLine('"a ""b"" c",1', ',')).toEqual(['a "b" c', '1']));
});

describe('detectDelimiter', () => {
  it('detects tab', () => expect(detectDelimiter('a\tb\tc')).toBe('\t'));
  it('detects semicolon', () => expect(detectDelimiter('a;b;c')).toBe(';'));
  it('defaults to comma', () => expect(detectDelimiter('a,b,c')).toBe(','));
  it('ignores delimiters inside quoted fields', () => expect(detectDelimiter('"a,b,c"\t"d,e"')).toBe('\t'));
});

describe('parseStatement', () => {
  it('parses a headered comma CSV and assigns type by sign', () => {
    const csv = 'Date,Description,Amount\n03/07/2026,"AMAZON, INC",-45.00\n03/08/2026,Paycheck,2000.00';
    const r = parseStatement(csv);
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([
      { date: '2026-03-07', description: 'AMAZON, INC', amount: 45, type: 'Expense' },
      { date: '2026-03-08', description: 'Paycheck', amount: 2000, type: 'Income' },
    ]);
  });

  it('skips junk metadata rows above the header', () => {
    const csv = 'Account 123\nGenerated 2026\nDate,Description,Amount\n03/07/2026,Coffee,-5.00';
    const r = parseStatement(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].description).toBe('Coffee');
  });

  it('strips BOM and skips blank/zero rows', () => {
    const csv = '﻿Date,Description,Amount\n03/07/2026,Coffee,-5.00\n\n03/09/2026,Nothing,0.00';
    const r = parseStatement(csv);
    expect(r.rows).toHaveLength(1);
  });

  it('supports separate debit/credit columns', () => {
    const csv = 'Date,Description,Debit,Credit\n03/07/2026,Rent,1500.00,\n03/08/2026,Refund,,20.00';
    const r = parseStatement(csv);
    expect(r.rows).toEqual([
      { date: '2026-03-07', description: 'Rent', amount: 1500, type: 'Expense' },
      { date: '2026-03-08', description: 'Refund', amount: 20, type: 'Income' },
    ]);
  });

  it('handles a headerless file positionally', () => {
    const csv = '03/07/2026,Coffee Shop,-5.00\n03/08/2026,Grocery Mart,-60.00';
    const r = parseStatement(csv);
    expect(r.ok).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].description).toBe('Coffee Shop');
  });

  it('reports empty input', () => {
    expect(parseStatement('   ').ok).toBe(false);
    expect(parseStatement('   ').error).toBe('empty');
  });
});
