import { describe, it, expect } from 'vitest';
import { normalizeMerchant, lookup, remember } from '../lib/merchantMemory.js';

describe('normalizeMerchant', () => {
  it('keeps genuinely different merchants distinct', () => {
    expect(normalizeMerchant('AMZN*PRIME')).not.toBe(normalizeMerchant('AMAZON.COM'));
  });
  it('collapses a merchant across different trailing store/transaction numbers', () => {
    expect(normalizeMerchant('Amazon Mktp US 2')).toBe(normalizeMerchant('AMAZON MKTP US 5'));
    expect(normalizeMerchant('STARBUCKS #123')).toBe(normalizeMerchant('STARBUCKS #999'));
  });
  it('uppercases and strips punctuation, spaces, and trailing numbers', () => {
    expect(normalizeMerchant('Star-bucks #123')).toBe('STARBUCKS');
  });
  it('caps at 25 chars', () => {
    expect(normalizeMerchant('A'.repeat(40)).length).toBe(25);
  });
});

describe('lookup / remember', () => {
  it('returns null on a miss', () => expect(lookup({}, 'Starbucks')).toBe(null));
  it('remembers then looks up', () => {
    const m = remember({}, 'Starbucks #123', 'Food & Dining');
    expect(lookup(m, 'STARBUCKS #999')).toBe('Food & Dining');
  });
  it('is immutable', () => {
    const m0 = {};
    remember(m0, 'X', 'Y');
    expect(m0).toEqual({});
  });
});
