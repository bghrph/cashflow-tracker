import { describe, it, expect } from 'vitest';
import { detectRecurring } from '../lib/recurring.js';

const tx = (date, amount, category = 'Subscriptions') => ({
  date,
  amount,
  category,
  type: 'Expense',
});

describe('detectRecurring', () => {
  it('ignores categories with fewer than two transactions', () => {
    expect(detectRecurring([tx('2026-01-01', 10)], 'USD')).toEqual([]);
  });

  it('detects a ~monthly cadence with low interval variance', () => {
    const out = detectRecurring(
      [tx('2026-01-01', 10), tx('2026-01-31', 10), tx('2026-03-02', 10), tx('2026-04-01', 10)],
      'USD'
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('Subscriptions');
    expect(out[0].avgInterval).toBe(30);
    expect(out[0].avgAmount).toBe(10);
    expect(out[0].occurrences).toBe(4);
    expect(out[0].confidence).toBe(100); // std 0 → full confidence
  });

  it('rejects intervals that are too short to be monthly', () => {
    // ~weekly spacing (7 days) falls below the 20-day floor
    const out = detectRecurring(
      [tx('2026-01-01', 5), tx('2026-01-08', 5), tx('2026-01-15', 5)],
      'USD'
    );
    expect(out).toEqual([]);
  });

  it('rejects irregular spacing even when the average lands in range', () => {
    // intervals 5 and 55 → avg 30 but std 25 (> 10) → not recurring
    const out = detectRecurring(
      [tx('2026-01-01', 5), tx('2026-01-06', 5), tx('2026-03-02', 5)],
      'USD'
    );
    expect(out).toEqual([]);
  });

  it('predicts the next occurrence one interval after the last transaction', () => {
    const [r] = detectRecurring(
      [tx('2026-01-01', 10), tx('2026-01-31', 10), tx('2026-03-02', 10)],
      'USD'
    );
    expect(r.nextDate.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  it('converts amounts to the primary currency when averaging', () => {
    const [r] = detectRecurring(
      [
        tx('2026-01-01', 100),
        tx('2026-01-31', 100),
        tx('2026-03-02', 100),
      ].map((t) => ({ ...t, currencyCode: 'EUR' })),
      'USD'
    );
    expect(r.avgAmount).toBeCloseTo(108, 5); // 100 EUR ≈ 108 USD
  });

  it('sorts results by descending confidence', () => {
    const tight = [
      tx('2026-01-01', 10, 'A'),
      tx('2026-01-31', 10, 'A'),
      tx('2026-03-02', 10, 'A'),
    ];
    // looser but still within thresholds: intervals 25 and 35 → std 5
    const loose = [
      tx('2026-01-01', 10, 'B'),
      tx('2026-01-26', 10, 'B'),
      tx('2026-03-02', 10, 'B'),
    ];
    const out = detectRecurring([...tight, ...loose], 'USD');
    expect(out).toHaveLength(2);
    expect(out[0].confidence).toBeGreaterThanOrEqual(out[1].confidence);
  });
});
