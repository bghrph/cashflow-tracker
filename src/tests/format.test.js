import { describe, it, expect } from 'vitest';
import { formatMoney, formatCompactMoney } from '../lib/format.js';

describe('formatMoney', () => {
  it('formats a positive amount with two decimals and thousands separators', () => {
    expect(formatMoney('$', 1234.5)).toBe('$1,234.50');
  });
  it('uses a Unicode minus sign (U+2212) for negatives, before the symbol', () => {
    expect(formatMoney('$', -12.3)).toBe('−$12.30');
  });
  it('treats zero as non-negative (no minus sign)', () => {
    expect(formatMoney('$', 0)).toBe('$0.00');
  });
  it('coerces non-numeric input to 0', () => {
    expect(formatMoney('$', undefined)).toBe('$0.00');
    expect(formatMoney('$', 'abc')).toBe('$0.00');
  });
  it('respects an arbitrary currency symbol', () => {
    expect(formatMoney('€', 5)).toBe('€5.00');
  });
});

describe('formatCompactMoney', () => {
  it('renders millions with an M suffix and one decimal', () => {
    expect(formatCompactMoney('$', 2_500_000)).toBe('$2.5M');
  });
  it('renders thousands with a k suffix and one decimal', () => {
    expect(formatCompactMoney('$', 1_500)).toBe('$1.5k');
  });
  it('renders sub-thousand amounts with two decimals', () => {
    expect(formatCompactMoney('$', 999.9)).toBe('$999.90');
  });
  it('applies the Unicode minus sign to negative compact values', () => {
    expect(formatCompactMoney('$', -2_000)).toBe('−$2.0k');
  });
  it('uses the exact 1,000 / 1,000,000 boundaries', () => {
    expect(formatCompactMoney('$', 1_000)).toBe('$1.0k');
    expect(formatCompactMoney('$', 1_000_000)).toBe('$1.0M');
  });
});
