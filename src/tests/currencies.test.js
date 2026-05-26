import { describe, it, expect } from 'vitest';
import { convert, getCurrency, CURRENCIES } from '../lib/currencies.js';

describe('currencies', () => {
  it('has 16 currencies', () => expect(CURRENCIES.length).toBe(16));
  it('returns same amount when from === to', () => expect(convert(100, 'USD', 'USD')).toBe(100));
  it('converts EUR to USD (approx)', () => {
    const r = convert(100, 'EUR', 'USD');
    expect(r).toBeCloseTo(108, 0);
  });
  it('falls back to USD when unknown code', () => {
    expect(getCurrency('XXX').code).toBe('USD');
  });
});
