import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

const { handler } = await import('../../netlify/functions/parse.js');

describe('netlify parse handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 405 for non-POST requests', async () => {
    const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when x-api-key header is missing', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/api key/i);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const res = await handler({
      httpMethod: 'POST',
      headers: { 'x-api-key': 'sk-ant-test' },
      body: 'not-json',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when text field is missing', async () => {
    const res = await handler({
      httpMethod: 'POST',
      headers: { 'x-api-key': 'sk-ant-test' },
      body: JSON.stringify({ systemPrompt: 'parse this' }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/text/i);
  });

  it('returns 200 with content when Anthropic call succeeds', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '{"transactions":[],"warnings":[]}' }],
    });
    const res = await handler({
      httpMethod: 'POST',
      headers: { 'x-api-key': 'sk-ant-test' },
      body: JSON.stringify({ text: 'coffee $5', systemPrompt: 'parse this' }),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).content).toBe('{"transactions":[],"warnings":[]}');
  });

  it('returns 401 when Anthropic returns 401', async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error('unauthorized'), { status: 401 })
    );
    const res = await handler({
      httpMethod: 'POST',
      headers: { 'x-api-key': 'sk-ant-bad' },
      body: JSON.stringify({ text: 'coffee $5', systemPrompt: 'parse' }),
    });
    expect(res.statusCode).toBe(401);
  });
});
