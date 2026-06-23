# Statement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import Statement" wizard that turns a bank/card CSV (or pasted rows) into reviewed Log entries, categorized via merchant-memory + Claude, so bulk-adding income/expense is far faster than manual entry.

**Architecture:** Reuse the existing free-text pipeline. A new full-screen overlay parses a CSV into rows, dedupes against the Log, fills known merchants from `data.merchantMemory`, sends only unknown merchants to the existing Netlify proxy (Haiku) for categorization, then commits selected rows through `TransactionsTab.onConfirmSmart` — the existing, unchanged writer. All new logic lives in self-contained pure modules + one overlay component.

**Tech Stack:** React 18, Vite, Vitest + @testing-library/react, existing `/.netlify/functions/parse` proxy (Anthropic Haiku), Firestore (via existing `update()` write path).

## Global Constraints

Copied verbatim from the design spec (`docs/superpowers/specs/2026-06-22-statement-import-design.md`). Every task implicitly includes these:

- **Only one existing file may be edited:** `src/tabs/TransactionsTab.jsx`, via four additive edits only (lazy import, one `useState`, one header button, one overlay render). No existing function body in it may change. `onConfirmSmart` (line 139) is reused verbatim as the commit path.
- **DO NOT TOUCH (must stay byte-identical):** `netlify/functions/parse.js` (model, `max_tokens:1024`, `{text,systemPrompt}`→`{content}` contract), `src/engine/AIParser.js`, `src/engine/promptTemplate.js`, `src/components/SmartInput.jsx` (copy-patterns, not edit-targets), `src/lib/firebase.js`, `firestore.js`, `migrate.js` (+`DEFAULT_STATE`), `cacheLifecycle.js`, `dataSync.js`, `persistencePreference.js`, `src/App.jsx`, `src/components/Auth.jsx`, `src/lib/authFlow.js`, `src/components/navConfig.js` (no nav change), `src/tabs/SetupTab.jsx` (sole API-key store), `src/components/icons.jsx`, and `src/styles/*` (use existing CSS variables/classes only — no new token/class/global rule).
- **No new npm dependencies.**
- **Transaction shape is fixed:** `{ id, date, type, category, currencyCode, amount, description }`. New persisted state `merchantMemory` is read defensively as `data.merchantMemory || {}` (no `migrate.js` change).
- **2000-entry cap:** never import such that `data.transactions.length + selected > 2000`.
- **AI output instruction MUST end with the exact sentence:** `Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation.`
- **AI category list = the user's own categories** (`flattenCategories(incomeGroups)` + `flattenCategories(expenseGroups)`), never a hardcoded list.
- **AI batch size = 12** (lean output schema fits the proxy's 1024-token cap).
- **Tests are written test-first** (project norm: 92 passing tests). Run `npx vitest run <file>` per task.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/statementParser.js` | Pure parsing: BOM strip, delimiter detect, quote-aware split, amount/date normalize, header + fuzzy/positional column mapping → typed rows |
| `src/lib/statementDedup.js` | Pure: row hashing + dedupe against existing Log transactions |
| `src/lib/merchantMemory.js` | Pure: normalize merchant key, lookup/remember in a memory map |
| `src/engine/categorizationPrompt.js` | Pure: build the Claude system prompt (the 5-rule contract) + batch text |
| `src/engine/categorizeStatements.js` | Batched proxy calls, fence-strip, retry-once/fallback, 401/429 handling |
| `src/components/StatementImportOverlay.jsx` | The full-screen wizard UI (upload → analyze → review → import) |
| `src/tabs/TransactionsTab.jsx` | **(modify, additive only)** Import button + overlay render |
| `src/tests/statementParser.test.js` etc. | Unit tests per module |

---

### Task 1: statementParser.js — pure CSV parsing & column mapping

**Files:**
- Create: `src/lib/statementParser.js`
- Test: `src/tests/statementParser.test.js`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `stripBom(text: string): string`
  - `detectDelimiter(line: string): ',' | '\t' | ';'`
  - `parseDelimitedLine(line: string, delim: string): string[]`
  - `normalizeAmount(raw): number | null` — `$`/commas stripped, `(x)` and `-x` → negative
  - `normalizeDate(raw): string | null` — `YYYY-MM-DD` or null; accepts `MM/DD/YYYY`, `YYYY-MM-DD`, `DD-MMM-YYYY`, `M/D/YY`
  - `mapColumns(header: string[]): { date, description, amount, debit, credit }` (indices, `-1` if absent)
  - `parseStatement(text: string): { ok, rows?, columns?, error?, needsManualMap?, sampleColumns? }` where each `row = { date, description, amount, type }` (`type` ∈ `'Income'|'Expense'`, `amount` positive)

- [ ] **Step 1: Write the failing test**

```js
// src/tests/statementParser.test.js
import { describe, it, expect } from 'vitest';
import {
  detectDelimiter, parseDelimitedLine, normalizeAmount, normalizeDate, parseStatement,
} from '../lib/statementParser.js';

describe('normalizeAmount', () => {
  it('strips $ and commas', () => expect(normalizeAmount('$1,234.56')).toBe(1234.56));
  it('parentheses mean negative', () => expect(normalizeAmount('(45.00)')).toBe(-45));
  it('leading minus is negative', () => expect(normalizeAmount('-45.00')).toBe(-45));
  it('blank is null', () => expect(normalizeAmount('')).toBe(null));
});

describe('normalizeDate', () => {
  it('MM/DD/YYYY', () => expect(normalizeDate('03/07/2026')).toBe('2026-03-07'));
  it('YYYY-MM-DD passthrough', () => expect(normalizeDate('2026-03-07')).toBe('2026-03-07'));
  it('DD-MMM-YYYY', () => expect(normalizeDate('05-Jan-2026')).toBe('2026-01-05'));
  it('M/D/YY', () => expect(normalizeDate('3/7/26')).toBe('2026-03-07'));
  it('garbage is null', () => expect(normalizeDate('not a date')).toBe(null));
});

describe('parseDelimitedLine', () => {
  it('respects quotes around commas', () =>
    expect(parseDelimitedLine('2026-03-07,"AMAZON, INC",45.00', ',')).toEqual(['2026-03-07', 'AMAZON, INC', '45.00']));
  it('handles escaped quotes', () =>
    expect(parseDelimitedLine('"a ""b"" c",1', ',')).toEqual(['a "b" c', '1']));
});

describe('detectDelimiter', () => {
  it('detects tab', () => expect(detectDelimiter('a\tb\tc')).toBe('\t'));
  it('detects semicolon', () => expect(detectDelimiter('a;b;c')).toBe(';'));
  it('defaults to comma', () => expect(detectDelimiter('a,b,c')).toBe(','));
});

describe('parseStatement', () => {
  it('parses a headered comma CSV and assigns type by sign', () => {
    const csv = 'Date,Description,Amount\n03/07/2026,"AMAZON, INC",-45.00\n03/08/2026,Paycheck,2000.00';
    const r = parseStatement(csv);
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([
      { date: '2026-03-07', description: 'AMAZON, INC', amount: 45, type: 'Expense' },
      { date: '2026-03-08', description: 'Paycheck', amount: 2000, type: 'Income' },
    ]);
  });

  it('skips junk metadata rows above the header', () => {
    const csv = 'Account 123\nGenerated 2026\nDate,Description,Amount\n03/07/2026,Coffee,-5.00';
    const r = parseStatement(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].description).toBe('Coffee');
  });

  it('strips BOM and skips blank/zero rows', () => {
    const csv = '﻿Date,Description,Amount\n03/07/2026,Coffee,-5.00\n\n03/09/2026,Nothing,0.00';
    const r = parseStatement(csv);
    expect(r.rows).toHaveLength(1);
  });

  it('supports separate debit/credit columns', () => {
    const csv = 'Date,Description,Debit,Credit\n03/07/2026,Rent,1500.00,\n03/08/2026,Refund,,20.00';
    const r = parseStatement(csv);
    expect(r.rows).toEqual([
      { date: '2026-03-07', description: 'Rent', amount: 1500, type: 'Expense' },
      { date: '2026-03-08', description: 'Refund', amount: 20, type: 'Income' },
    ]);
  });

  it('handles a headerless file positionally', () => {
    const csv = '03/07/2026,Coffee Shop,-5.00\n03/08/2026,Grocery Mart,-60.00';
    const r = parseStatement(csv);
    expect(r.ok).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].description).toBe('Coffee Shop');
  });

  it('reports empty input', () => {
    expect(parseStatement('   ').ok).toBe(false);
    expect(parseStatement('   ').error).toBe('empty');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/statementParser.test.js`
Expected: FAIL — "Failed to resolve import '../lib/statementParser.js'".

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/statementParser.js
const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad2 = (n) => String(n).padStart(2, '0');

export function stripBom(text) {
  return typeof text === 'string' && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function detectDelimiter(line) {
  const counts = {
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
    ';': (line.match(/;/g) || []).length,
  };
  let best = ',', max = counts[','];
  for (const d of ['\t', ';']) if (counts[d] > max) { max = counts[d]; best = d; }
  return max > 0 ? best : ',';
}

export function parseDelimitedLine(line, delim) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

export function normalizeAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.includes('-')) neg = true;
  s = s.replace(/[^0-9.]/g, '');
  if (s === '' || s === '.') return null;
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

export function normalizeDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/))) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${pad2(m[1])}-${pad2(m[2])}`;
  }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${pad2(mo)}-${pad2(m[1])}`;
  }
  return null;
}

const RE = {
  date: /date|posted|trans/i,
  desc: /desc|name|memo|payee|detail|narrative|transaction/i,
  amount: /^amount$|amt|^value$/i,
  debit: /debit|withdrawal|charge/i,
  credit: /credit|deposit|payment/i,
};

export function mapColumns(header) {
  const find = (re, exclude = []) => header.findIndex((h, i) => !exclude.includes(i) && re.test(h));
  const date = find(RE.date);
  const amount = find(RE.amount);
  const debit = find(RE.debit);
  const credit = find(RE.credit);
  const description = find(RE.desc, [date].filter((i) => i >= 0));
  return { date, description, amount, debit, credit };
}

function hasRequired(c) {
  return c.date >= 0 && c.description >= 0 && (c.amount >= 0 || c.debit >= 0 || c.credit >= 0);
}

function buildRow(fields, c) {
  const date = normalizeDate(fields[c.date]);
  if (!date) return null;
  const description = (fields[c.description] || '').trim();
  let amount = null, type = 'Expense';
  if (c.debit >= 0 || c.credit >= 0) {
    const deb = c.debit >= 0 ? normalizeAmount(fields[c.debit]) : null;
    const cred = c.credit >= 0 ? normalizeAmount(fields[c.credit]) : null;
    if (deb && Math.abs(deb) > 0) { amount = Math.abs(deb); type = 'Expense'; }
    else if (cred && Math.abs(cred) > 0) { amount = Math.abs(cred); type = 'Income'; }
    else return null;
  } else {
    const a = normalizeAmount(fields[c.amount]);
    if (a == null || a === 0) return null;
    amount = Math.abs(a);
    type = a < 0 ? 'Expense' : 'Income';
  }
  return { date, description, amount: Number(amount.toFixed(2)), type };
}

function detectPositional(rows) {
  const sample = rows.slice(0, Math.min(rows.length, 15));
  const n = Math.max(...sample.map((r) => r.length));
  let dateCol = -1, amtCol = -1;
  for (let col = 0; col < n; col++) {
    let dOk = 0, aOk = 0, cells = 0;
    for (const r of sample) {
      if (col < r.length) {
        cells++;
        if (normalizeDate(r[col])) dOk++;
        const a = normalizeAmount(r[col]);
        if (a != null && a !== 0) aOk++;
      }
    }
    if (cells > 0) {
      if (dateCol < 0 && dOk / cells >= 0.6) dateCol = col;
      else if (amtCol < 0 && col !== dateCol && aOk / cells >= 0.6) amtCol = col;
    }
  }
  if (dateCol < 0 || amtCol < 0) return null;
  let descCol = -1, bestLen = -1;
  for (let col = 0; col < n; col++) {
    if (col === dateCol || col === amtCol) continue;
    let total = 0, cells = 0;
    for (const r of sample) {
      if (col < r.length) { cells++; total += (r[col] || '').replace(/[0-9.,$()\-]/g, '').length; }
    }
    const avg = cells ? total / cells : 0;
    if (avg > bestLen) { bestLen = avg; descCol = col; }
  }
  return { date: dateCol, description: descCol, amount: amtCol, debit: -1, credit: -1 };
}

export function parseStatement(text) {
  const clean = stripBom(typeof text === 'string' ? text : '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return { ok: false, error: 'empty' };
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { ok: false, error: 'empty' };
  const delim = detectDelimiter(lines[0]);
  const parsed = lines.map((l) => parseDelimitedLine(l, delim));

  let columns = null, dataRows = null;
  for (let i = 0; i < Math.min(parsed.length, 10); i++) {
    const c = mapColumns(parsed[i]);
    if (hasRequired(c)) { columns = c; dataRows = parsed.slice(i + 1); break; }
  }
  if (!columns) {
    const pos = detectPositional(parsed);
    if (pos) { columns = pos; dataRows = parsed; }
    else return { ok: true, needsManualMap: true, sampleColumns: parsed.slice(0, 5), delim, rawRows: parsed };
  }

  const rows = [];
  for (const f of dataRows) { const r = buildRow(f, columns); if (r) rows.push(r); }
  if (rows.length === 0) return { ok: false, error: 'no-transactions' };
  return { ok: true, rows, columns, delim };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/statementParser.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/statementParser.js src/tests/statementParser.test.js
git commit -m "feat: add statement CSV parser (delimiter/quote/amount/date/column mapping)"
```

---

### Task 2: statementDedup.js — hash + dedupe against the Log

**Files:**
- Create: `src/lib/statementDedup.js`
- Test: `src/tests/statementDedup.test.js`

**Interfaces:**
- Consumes: rows from Task 1 (`{ date, description, amount, type }`) and existing transactions (`{ date, description, amount, ... }`).
- Produces:
  - `hashTx(tx): string` — `` `${date}|${abs(amount).toFixed(2)}|${desc.slice(0,30).toLowerCase()}` ``
  - `dedupeAgainstLog(rows, existing): { fresh, skipped }` — `fresh` rows may carry `_intraDup: true`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/statementDedup.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/statementDedup.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/statementDedup.js
export function hashTx({ date, amount, description }) {
  const amt = Math.abs(Number(amount) || 0).toFixed(2);
  const desc = String(description || '').slice(0, 30).toLowerCase();
  return `${date}|${amt}|${desc}`;
}

export function dedupeAgainstLog(rows, existing) {
  const seen = new Set((existing || []).map(hashTx));
  const within = new Set();
  const fresh = [];
  const skipped = [];
  for (const r of rows) {
    const h = hashTx(r);
    if (seen.has(h)) { skipped.push(r); continue; }
    const row = within.has(h) ? { ...r, _intraDup: true } : r;
    within.add(h);
    fresh.push(row);
  }
  return { fresh, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/statementDedup.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/statementDedup.js src/tests/statementDedup.test.js
git commit -m "feat: add statement dedupe against existing log"
```

---

### Task 3: merchantMemory.js — normalize + remember merchant→category

**Files:**
- Create: `src/lib/merchantMemory.js`
- Test: `src/tests/merchantMemory.test.js`

**Interfaces:**
- Consumes: `data.merchantMemory || {}` (a plain `{ [normKey]: category }` map).
- Produces:
  - `normalizeMerchant(s): string` — uppercase, strip non-alphanumerics, first 25 chars
  - `lookup(memory, description): string | null`
  - `remember(memory, description, category): newMemoryObject` (immutable)

- [ ] **Step 1: Write the failing test**

```js
// src/tests/merchantMemory.test.js
import { describe, it, expect } from 'vitest';
import { normalizeMerchant, lookup, remember } from '../lib/merchantMemory.js';

describe('normalizeMerchant', () => {
  it('collapses Amazon variants to one key', () => {
    const a = normalizeMerchant('AMAZON.COM');
    expect(normalizeMerchant('AMZN*PRIME')).not.toBe(a); // different first chars stay distinct
    expect(normalizeMerchant('Amazon Mktp US')).toBe(normalizeMerchant('AMAZON MKTP US 2'));
  });
  it('uppercases and strips punctuation/spaces', () => {
    expect(normalizeMerchant('Star-bucks #123')).toBe('STARBUCKS123');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/merchantMemory.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/merchantMemory.js
export function normalizeMerchant(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
}

export function lookup(memory, description) {
  const k = normalizeMerchant(description);
  return k && memory && memory[k] ? memory[k] : null;
}

export function remember(memory, description, category) {
  const k = normalizeMerchant(description);
  if (!k) return memory || {};
  return { ...(memory || {}), [k]: category };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/merchantMemory.test.js`
Expected: PASS. (Note: the first test asserts the two Amazon-MKTP strings collapse because their first 25 alphanumerics match.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/merchantMemory.js src/tests/merchantMemory.test.js
git commit -m "feat: add merchant memory (normalize + lookup/remember)"
```

---

### Task 4: categorizationPrompt.js — the 5-rule Claude contract

**Files:**
- Create: `src/engine/categorizationPrompt.js`
- Test: `src/tests/categorizationPrompt.test.js`

**Interfaces:**
- Consumes: `userCategories = { income: string[], expense: string[] }`; a `batch` of rows (`{ description, amount, type }`).
- Produces:
  - `buildCategorizationSystemPrompt(userCategories): string`
  - `buildBatchText(batch): string`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/categorizationPrompt.test.js
import { describe, it, expect } from 'vitest';
import { buildCategorizationSystemPrompt, buildBatchText } from '../engine/categorizationPrompt.js';

const cats = { income: ['Salary', 'Other Income'], expense: ['Groceries', 'Other Expense'] };

describe('buildCategorizationSystemPrompt', () => {
  const p = buildCategorizationSystemPrompt(cats);
  it('ends with the exact JSON-only instruction', () => {
    expect(p.trim().endsWith('Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation.')).toBe(true);
  });
  it('embeds the user category list (not a hardcoded list)', () => {
    expect(p).toContain('Groceries');
    expect(p).toContain('Salary');
  });
  it('states the Unknown-merchant rule', () => {
    expect(p).toMatch(/Unknown/);
    expect(p).toMatch(/[Nn]ever invent/);
  });
  it('requires confidence and needsReview fields', () => {
    expect(p).toContain('confidence');
    expect(p).toContain('needsReview');
  });
});

describe('buildBatchText', () => {
  it('numbers rows from 0 with description, amount, type', () => {
    const t = buildBatchText([{ description: 'Coffee', amount: 5, type: 'Expense' }]);
    expect(t).toBe('0. Coffee | amount 5 | Expense');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/categorizationPrompt.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/engine/categorizationPrompt.js
export function buildCategorizationSystemPrompt({ income = [], expense = [] }) {
  const list = [...expense, ...income];
  return [
    'You are a bank-transaction categorizer. The user sends numbered transactions.',
    'For each, return exactly one JSON object.',
    `Choose "category" ONLY from this exact list: ${JSON.stringify(list)}.`,
    'Do not invent categories. If none fits, use "Other Expense" for spending or "Other Income" for money received, and set "needsReview": true.',
    'Set "type" to "Income" for money received, otherwise "Expense".',
    'Set "confidence" to "high", "medium", or "low". Any "low"-confidence item MUST have "needsReview": true.',
    'Set "merchant" from the description text only. If the merchant is unclear, set "merchant" to "Unknown". Never invent or guess a merchant name.',
    'Each object must have exactly these keys: i (the number you were given), merchant, category, type, confidence, needsReview.',
    'Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation.',
  ].join('\n');
}

export function buildBatchText(batch) {
  return batch.map((r, idx) => `${idx}. ${r.description} | amount ${r.amount} | ${r.type}`).join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/categorizationPrompt.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/categorizationPrompt.js src/tests/categorizationPrompt.test.js
git commit -m "feat: add AI categorization prompt contract (JSON-only, user categories, confidence, needsReview, no hallucinated merchants)"
```

---

### Task 5: categorizeStatements.js — batched proxy calls with recovery

**Files:**
- Create: `src/engine/categorizeStatements.js`
- Test: `src/tests/categorizeStatements.test.js`

**Interfaces:**
- Consumes: `rows` (`{ date, description, amount, type }[]`), `data` (for `incomeGroups`/`expenseGroups` via `flattenCategories`), `apiKey`, optional `onProgress({ done, total })`. Uses `buildCategorizationSystemPrompt`/`buildBatchText` (Task 4) and the existing `/.netlify/functions/parse` proxy.
- Produces:
  - `categorize(rows, data, apiKey, onProgress): Promise<resultRows[]>` where each result adds `{ category, type, merchant, confidence, needsReview }`
  - `class CategorizeError extends Error { status }`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/categorizeStatements.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorize, CategorizeError } from '../engine/categorizeStatements.js';

const data = {
  incomeGroups: [{ name: 'Income', categories: ['Salary', 'Other Income'] }],
  expenseGroups: [{ name: 'Spending', categories: ['Groceries', 'Other Expense'] }],
};
const rows = [
  { date: '2026-03-07', description: 'Whole Foods', amount: 60, type: 'Expense' },
  { date: '2026-03-08', description: 'ACME Payroll', amount: 2000, type: 'Income' },
];

function mockFetchOnce(content) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ content }) }));
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('categorize', () => {
  it('applies AI categories and reports progress', async () => {
    global.fetch = mockFetchOnce(JSON.stringify([
      { i: 0, merchant: 'Whole Foods', category: 'Groceries', type: 'Expense', confidence: 'high', needsReview: false },
      { i: 1, merchant: 'ACME Payroll', category: 'Salary', type: 'Income', confidence: 'high', needsReview: false },
    ]));
    const progress = [];
    const out = await categorize(rows, data, 'sk-ant-x', (p) => progress.push(p));
    expect(out[0].category).toBe('Groceries');
    expect(out[1].category).toBe('Salary');
    expect(progress.at(-1)).toEqual({ done: 1, total: 1 });
  });

  it('strips markdown fences before parsing', async () => {
    global.fetch = mockFetchOnce('```json\n[{"i":0,"merchant":"WF","category":"Groceries","type":"Expense","confidence":"high","needsReview":false},{"i":1,"merchant":"P","category":"Salary","type":"Income","confidence":"high","needsReview":false}]\n```');
    const out = await categorize(rows, data, 'sk-ant-x');
    expect(out[0].category).toBe('Groceries');
  });

  it('retries once then falls back to Other + needsReview on malformed JSON', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ content: 'not json' }) }));
    const out = await categorize(rows, data, 'sk-ant-x');
    expect(global.fetch).toHaveBeenCalledTimes(2); // one batch, retried once
    expect(out[0]).toMatchObject({ category: 'Other Expense', needsReview: true });
    expect(out[1]).toMatchObject({ category: 'Other Income', needsReview: true });
  });

  it('throws CategorizeError(401) so the UI can show the key gate', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'key rejected' }) }));
    await expect(categorize(rows, data, 'sk-ant-x')).rejects.toBeInstanceOf(CategorizeError);
    await expect(categorize(rows, data, 'sk-ant-x')).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/categorizeStatements.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/engine/categorizeStatements.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/categorizeStatements.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/categorizeStatements.js src/tests/categorizeStatements.test.js
git commit -m "feat: add batched statement categorizer (proxy reuse, fence-strip, retry/fallback, 401/429)"
```

---

### Task 6: StatementImportOverlay.jsx — the wizard UI

**Files:**
- Create: `src/components/StatementImportOverlay.jsx`
- Test: `src/tests/StatementImportOverlay.test.jsx`

**Interfaces:**
- Consumes: `parseStatement` (Task 1), `dedupeAgainstLog` (Task 2), `lookup`/`remember` (Task 3), `categorize`/`CategorizeError` (Task 5), existing `isApiKeyConfigured` (`../engine/AIParser.js`), `flattenCategories` (`../lib/categories.js`), `formatShortDate` (`../lib/dates.js`), `IconX`/`IconCheck` (`./icons.jsx`).
- Props: `{ open, data, apiKey, onConfirm, update, onClose }` — `onConfirm` is `TransactionsTab.onConfirmSmart`; `update` persists `merchantMemory`.
- Produces: a default-exported React component. Commits selected rows in the exact `onConfirmSmart` result shape: `{ isNew, type, category, date, currencyCode, amount, description }`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/StatementImportOverlay.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatementImportOverlay from '../components/StatementImportOverlay.jsx';

const data = {
  primaryCurrency: 'USD',
  transactions: [],
  incomeGroups: [{ name: 'Income', categories: ['Salary'] }],
  expenseGroups: [{ name: 'Spending', categories: ['Groceries'] }],
  merchantMemory: {},
};
const noop = () => {};

describe('StatementImportOverlay', () => {
  it('shows the key gate when no API key is set', () => {
    render(<StatementImportOverlay open data={data} apiKey="" onConfirm={noop} update={noop} onClose={noop} />);
    expect(screen.getByText(/need an Anthropic API key/i)).toBeInTheDocument();
  });

  it('shows the upload zone when a key is present', () => {
    render(<StatementImportOverlay open data={data} apiKey="sk-ant-x" onConfirm={noop} update={noop} onClose={noop} />);
    expect(screen.getByText(/Drag your bank or card CSV/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<StatementImportOverlay open={false} data={data} apiKey="sk-ant-x" onConfirm={noop} update={noop} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/StatementImportOverlay.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/StatementImportOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isApiKeyConfigured } from '../engine/AIParser.js';
import { flattenCategories } from '../lib/categories.js';
import { formatShortDate } from '../lib/dates.js';
import { getCurrency } from '../lib/currencies.js';
import { parseStatement } from '../lib/statementParser.js';
import { dedupeAgainstLog } from '../lib/statementDedup.js';
import { lookup, remember } from '../lib/merchantMemory.js';
import { categorize, CategorizeError } from '../engine/categorizeStatements.js';
import { IconX, IconCheck } from './icons.jsx';

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const MAX_TX = 2000;

export default function StatementImportOverlay({ open, data, apiKey, onConfirm, update, onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | working | review | done
  const [pasteText, setPasteText] = useState('');
  const [fileText, setFileText] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [rows, setRows] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [memory, setMemory] = useState(() => data.merchantMemory || {});
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const prevFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector(FOCUSABLE)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = dialog?.querySelectorAll(FOCUSABLE);
      if (!items || !items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  const incomeCatSet = useMemo(() => new Set(flattenCategories(data.incomeGroups)), [data.incomeGroups]);
  const expenseCatSet = useMemo(() => new Set(flattenCategories(data.expenseGroups)), [data.expenseGroups]);
  const incomeCats = useMemo(() => flattenCategories(data.incomeGroups), [data.incomeGroups]);
  const expenseCats = useMemo(() => flattenCategories(data.expenseGroups), [data.expenseGroups]);
  const hasKey = isApiKeyConfigured(apiKey);

  if (!open) return null;

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const texts = await Promise.all(files.map((f) => f.text()));
    setFileText(texts.join('\n'));
    setError('');
  };

  const analyze = async () => {
    setError('');
    const text = [fileText, pasteText].filter(Boolean).join('\n');
    if (!text.trim()) { setError('Add a file or paste some rows first.'); return; }
    const parsed = parseStatement(text);
    if (!parsed.ok) {
      setError(parsed.error === 'empty'
        ? 'This file is empty or not a valid CSV.'
        : 'We couldn’t find any transactions in that file.');
      return;
    }
    if (parsed.needsManualMap) {
      setError('We couldn’t recognize the columns. Make sure your file has date, description, and amount columns.');
      return;
    }
    const { fresh, skipped } = dedupeAgainstLog(parsed.rows, data.transactions);
    setSkippedCount(skipped.length);

    let known = 0;
    const unknown = [];
    const prefilled = fresh.map((r) => {
      const cat = lookup(memory, r.description);
      if (cat) { known++; return { ...r, category: cat, merchant: r.description, confidence: 'high', needsReview: false, _checked: true }; }
      unknown.push(r);
      return null;
    });
    setKnownCount(known);

    if (unknown.length === 0) {
      setRows(prefilled.filter(Boolean));
      setStep('review');
      return;
    }

    setStep('working');
    setProgress({ done: 0, total: Math.ceil(unknown.length / 12) });
    try {
      const categorized = await categorize(unknown, data, apiKey, setProgress);
      let ci = 0;
      const merged = fresh.map((r, i) => (prefilled[i] ? prefilled[i] : { ...categorized[ci++], _checked: true }));
      merged.sort((a, b) => (b.needsReview ? 1 : 0) - (a.needsReview ? 1 : 0));
      setRows(merged);
      setStep('review');
    } catch (err) {
      setError(err instanceof CategorizeError && err.status === 401
        ? 'Your API key was rejected. Check it in Setup.'
        : `Categorization failed. ${err.message || ''}`);
      setStep('upload');
    }
  };

  const setRow = (idx, patch) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const onEditCategory = (idx, category) => {
    const r = rows[idx];
    setRow(idx, { category, needsReview: false });
    setMemory((m) => remember(m, r.description, category));
  };
  const toggleAll = (checked) => setRows((rs) => rs.map((r) => ({ ...r, _checked: checked })));
  const flipAllTypes = () =>
    setRows((rs) => rs.map((r) => ({ ...r, type: r.type === 'Income' ? 'Expense' : 'Income' })));

  const selectedCount = rows.filter((r) => r._checked).length;

  const doImport = () => {
    const selected = rows.filter((r) => r._checked);
    if (selected.length === 0) return;
    if (data.transactions.length + selected.length > MAX_TX) {
      setError(`That would pass the ${MAX_TX}-entry limit. You can import ${Math.max(0, MAX_TX - data.transactions.length)} more.`);
      return;
    }
    const results = selected.map((r) => ({
      isNew: !(r.type === 'Income' ? incomeCatSet : expenseCatSet).has(r.category),
      type: r.type,
      category: r.category,
      date: r.date,
      currencyCode: data.primaryCurrency,
      amount: r.amount,
      description: r.description,
    }));
    onConfirm(results);
    let mem = memory;
    selected.forEach((r) => { mem = remember(mem, r.description, r.category); });
    if (update) update((p) => ({ ...p, merchantMemory: mem }));
    setSummary({
      count: selected.length,
      expenses: selected.filter((r) => r.type === 'Expense').length,
      income: selected.filter((r) => r.type === 'Income').length,
    });
    setStep('done');
  };

  const importMore = () => {
    setStep('upload'); setPasteText(''); setFileText(''); setRows([]);
    setError(''); setProgress(null); setSummary(null); setSkippedCount(0); setKnownCount(0);
  };

  const stepNum = step === 'upload' ? 1 : step === 'working' ? 2 : 3;

  return (
    <div className="tutorial-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label="Import statement"
        ref={dialogRef}
        style={{ width: 'min(880px, 95vw)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
      >
        <button className="btn ghost icon" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12 }}>
          <IconX />
        </button>

        {!hasKey ? (
          <div style={{ padding: '8px 4px' }}>
            <h2 style={{ marginBottom: 8 }}>Import a statement</h2>
            <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 16 }}>
              You need an Anthropic API key to use this feature.
            </p>
            <button className="btn primary" onClick={onClose}>Go to Setup →</button>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Add your key in the Setup tab, then reopen Import.
            </p>
          </div>
        ) : (
          <>
            <span className="eyebrow accent">Step {stepNum} of 3</span>
            <h2 style={{ marginTop: 4, marginBottom: 12 }}>Import a statement</h2>

            {error && (
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--negative)', padding: '8px 12px', background: 'var(--negative-soft)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {step === 'upload' && (
              <div className="fade-up">
                <label
                  htmlFor="stmt-file"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                  style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Drag your bank or card CSV here, or tap to choose a file</div>
                  <div className="muted" style={{ fontSize: 12 }}>{fileText ? 'File loaded ✓' : '.csv files'}</div>
                  <input id="stmt-file" type="file" accept=".csv,text/csv" multiple style={{ display: 'none' }} onChange={(e) => onFiles(e.target.files)} />
                </label>
                <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>…or paste rows copied from your bank, Excel, or Sheets:</p>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Paste statement rows here"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  style={{ marginBottom: 14, resize: 'vertical' }}
                />
                <button className="btn primary block" onClick={analyze}>Analyze transactions</button>
              </div>
            )}

            {step === 'working' && (
              <div className="fade-up" style={{ padding: '24px 4px' }}>
                <p style={{ marginBottom: 10 }}>We’re sorting your transactions into your categories…</p>
                <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {progress ? `Batch ${progress.done} of ${progress.total}` : 'Starting…'}
                </p>
              </div>
            )}

            {step === 'review' && (
              <div className="fade-up">
                <p style={{ fontSize: 13, marginBottom: 10 }}>
                  Found <strong>{rows.length}</strong> to import
                  {skippedCount > 0 && <> · <span className="muted">{skippedCount} already in your log</span></>}
                  {knownCount > 0 && <> · <span className="muted">{knownCount} known merchants</span></>}.
                </p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button className="btn ghost sm" onClick={() => toggleAll(true)}>Select all</button>
                  <button className="btn ghost sm" onClick={() => toggleAll(false)}>Deselect all</button>
                  <button className="btn ghost sm" onClick={flipAllTypes}>Flip all income/expense</button>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{selectedCount} of {rows.length} selected</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '46vh', overflowY: 'auto' }}>
                  {rows.map((r, i) => {
                    const ts = getCurrency(data.primaryCurrency).symbol;
                    const cats = r.type === 'Income' ? incomeCats : expenseCats;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elev)', border: `1px solid ${r.needsReview ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 10 }}>
                        <input type="checkbox" checked={!!r._checked} onChange={(e) => setRow(i, { _checked: e.target.checked })} aria-label="Include" />
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 52 }}>{formatShortDate(r.date)}</span>
                        <span title={r.description} className="text-ellipsis" style={{ flex: 1, minWidth: 80, fontSize: 12 }}>
                          {r.description.length > 35 ? `${r.description.slice(0, 35)}…` : r.description}
                        </span>
                        <select className="select sm" value={r.type} onChange={(e) => setRow(i, { type: e.target.value })} style={{ width: 90 }}>
                          <option value="Income">Income</option>
                          <option value="Expense">Expense</option>
                        </select>
                        <input className="input sm" list={`stmt-cat-${i}`} value={r.category} onChange={(e) => onEditCategory(i, e.target.value)} style={{ flex: 1, minWidth: 90 }} />
                        <datalist id={`stmt-cat-${i}`}>{cats.map((c) => <option key={c} value={c} />)}</datalist>
                        <span className="tnum" style={{ minWidth: 70, textAlign: 'right', fontWeight: 600, color: r.type === 'Income' ? 'var(--positive)' : 'var(--negative)' }}>
                          {ts}{r.amount.toFixed(2)}
                        </span>
                        {r.needsReview && <span className="badge info">review</span>}
                      </div>
                    );
                  })}
                </div>

                <button className="btn primary block" onClick={doImport} style={{ marginTop: 14 }} disabled={selectedCount === 0}>
                  <IconCheck /> Import {selectedCount} to Log
                </button>
              </div>
            )}

            {step === 'done' && summary && (
              <div className="fade-up" style={{ padding: '16px 4px', textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  {summary.count} imported ✓
                </p>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  {summary.expenses} expenses · {summary.income} income
                </p>
                <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                  <button className="btn ghost" onClick={importMore}>Import more</button>
                  <button className="btn primary" onClick={onClose}>Done</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/StatementImportOverlay.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatementImportOverlay.jsx src/tests/StatementImportOverlay.test.jsx
git commit -m "feat: add statement import wizard overlay (upload/analyze/review/import)"
```

---

### Task 7: Wire the Import button into the Log tab (the ONLY existing-file edit)

**Files:**
- Modify: `src/tabs/TransactionsTab.jsx` (four additive edits only — no existing function body changes)
- Test: existing `src/tests/App.tutorial.test.jsx` must still pass (regression); plus the full suite.

**Interfaces:**
- Consumes: the existing `onConfirmSmart`, `update`, `data`, `apiKey` already present in `TransactionsTab`.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Edit 1 — add the lazy import (top of file, after the existing import block, ~line 17)**

Add immediately after the `} from '../components/icons.jsx';` import line:

```jsx
const StatementImportOverlay = React.lazy(() => import('../components/StatementImportOverlay.jsx'));
```

- [ ] **Step 2: Edit 2 — add state (just after the existing `recForm` useState, ~line 40)**

Add after the `const [recForm, setRecForm] = useState({...})` block:

```jsx
  const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 3: Edit 3 — add the Import button in the header row**

Find the header actions row (currently the CSV + sort buttons, ~line 233-240):

```jsx
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={exportCSV}>
            <IconDownload /> CSV
          </button>
```

Insert the Import button as the first child of that `<div className="row">`, before the CSV button:

```jsx
          <button className="btn ghost sm" onClick={() => setImportOpen(true)}>
            <IconPlus /> Import
          </button>
```

(`IconPlus` is already imported at the top of this file — no new icon import.)

- [ ] **Step 4: Edit 4 — render the overlay (just before the final closing `</div>` of the `app-section` wrapper, ~line 704)**

Immediately before the last `</div>` that closes `<div className="app-section">`:

```jsx
      {importOpen && (
        <React.Suspense fallback={null}>
          <StatementImportOverlay
            open={importOpen}
            data={data}
            apiKey={apiKey}
            onConfirm={onConfirmSmart}
            update={update}
            onClose={() => setImportOpen(false)}
          />
        </React.Suspense>
      )}
```

- [ ] **Step 5: Run the full suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — all prior tests (incl. `App.tutorial.test.jsx`) plus the new statement-import tests. Target count: 92 prior + new tests, all green.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/TransactionsTab.jsx
git commit -m "feat: add Import button + statement import overlay to the Log tab"
```

---

### Task 8: Build + full regression verification

**Files:** none created/modified — verification only.

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 2: Production build (no import/compile regressions; bundle sane)**

Run: `npm run build`
Expected: build succeeds; the new overlay code-splits into its own lazy chunk; entry bundle unchanged (~30 kB).

- [ ] **Step 3: Manual checklist (record pass/fail for each)**

- [ ] Headered comma CSV imports; categories land in the user's own taxonomy.
- [ ] Paste (comma) works; tab-paste works; semicolon works.
- [ ] Headerless file maps positionally.
- [ ] Empty/non-CSV → "This file is empty or not a valid CSV", no crash.
- [ ] Re-importing the same file → rows reported as "already in your log".
- [ ] Editing a category then re-importing the same merchant → auto-filled (merchant memory), no AI call.
- [ ] A malformed AI batch → those rows fall back to "Other …" + "review" badge; import still completes.
- [ ] No API key → key-gate banner; "Go to Setup" closes the overlay.
- [ ] Importing near 2000 entries is blocked with the correct remaining count.
- [ ] "Flip all income/expense" corrects a credit-card statement imported as income.

- [ ] **Step 4: §2.4 DO-NOT-BREAK regression (existing features)**

- [ ] Quick-Add a transaction. - [ ] Edit a transaction. - [ ] Delete a transaction.
- [ ] SmartInput free-text parse → confirm. - [ ] `CSV` export downloads the same format.
- [ ] Recurring templates add/toggle/remove. - [ ] Overview totals include imported rows correctly.

- [ ] **Step 5: Report**

Report exactly which files were created (7) and the one modified (`TransactionsTab.jsx`), the final test count, build result, and any checklist item that failed or could not be verified.

---

## Self-Review (performed against the spec)

**1. Spec coverage:**
- §2 guardrails → Global Constraints + Task 7 (single-file, four additive edits) ✓
- §4 wizard/everyday UX → Task 6 (steps, drop zone, defaults checked, plain language, flip-all, progress) ✓
- §5 AI contract (5 rules) → Task 4 (prompt) + Task 5 (fallback/needsReview) + tests assert the exact ending sentence, user categories, Unknown rule, confidence, needsReview ✓
- §6 parsing robustness → Task 1 (delimiter/quote/BOM/amount/date/headerless/empty) ✓; per-bank sign deferred → "Flip all" control in Task 6 ✓
- §7 dedup + merchant memory → Tasks 2 & 3; memory persisted via `update()` in Task 6 ✓
- §8 import + 2000 cap + atomic write → Task 6 `doImport` (single `onConfirm` call) ✓
- §10 testing → unit tests Tasks 1-6 + manual + regression Task 8 ✓

**2. Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**3. Type consistency:** Row shape `{ date, description, amount, type }` flows Task 1 → 2 → 5; categorizer adds `{ category, merchant, confidence, needsReview }`; overlay maps to `onConfirmSmart` shape `{ isNew, type, category, date, currencyCode, amount, description }` (verified against `TransactionsTab.jsx:139-170`). `merchantMemory` map shape consistent across Tasks 3 & 6. Function names (`parseStatement`, `dedupeAgainstLog`, `lookup`/`remember`, `buildCategorizationSystemPrompt`/`buildBatchText`, `categorize`/`CategorizeError`) match across producer/consumer tasks. ✓

**Known v1 limitation (documented):** per-bank sign convention isn't auto-detected; single-amount files use sign (negative→Expense, positive→Income) and the review "Flip all income/expense" control is the everyday-user correction. Acceptable per spec deferrals.

