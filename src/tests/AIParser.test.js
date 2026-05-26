import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiParse, isApiKeyConfigured, AIParserError } from '../engine/AIParser.js';

// ---------------------------------------------------------------------------
// isApiKeyConfigured — synchronous validation
// ---------------------------------------------------------------------------
describe('isApiKeyConfigured', () => {
  it('returns false for null', () => {
    expect(isApiKeyConfigured(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isApiKeyConfigured('')).toBe(false);
  });

  it('returns false for a string that does not start with sk-ant-', () => {
    expect(isApiKeyConfigured('not-a-key')).toBe(false);
  });

  it('returns true for a string that starts with sk-ant-', () => {
    expect(isApiKeyConfigured('sk-ant-valid')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aiParse — fetch-based integration
// ---------------------------------------------------------------------------
describe('aiParse', () => {
  const API_KEY = 'sk-ant-test-key';

  // Minimal data shape expected by aiParse
  const data = {
    primaryCurrency: 'USD',
    incomeGroups: [{ categories: ['Salary', 'Rental Income'] }],
    expenseGroups: [{ categories: ['Groceries', 'Dining Out'] }],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('success path: calls /.netlify/functions/parse with correct URL, x-api-key header, and returns shaped results', async () => {
    const mockTransactions = [
      { type: 'Expense', category: 'Dining Out', amount: 45, date: '2026-05-25', description: 'dinner' },
    ];

    // The Netlify function wraps its response as { content: '<JSON string>' }
    const netlifyResponse = { content: JSON.stringify({ transactions: mockTransactions, warnings: [] }) };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => netlifyResponse,
    });

    const { results, warnings } = await aiParse('dinner $45', data, API_KEY);

    // Verify fetch was called with the Netlify endpoint
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/parse');

    // Verify x-api-key header
    expect(init.headers['x-api-key']).toBe(API_KEY);
    expect(init.headers['content-type']).toBe('application/json');

    // Verify body contains text and systemPrompt (not raw category data)
    const body = JSON.parse(init.body);
    expect(body.text).toBe('dinner $45');
    expect(typeof body.systemPrompt).toBe('string');
    expect(body.systemPrompt.length).toBeGreaterThan(0);
    // Should NOT contain the old flat keys
    expect(body).not.toHaveProperty('today');
    expect(body).not.toHaveProperty('primaryCurrency');
    expect(body).not.toHaveProperty('categories');

    // Verify returned results are correctly shaped
    expect(warnings).toEqual([]);
    expect(results).toHaveLength(1);
    const [r] = results;
    expect(r._idx).toBe(0);
    expect(r.type).toBe('Expense');
    expect(r.category).toBe('Dining Out');
    expect(r.amount).toBe(45);
    expect(r.description).toBe('dinner');
    expect(r.currencyCode).toBe('USD');
    // 'Dining Out' exists in expenseGroups so isNew should be false
    expect(r.isNew).toBe(false);
  });

  it('error path: throws AIParserError with status 401 when fetch returns 401', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid API key' }),
    });

    await expect(aiParse('coffee $5', data, 'sk-ant-bad')).rejects.toMatchObject({
      name: 'AIParserError',
      status: 401,
      message: 'Invalid API key',
    });
  });

  it('error path: AIParserError is instanceof AIParserError', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    try {
      await aiParse('coffee $5', data, 'sk-ant-bad');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AIParserError);
      expect(err.status).toBe(401);
    }
  });
});
