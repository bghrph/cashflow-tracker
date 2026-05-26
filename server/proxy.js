// Vite dev-server middleware that forwards parse requests to the Anthropic API.
// The Anthropic API key is read from process.env and NEVER reaches the client.
//
// Contract:
//   POST /api/parse
//     body: { text, today: 'YYYY-MM-DD', primaryCurrency: 'USD', categories: { income: [...], expense: [...] } }
//     200: { transactions: [...], warnings: [...] }
//     400: { error }
//     429: { error: 'rate limited' }
//     503: { error: 'API key not configured' }

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, STATIC_PROMPT_PREFIX } from '../src/engine/promptTemplate.js';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_BODY_BYTES = 32 * 1024; // 32 KB upper bound on input text payload

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isoToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function stripCodeFences(text) {
  // Be defensive — the prompt forbids markdown, but Claude sometimes wraps anyway.
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function validatePayload(json) {
  if (!json || typeof json !== 'object') return { error: 'Response was not an object' };
  if (!Array.isArray(json.transactions)) return { error: 'transactions[] missing' };
  const warnings = Array.isArray(json.warnings) ? json.warnings : [];
  const transactions = json.transactions
    .map((t) => {
      if (!t || typeof t !== 'object') return null;
      const type = t.type === 'Income' ? 'Income' : 'Expense';
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        type,
        category: typeof t.category === 'string' && t.category ? t.category : 'Other',
        amount: Number(amount.toFixed(2)),
        date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : isoToday(),
        description: typeof t.description === 'string' ? t.description : '',
      };
    })
    .filter(Boolean);
  return { transactions, warnings };
}

export function createParseHandler({ apiKey, model = DEFAULT_MODEL }) {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  return async function handle(req, res) {
    res.setHeader('content-type', 'application/json');

    if (!client) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'API key not configured. Set ANTHROPIC_API_KEY in .env and restart the dev server.' }));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message || 'Invalid request body' }));
      return;
    }

    const text = (body.text || '').toString().trim();
    if (!text) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'text is required' }));
      return;
    }

    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : isoToday();
    const primaryCurrency = typeof body.primaryCurrency === 'string' ? body.primaryCurrency : 'USD';
    const categories = body.categories && typeof body.categories === 'object' ? body.categories : { income: [], expense: [] };
    const systemPrompt = buildSystemPrompt({ categories, today, primaryCurrency });

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        temperature: 0,
        // Prompt-cache the static instruction prefix. Subsequent calls in the
        // 5-min window only pay for the variable tail + user input.
        system: [
          { type: 'text', text: STATIC_PROMPT_PREFIX, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: systemPrompt.slice(STATIC_PROMPT_PREFIX.length) },
        ],
        messages: [{ role: 'user', content: text }],
      });

      const raw = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
        .trim();
      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(raw));
      } catch (e) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'AI returned non-JSON response', detail: raw.slice(0, 200) }));
        return;
      }
      const validated = validatePayload(parsed);
      if (validated.error) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: validated.error }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(validated));
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'API key rejected. Check ANTHROPIC_API_KEY.' }));
        return;
      }
      if (status === 429) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: 'Rate limit hit. Wait a moment, then retry.' }));
        return;
      }
      console.error('[proxy] Anthropic error:', err?.message || err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err?.message || 'Upstream error' }));
    }
  };
}
