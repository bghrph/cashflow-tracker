import { describe, it, expect } from 'vitest';
import { hashTx, dedupeAgainstLog } from '../lib/statementDedup.js';

describe('hashTx', () => {
  it('is stable on date + abs amount + first 30 chars lowercased', () => {
    expect(hashTx({ date: '2026-03-07', amount: -45, description: 'AMAZON, INC' }))
      .toBe('2026-03-07|45.00|amazon, inc');
  });
});

describe('dedupeAgainstLog', () => {
  const existing = [{ date: '2026-03-07', amount: 45, description: 'Amazon, Inc' }];

  it('skips rows already in the log', () => {
    const rows = [
      { date: '2026-03-07', amount: 45, description: 'AMAZON, INC', type: 'Expense' },
      { date: '2026-03-08', amount: 60, description: 'Grocery', type: 'Expense' },
    ];
    const { fresh, skipped } = dedupeAgainstLog(rows, existing);
    expect(skipped).toHaveLength(1);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].description).toBe('Grocery');
  });

  it('same merchant, different amount is NOT a duplicate', () => {
    const rows = [{ date: '2026-03-07', amount: 99, description: 'Amazon, Inc', type: 'Expense' }];
    expect(dedupeAgainstLog(rows, existing).fresh).toHaveLength(1);
  });

  it('flags intra-batch duplicates but keeps them', () => {
    const rows = [
      { date: '2026-03-09', amount: 5, description: 'Coffee', type: 'Expense' },
      { date: '2026-03-09', amount: 5, description: 'Coffee', type: 'Expense' },
    ];
    const { fresh } = dedupeAgainstLog(rows, []);
    expect(fresh).toHaveLength(2);
    expect(fresh[1]._intraDup).toBe(true);
  });
});
