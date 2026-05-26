import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hybridParse } from '../engine/HybridParser.js';
import { DEFAULT_STATE } from '../lib/migrate.js';

const baseData = { ...DEFAULT_STATE };

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('HybridParser', () => {
  it('uses local only when preference=local', async () => {
    const r = await hybridParse('Salary 5000', baseData, { preference: 'local', apiKey: 'sk-ant-test' });
    expect(r.results[0].source).toBe('local');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls through to local when no API key', async () => {
    const r = await hybridParse('Salary 5000', baseData, { preference: 'always', apiKey: '' });
    expect(r.results[0].source).toBe('local');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses local fast-path when local is confident in fallback mode', async () => {
    const r = await hybridParse('Salary 5000, rent 1500', baseData, {
      preference: 'fallback',
      apiKey: 'sk-ant-test',
    });
    expect(r.results.every((x) => x.source === 'local')).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls AI when local has warnings in fallback mode', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: JSON.stringify({
          transactions: [
            { type: 'Expense', category: 'Maintenance', amount: 350, date: '2026-05-24', description: 'AC repair' },
          ],
          warnings: [],
        }),
      }),
    });
    const r = await hybridParse('Paid Ahmed for fixing the AC unit', baseData, {
      preference: 'fallback',
      apiKey: 'sk-ant-test',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/parse',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }),
      })
    );
    expect(r.results[0].source).toBe('ai');
    expect(r.results[0].amount).toBe(350);
  });

  it('falls back to local when AI throws', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'boom' }),
    });
    const r = await hybridParse('Paid Ahmed for fixing the AC unit 350', baseData, {
      preference: 'always',
      apiKey: 'sk-ant-test',
    });
    expect(r.results[0].source).toBe('local');
    expect(r.warnings.some((w) => w.includes('AI'))).toBe(true);
  });
});
