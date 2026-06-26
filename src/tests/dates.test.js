import { describe, it, expect } from 'vitest';
import { pad, dateString, monthRange, formatShortDate } from '../lib/dates.js';

describe('pad', () => {
  it('zero-pads single digits to two chars', () => expect(pad(3)).toBe('03'));
  it('leaves two-digit numbers untouched', () => expect(pad(12)).toBe('12'));
});

describe('dateString', () => {
  it('builds an ISO date string with a 1-based month', () => {
    // monthIndex 0 === January
    expect(dateString(2026, 0, 5)).toBe('2026-01-05');
  });
  it('pads both month and day', () => {
    expect(dateString(2026, 8, 9)).toBe('2026-09-09');
  });
});

describe('monthRange', () => {
  it('spans the first to last day of a 31-day month', () => {
    expect(monthRange(2026, 0)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });
  it('returns 28 days for a non-leap February', () => {
    expect(monthRange(2025, 1).end).toBe('2025-02-28');
  });
  it('returns 29 days for a leap February', () => {
    expect(monthRange(2024, 1).end).toBe('2024-02-29');
  });
  it('returns 30 days for April', () => {
    expect(monthRange(2026, 3).end).toBe('2026-04-30');
  });
});

describe('formatShortDate', () => {
  it('renders a short month name and unpadded day', () => {
    expect(formatShortDate('2026-01-05')).toBe('Jan 5');
  });
  it('handles December correctly (month index math)', () => {
    expect(formatShortDate('2026-12-25')).toBe('Dec 25');
  });
});
