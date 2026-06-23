import { flattenCategories } from '../lib/categories.js';
import { buildCategorizationSystemPrompt, buildBatchText } from './categorizationPrompt.js';

const BATCH_SIZE = 12;
const stripFences = (s) => s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CategorizeError extends Error {
  constructor(message, status) { super(message); this.name = 'CategorizeError'; this.status = status; }
}

const fallbackCat = (row) => (row.type === 'Income' ? 'Other Income' : 'Other Expense');

async function callBatch(text, system, apiKey) {
  const res = await fetch('/.netlify/functions/parse', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ text, systemPrompt: system }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { detail = res.statusText; }
    throw new CategorizeError(detail || `HTTP ${res.status}`, res.status);
  }
  const j = await res.json();
  const raw = typeof j.content === 'string' ? j.content : JSON.stringify(j);
  return JSON.parse(stripFences(raw));
}

export async function categorize(rows, data, apiKey, onProgress) {
  const categories = {
    income: flattenCategories(data.incomeGroups),
    expense: flattenCategories(data.expenseGroups),
  };
  const system = buildCategorizationSystemPrompt(categories);
  const out = rows.map((r) => ({ ...r }));
  const total = Math.max(1, Math.ceil(rows.length / BATCH_SIZE));

  for (let b = 0; b < total; b++) {
    const start = b * BATCH_SIZE;
    const batch = rows.slice(start, start + BATCH_SIZE);
    const text = buildBatchText(batch);
    let parsed = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
      try {
        parsed = await callBatch(text, system, apiKey);
      } catch (err) {
        if (err.status === 401) throw err;            // hard stop → UI key gate
        if (err.status === 429) { await sleep(1500 * (attempt + 1)); continue; } // back off + retry
        parsed = null;                                // malformed/network → retry once, else fallback
      }
    }
    batch.forEach((row, idx) => {
      const oi = start + idx;
      const ai = Array.isArray(parsed) ? parsed.find((p) => Number(p.i) === idx) : null;
      if (ai) {
        out[oi] = {
          ...out[oi],
          category: ai.category || fallbackCat(row),
          type: ai.type === 'Income' ? 'Income' : 'Expense',
          merchant: ai.merchant || 'Unknown',
          confidence: ai.confidence || 'low',
          needsReview: ai.needsReview === true || ai.confidence === 'low',
        };
      } else {
        out[oi] = { ...out[oi], category: fallbackCat(row), merchant: 'Unknown', confidence: 'low', needsReview: true };
      }
    });
    if (onProgress) onProgress({ done: b + 1, total });
  }
  return out;
}
