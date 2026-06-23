# Design Spec — "Import Statement" (AI-assisted CSV import into the Log)

Date: 2026-06-22
Status: DRAFT — awaiting owner approval before any code is written.

---

## 1. Goal & non-goals

**Goal:** Let a user import a bank/credit-card CSV (or paste statement rows) and bulk-add the
transactions to their Log, with categories auto-suggested — making adding income/expense far
faster than manual one-by-one entry.

**Approach (chosen by owner):** Option **B** — deterministic merchant-memory first, then a Claude
categorization pass (via the *existing* Netlify proxy) only for merchants we haven't seen.

**Non-goals (explicitly out of scope for v1):**
- No new "Settings" tab and no new API-key store. The Anthropic key already lives in the Setup
  tab (Firestore profile). We reuse it.
- No per-bank header signatures (generic fuzzy mapper + manual fallback covers every bank).
- No subscription / unusual / business flags (they don't map to the Log schema).
- No `source` / `importedAt` fields on transactions (keeps the written shape byte-identical to
  manual entries so the existing writer is reused verbatim).
- No direct browser→Anthropic calls. All AI goes through the existing proxy.

---

## 2. RULE ZERO — the site is live and works. This task is purely additive.

### 2.1 The ONLY existing file that may be edited
`src/tabs/TransactionsTab.jsx` — and only these four additive edits:
1. One `import` line for the lazy `StatementImportOverlay`.
2. One state hook: `const [importOpen, setImportOpen] = useState(false)`.
3. One **Import** icon button placed in the existing header `row` (next to the `CSV` export
   button at line ~234).
4. One render of `<StatementImportOverlay ... />` (lazy + Suspense), passing `data`, `apiKey`,
   `onConfirmSmart` (the EXISTING writer), and `onClose`.

No existing function body in this file may be modified. In particular, **`onConfirmSmart`
(line 139) is reused exactly as-is** — it is the commit path.

### 2.2 DO NOT TOUCH — must remain byte-for-byte unchanged
Code:
- `onConfirmSmart`, `addTransaction`, `addRecurringFromTx`, `addRecFromForm`, `removeRecurring`,
  `toggleRecurring`, `removeTx`, `startEdit`, `saveEdit`, `cancelEdit`, `exportCSV`, the `sorted`
  memo, and all JSX of the existing Transactions UI.
- `netlify/functions/parse.js` — reuse as-is. DO NOT change its model, `max_tokens`, or the
  `{ text, systemPrompt }` → `{ content }` contract. (Our batch sizing is built around its
  existing 1024-token cap precisely so this file is never touched.)
- `src/engine/AIParser.js`, `src/engine/promptTemplate.js`, `src/components/SmartInput.jsx` —
  these are *patterns to copy*, not files to edit.
- `src/lib/firebase.js`, `src/lib/firestore.js`, `src/lib/migrate.js` (incl. `DEFAULT_STATE`),
  `src/lib/cacheLifecycle.js`, `src/lib/dataSync.js`, `src/lib/persistencePreference.js`.
- `src/App.jsx` (auth/load/save/redirect logic), `src/components/Auth.jsx`, `src/lib/authFlow.js`.
- `src/components/navConfig.js` — NO nav change (the import is an icon in the Log tab, not a tab).
- `src/tabs/SetupTab.jsx` — the API-key UI is the single source of truth for the key. Do not
  duplicate or compete with it.
- `src/styles/*` (`tokens.css`, `globals.css`, `components.css`) — use existing CSS variables,
  classes (`.btn`, `.card`, `.input`, `.select`, `.badge`, `.eyebrow`, etc.), fonts, and spacing
  only. DO NOT add or modify a token, class, or global rule.

Data model:
- DO NOT change the transaction shape: `{ id, date, type, category, currencyCode, amount,
  description }`. DO NOT change category-group shapes (`incomeGroups`/`expenseGroups`),
  `budgetTargets`, `recurringTemplates`, or `nextId` semantics.
- New persisted state (`merchantMemory`) is added defensively via `data.merchantMemory || {}`
  so `migrate.js` / `DEFAULT_STATE` need no change.

### 2.3 No new dependencies
No new npm packages. CSV parsing, delimiter detection, etc. are implemented as small pure
functions (the app already ships its own parsers; we follow suit).

### 2.4 Mandatory regression re-verification (after build, before "done")
Manually confirm these existing features still work, unchanged:
1. Quick-Add a transaction. 2. Edit a transaction. 3. Delete a transaction.
4. SmartInput free-text parse → confirm. 5. `CSV` export downloads the same format.
6. Recurring templates add/toggle/remove. 7. Overview totals reflect imported rows correctly.

---

## 3. Architecture — reuse the existing pipeline

The free-text path already is: `SmartInput` → `aiParse(text,data,apiKey)` → review → `onConfirmSmart(results)`.
The importer is the **same pipeline with a different front door** (a CSV instead of typed text)
plus a merchant-memory cache and dedup:

```
file/paste ─▶ statementParser ─▶ rows[]
                                   │
              statementDedup ◀─────┘  (drop rows already in data.transactions)
                    │
        merchantMemory split ──▶ known → category filled (NO AI)
                    │
                    └─────────▶ unknown → categorizeStatements (batched proxy calls)
                                            │
                         review table (edit cat/type, toggle rows)
                                            │
                              onConfirmSmart(results)   ← EXISTING writer, unchanged
```

`onConfirmSmart` already: assigns ids from `data.nextId`, auto-creates `isNew` categories,
appends via the atomic `update()` Firestore write. We produce results in its exact shape:
`{ isNew, type, category, date, currencyCode, amount, description }`.

---

## 4. UI flow (one full-screen overlay, 5 steps)

Entry: **Import icon button** in the Log tab header → opens `StatementImportOverlay`
(lazy-loaded, reuses the `TutorialOverlay` focus-trap + `inert` + Esc-to-close pattern; full
screen for review-table room; mobile = horizontal scroll with sticky checkbox/amount, matching
the app's table behavior).

**Decision (locked): full-screen overlay, presented as a guided wizard** — chosen for everyday,
non-technical users over an inline panel. Everyday-user UX principles the overlay must follow:
- **One step on screen at a time** with a clear "Step X of 3" indicator and a Back button.
- **Big, obvious drop zone** with plain-language helper text ("Drag your bank or card CSV here,
  or tap to choose a file"); paste is a secondary option below it.
- **Sensible defaults** — every reviewed row is checked by default; the user can just hit Import.
- **Plain language, no jargon** — "We found 47 transactions", "12 were already in your log",
  "We're sorting these into your categories…". No talk of delimiters, hashes, batches, or tokens.
- **Forgiving** — never dead-ends. A file we can't auto-read shows a simple "Which column is the
  date / description / amount?" picker rather than an error. Errors are recoverable, not fatal.
- **One primary action per step**, visually dominant (the existing `.btn.primary`); secondary
  actions are quiet (`.btn.ghost`).
- **Honest progress** — a real progress bar during categorization so it never feels frozen.

0. **Key gate (first):** if `!isApiKeyConfigured(apiKey)`, show a banner:
   "You need an Anthropic API key to use this feature. → Go to Setup" (closes overlay and the
   user switches to the existing Setup tab). No flow proceeds without a key.
1. **Upload zone (3 inputs in one):** drag-drop one or more `.csv`; click-to-pick; paste raw
   text. Empty/invalid → "This file is empty or not a valid CSV" and stop.
2. **Parse summary:** "Found 47 transactions across 2 files." If columns can't be auto-mapped,
   show a **manual column-mapping** dropdown (date / description / amount) instead of failing.
3. **Dedup + memory:** "12 already in your log (skipped). 8 known merchants auto-categorized.
   27 need AI categorization." Progress bar runs the AI batches.
4. **Review table:** `needsReview`/low-confidence rows pinned at top and highlighted. Columns:
   checkbox (checked by default) · Date (`MMM DD, YYYY`) · Description (truncate ~35, full on
   hover) · Amount (green income / red expense) · Category (editable dropdown from the user's
   own categories, prefilled) · Type (editable) · Confidence. Filters: type, needs-review,
   select/deselect all, live count ("43 of 47 selected"). Editing a category updates merchant
   memory immediately and re-renders only that row.
5. **Import:** one "Import to Log" button → builds the full validated result array → calls
   `onConfirmSmart` → confirmation "43 imported (32 expenses, 11 income)" with "Import More" /
   "Done".

---

## 5. AI categorization contract (the five required rules)

`buildCategorizationPrompt(batch, userCategories)` builds the system prompt; the batch rows are
the user content. The prompt MUST enforce, explicitly:

1. **Structured JSON, not prose.** The instruction ends with the exact sentence:
   `Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation.`
2. **Consistent names from a predefined list we provide.** We pass the user's *own* category
   list (`flattenCategories(data.incomeGroups)` + `flattenCategories(data.expenseGroups)`) as
   the allowed set, and instruct: "Choose `category` ONLY from this exact list: [...]. Do not
   invent categories. If none fits, use `<Other Expense / Other Income>` and set
   `needsReview: true`." (This is why imports land in the user's taxonomy, never a foreign
   18-item list.)
3. **Confidence score per item:** `confidence` ∈ `"high" | "medium" | "low"`.
4. **Separate needs-review from auto-categorized:** any `low` confidence (or off-list fallback)
   sets `needsReview: true`; the review table pins these to the top.
5. **Never hallucinate merchants:** "Use only the description text provided. If unclear, set
   `merchant` to `\"Unknown\"`. Do not invent or guess a name."

**Output schema (lean, to fit the proxy's 1024-token cap):** a JSON array of
`{ "i": <index in batch>, "merchant": <string|"Unknown">, "category": <from list>,
"type": "Income"|"Expense", "confidence": "high"|"medium"|"low", "needsReview": <bool> }`.

**Batching:** batch size ≈ 12 rows (lean schema × 12 ≈ well under 1024 output tokens). Calls run
**sequentially** with a progress bar. Merchant-memory hits are excluded before batching.

**Failure handling (one bad batch must never kill the import):**
| Condition | Behavior |
|---|---|
| Markdown fences around JSON | strip `^```(json)?` / trailing ``` before parse (reuse `AIParser` regex) |
| Malformed JSON | retry the batch once; if still bad, assign every row `category: "Other…"`, `needsReview: true`, continue |
| 401 (proxy relays) | stop with "Your API key was rejected. Check it in Setup." |
| 429 (proxy relays) | "Rate limited — retrying…", back off, retry the batch |
| network/timeout | mark that batch failed, keep succeeded batches, offer "Retry this batch" |

---

## 6. Parsing robustness (`statementParser.js`, pure)

| Input problem | Handling |
|---|---|
| Commas inside quoted fields | real quote-aware parser, never `split(',')` |
| Tab/semicolon-separated paste | auto-detect delimiter among `, \t ;` |
| Headerless file (e.g. Wells Fargo) | detect missing header; positional fallback |
| Junk metadata rows at top | skip rows until one matches the column shape |
| BOM / encoding | strip BOM, normalize before parse |
| `$1,234.56`, `(45.00)`, `-45.00` | strip `$`/commas; parentheses ⇒ negative |
| Debit/credit one vs two columns | support single-amount and split debit/credit |
| Mixed dates (`MM/DD/YYYY`, `YYYY-MM-DD`, `DD-MMM-YYYY`) | normalize to internal `YYYY-MM-DD` |
| Zero-amount / blank / trailing rows | skip silently; trim before parse |
| Empty / non-CSV | "This file is empty or not a valid CSV" and stop |
| Column auto-map fails | manual date/description/amount dropdown, don't fail |

Sign convention: a `type` (Income/Expense) is derived from amount sign after normalization;
the review step lets the user flip it. (No per-bank sign rules in v1; the review table is the
safety net. Noted as a v2 refinement.)

Performance: parse in chunks so large files don't block the UI thread; show progress.

---

## 7. Dedup & merchant memory

**Dedup (`statementDedup.js`, pure):** hash = `lower(date + '|' + abs(amount).toFixed(2) + '|' +
description.slice(0,30))`. Build a Set from existing `data.transactions`; drop rows whose hash
matches. Surface the rule to the user ("matched on date+amount+description; a bank re-posting on
a different date may slip through"). Also flag intra-batch duplicates for user decision.

**Merchant memory (`merchantMemory.js`, pure):** key = `normalize(merchant)` = uppercase, strip
non-alphanumerics, first 25 chars (so `AMAZON.COM`, `AMZN*PRIME`, `AMAZON MKTP` collapse). Stored
at `data.merchantMemory` (Firestore appdata → syncs across devices; defensive default `|| {}`).
Known keys are pre-confirmed → category filled, **AI skipped**. Editing a category in review
writes the mapping immediately (through `update()`).

---

## 8. Import & rollback semantics

- Build the **entire** validated result array first; only then call `onConfirmSmart` once.
- The Firestore write is a single-document `update()` — atomic by construction, so there is no
  half-written state to roll back. If the write throws, the existing save-status indicator flips
  to "failed" (existing behavior) and nothing is appended.
- **2000-entry cap:** before import, if `existing + selected > 2000`, block and tell the user how
  many they can import; never exceed it.

---

## 9. New files (self-contained) + interfaces

| File | Exports / responsibility |
|---|---|
| `src/lib/statementParser.js` | `parseStatement(text) → { rows, columns, needsManualMap }`; helpers `detectDelimiter`, `normalizeAmount`, `normalizeDate`, `mapColumns` |
| `src/lib/statementDedup.js` | `hashTx(tx)`, `dedupeAgainstLog(rows, existing) → { fresh, skipped }` |
| `src/lib/merchantMemory.js` | `normalizeMerchant(s)`, `lookup(memory, desc)`, `remember(memory, desc, category)` |
| `src/engine/categorizationPrompt.js` | `buildCategorizationPrompt(batch, userCategories)` (the §5 contract) |
| `src/engine/categorizeStatements.js` | `categorize(rows, data, apiKey, onProgress) → results[]` (batches, proxy call, fence-strip, retry/fallback) |
| `src/components/StatementImportOverlay.jsx` | the 5-step UI; calls `onConfirmSmart` to commit |
| tests | `statementParser.test.js`, `statementDedup.test.js`, `merchantMemory.test.js`, `categorizationPrompt.test.js` |

---

## 10. Testing strategy (matches the project's TDD norm — 92 passing tests)

**Unit (vitest, written test-first):**
- Parser: quoted commas, tab/semicolon paste, headerless+positional, junk-row skip, BOM,
  amount normalization incl. parentheses, all three date formats, empty/invalid, the app's own
  exported CSV round-trips cleanly.
- Dedup: exact match skipped; same merchant/different amount kept; intra-batch dup flagged.
- Merchant memory: the three Amazon variants collapse to one key; lookup/remember.
- Prompt: asserts the output instruction string is present, the user's categories are embedded,
  and the "Unknown" / confidence / needsReview rules appear.

**Manual checklist before "done":**
parse all sample formats · paste works · tab-paste works · headerless works · empty/invalid
handled · dedup works · merchant memory works · malformed-JSON batch recovers · 401 gate ·
429 backoff · 2000-cap respected · **all §2.4 regressions pass.**

---

## 11. Delivery sequence
1. Parser + dedup + merchant memory + prompt builder (pure, test-first).
2. `categorizeStatements` (proxy integration, failure handling).
3. `StatementImportOverlay` UI (wired to `onConfirmSmart`).
4. The 4 additive edits in `TransactionsTab.jsx`.
5. Full suite green + manual checklist + §2.4 regression re-verify.
6. Report exactly which files were created/touched and any gaps.

---

## Resolved decisions
1. **Flow UI:** full-screen overlay presented as a guided wizard, optimized for everyday users
   (see §4). RESOLVED.
2. **v1 deferrals approved:** no per-bank signatures, no subscription/unusual/business flags, no
   `source`/`importedAt` fields. RESOLVED.
