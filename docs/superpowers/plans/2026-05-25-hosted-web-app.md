# CashFlow Tracker — Hosted Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CashFlow Tracker v5 from a local Vite dev-server app into a fully hosted web application at `cashflowtracker.net` with Google authentication, per-user Firestore cloud storage, and a Netlify Functions AI proxy.

**Architecture:** Firebase handles Google OAuth and per-user data isolation (profile fields in `users/{uid}`, app state in `users/{uid}/appdata/main`). The browser communicates directly with Firestore via the Firebase SDK. A Netlify Function at `/.netlify/functions/parse` acts as the AI proxy — it receives the user's Anthropic key in the `x-api-key` header, calls Anthropic, and returns the raw response. 80% of the app (all tabs, NLPParser, HybridParser, charts, CSS) is untouched.

**Tech Stack:** React 18 + Vite 5 (existing), Firebase v10 SDK (auth + Firestore), Netlify Functions + Netlify CDN, @anthropic-ai/sdk (existing), Vitest (existing)

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/firebase.js` | **Create** | Firebase app init; exports `auth` and `db` |
| `src/lib/firestore.js` | **Create** | Replaces `storage.js`; `loadProfile/saveProfile/loadData/saveData/loadLegacyData/clearLegacyData` |
| `netlify/functions/parse.js` | **Create** | Serverless AI proxy: reads `x-api-key` header, calls Anthropic, returns `{ content }` |
| `firestore.rules` | **Create** | Firestore security rules (per-user isolation) |
| `netlify.toml` | **Create** | Netlify build config, SPA redirect, security headers |
| `src/components/Auth.jsx` | **Replace** | Google Sign-In only (removes email/password form) |
| `src/engine/AIParser.js` | **Modify** | New endpoint `/.netlify/functions/parse`; `apiKey` third param; sync `isApiKeyConfigured(key)` |
| `src/engine/HybridParser.js` | **Modify** | Thread `apiKey` through `options` to `aiParse` |
| `src/components/SmartInput.jsx` | **Modify** | Accept `apiKey` prop; remove async `isApiKeyConfigured` useEffect |
| `src/tabs/TransactionsTab.jsx` | **Modify** | Accept and pass down `apiKey` prop to SmartInput |
| `src/App.jsx` | **Modify** | `onAuthStateChanged` listener; Firestore data loading; migration check; pass `apiKey` to tabs |
| `src/tabs/SetupTab.jsx` | **Modify** | Add AI Settings section (API key input + save) |
| `vite.config.js` | **Modify** | Remove proxy plugin; keep react plugin + test config |
| `landing/index.html` | **Modify** | Hero CTA + how-it-works update |
| `package.json` | **Modify** | Add `firebase` dep; add `netlify-cli` devDep |
| `server/proxy.js` | **Delete** | Replaced by `netlify/functions/parse.js` |
| `src/tests/firestore.test.js` | **Create** | Unit tests for Firestore data layer |
| `src/tests/netlify-parse.test.js` | **Create** | Unit tests for Netlify AI proxy handler |
| `src/tests/AIParser.test.js` | **Create** | Unit tests for updated AIParser |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install firebase SDK**

Run from the project root (`"Downloads/Cashflow app"`):
```
npm install firebase
```
Expected: `firebase` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Install netlify-cli as a dev dependency**

```
npm install --save-dev netlify-cli
```
Expected: `netlify-cli` appears in `devDependencies`.

- [ ] **Step 3: Verify**

```
npm ls firebase netlify-cli --depth=0
```
Expected: both packages listed with version numbers (no errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add firebase SDK and netlify-cli"
```

---

### Task 2: Create `src/lib/firebase.js`

**Files:**
- Create: `src/lib/firebase.js`

No test needed — this file is pure config/init with no logic to test.

- [ ] **Step 1: Create the file**

Create `src/lib/firebase.js`:

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 2: Create `.env.local` for local development**

Create `.env.local` in the project root (this file is NOT committed — it's already covered by the standard `.gitignore` entry for `.env.local`):

```
VITE_FIREBASE_API_KEY=<paste from Firebase Console>
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_APP_ID=<paste from Firebase Console>
```

Get these values from Firebase Console → Project Settings → Your Apps → Web app config. You'll fill them in when the Firebase project is created.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase.js
git commit -m "feat: add Firebase app initialisation"
```

---

### Task 3: Create `src/lib/firestore.js` with tests

**Files:**
- Create: `src/lib/firestore.js`
- Create: `src/tests/firestore.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/tests/firestore.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => args.join('/')),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('../lib/firebase.js', () => ({ db: {} }));

const { loadData, saveData, loadProfile, saveProfile, loadLegacyData, clearLegacyData } =
  await import('../lib/firestore.js');

import { getDoc, setDoc } from 'firebase/firestore';

describe('firestore data layer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loadProfile returns null when document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await loadProfile('uid1')).toBeNull();
  });

  it('loadProfile returns document data when it exists', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ email: 'a@b.com' }) });
    expect(await loadProfile('uid1')).toEqual({ email: 'a@b.com' });
  });

  it('saveProfile calls setDoc with merge:true', async () => {
    setDoc.mockResolvedValueOnce(undefined);
    await saveProfile('uid1', { email: 'a@b.com' });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'a@b.com' },
      { merge: true }
    );
  });

  it('loadData returns null when document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await loadData('uid1')).toBeNull();
  });

  it('loadData returns document data when it exists', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ transactions: [] }) });
    expect(await loadData('uid1')).toEqual({ transactions: [] });
  });

  it('saveData calls setDoc with updatedAt timestamp', async () => {
    setDoc.mockResolvedValueOnce(undefined);
    await saveData('uid1', { transactions: [] });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ updatedAt: 'SERVER_TIMESTAMP' })
    );
  });

  it('loadLegacyData returns null when localStorage has no mbr-data-v4', () => {
    localStorage.clear();
    expect(loadLegacyData()).toBeNull();
  });

  it('loadLegacyData parses data from localStorage', () => {
    localStorage.setItem('mbr-data-v4', JSON.stringify({ transactions: [1] }));
    expect(loadLegacyData()).toEqual({ transactions: [1] });
    localStorage.removeItem('mbr-data-v4');
  });

  it('clearLegacyData removes mbr-data-v4', () => {
    localStorage.setItem('mbr-data-v4', '{}');
    clearLegacyData();
    expect(localStorage.getItem('mbr-data-v4')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | grep -A 5 "firestore.test"
```
Expected: FAIL — `../lib/firestore.js` module not found.

- [ ] **Step 3: Create `src/lib/firestore.js`**

```js
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

export async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, profile) {
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
}

export async function loadData(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'appdata', 'main'));
  return snap.exists() ? snap.data() : null;
}

export async function saveData(uid, data) {
  await setDoc(doc(db, 'users', uid, 'appdata', 'main'), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function loadLegacyData() {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('mbr-data-v4') : null;
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function clearLegacyData() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('mbr-data-v4');
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 20 "firestore.test"
```
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore.js src/tests/firestore.test.js
git commit -m "feat: add Firestore data layer (replaces storage.js)"
```

---

### Task 4: Create `netlify/functions/parse.js` with tests

**Files:**
- Create: `netlify/functions/parse.js`
- Create: `src/tests/netlify-parse.test.js`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p netlify/functions
```

- [ ] **Step 2: Write failing tests**

Create `src/tests/netlify-parse.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | grep -A 5 "netlify-parse"
```
Expected: FAIL — module not found.

- [ ] **Step 4: Create `netlify/functions/parse.js`**

```js
import Anthropic from '@anthropic-ai/sdk';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = event.headers['x-api-key'];
  if (!apiKey) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No API key provided' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { text, systemPrompt } = body;
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'text is required' }) };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: response.content[0].text }),
    };
  } catch (err) {
    const status = err?.status || err?.response?.status;
    if (status === 401) {
      return { statusCode: 401, body: JSON.stringify({ error: 'API key rejected by Anthropic.' }) };
    }
    if (status === 429) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit hit. Try again in a moment.' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'Upstream error' }) };
  }
};
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 20 "netlify-parse"
```
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/parse.js src/tests/netlify-parse.test.js
git commit -m "feat: add Netlify AI proxy function"
```

---

### Task 5: Create `firestore.rules` and `netlify.toml`

**Files:**
- Create: `firestore.rules`
- Create: `netlify.toml`

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 2: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules netlify.toml
git commit -m "feat: add Firestore security rules and Netlify build config"
```

---

### Task 6: Replace `src/components/Auth.jsx`

**Files:**
- Modify: `src/components/Auth.jsx` (full replacement)

No unit test needed — Auth renders a single button that triggers Firebase's own `signInWithPopup`; testing it requires a Firebase emulator.

- [ ] **Step 1: Replace the entire contents of `src/components/Auth.jsx`**

```jsx
import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { IconWallet } from './icons.jsx';

export default function Auth() {
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setErr('');
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged in App.jsx handles the rest — no action needed here
    } catch (e) {
      setErr(
        e.code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled.'
          : 'Sign-in failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        className="fade-up"
        data-testid="auth-screen"
        style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            background: 'var(--accent)',
            color: 'var(--ink-on-accent)',
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <IconWallet size={28} />
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>CashFlow</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 32 }}>
          Quiet Wealth, Clear Numbers
        </p>

        <div className="card">
          <button
            className="btn outline block"
            data-testid="auth-google-btn"
            onClick={signIn}
            disabled={loading}
            style={{ justifyContent: 'center', gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.5 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 28.9 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 28.9 5 24 5c-7.6 0-14.1 4.2-17.7 10.7z" />
              <path fill="#FBBC05" d="M24 45c5.2 0 9.9-2 13.4-5.1l-6.2-5.2C29.3 36.4 26.7 37 24 37c-5.2 0-9.7-3.5-11.3-8.3l-6.5 5C9.9 40.8 16.5 45 24 45z" />
              <path fill="#EA4335" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C36.9 39.7 44 34 44 25c0-1.3-.1-2.6-.4-3.9z" />
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
          {err && (
            <p style={{ color: 'var(--negative)', fontSize: 12, marginTop: 12 }}>{err}</p>
          )}
          <p style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 16 }}>
            Your data is private · syncs across all your devices
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Auth.jsx
git commit -m "feat: replace Auth with Google Sign-In only"
```

---

### Task 7: Refactor `src/engine/AIParser.js` with tests

**Files:**
- Modify: `src/engine/AIParser.js` (full replacement)
- Create: `src/tests/AIParser.test.js`

Key changes: new endpoint `/.netlify/functions/parse`; third `apiKey` param on `aiParse`; browser now builds the system prompt before sending; `isApiKeyConfigured` becomes synchronous.

- [ ] **Step 1: Write failing tests**

Create `src/tests/AIParser.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../engine/promptTemplate.js', () => ({
  buildSystemPrompt: vi.fn(() => 'mock system prompt'),
  STATIC_PROMPT_PREFIX: '',
}));

const { aiParse, isApiKeyConfigured, AIParserError } = await import('../engine/AIParser.js');

const mockData = {
  incomeGroups: [],
  expenseGroups: [],
  primaryCurrency: 'USD',
};

describe('isApiKeyConfigured', () => {
  it('returns true for a valid sk-ant- key', () => {
    expect(isApiKeyConfigured('sk-ant-abc123')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isApiKeyConfigured('')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isApiKeyConfigured(undefined)).toBe(false);
  });

  it('returns false for a non-Anthropic key prefix', () => {
    expect(isApiKeyConfigured('sk-openai-123')).toBe(false);
  });
});

describe('aiParse', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('posts to /.netlify/functions/parse', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: '{"transactions":[],"warnings":[]}' }),
    });
    await aiParse('coffee $5', mockData, 'sk-ant-test');
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/parse',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends x-api-key header with the provided key', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: '{"transactions":[],"warnings":[]}' }),
    });
    await aiParse('coffee $5', mockData, 'sk-ant-mykey');
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['x-api-key']).toBe('sk-ant-mykey');
  });

  it('throws AIParserError on non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'bad key' }),
    });
    await expect(aiParse('test', mockData, 'sk-ant-bad')).rejects.toThrow(AIParserError);
  });

  it('returns parsed transactions from content field', async () => {
    const mockTx = { type: 'Expense', category: 'Food', amount: 5, date: '2026-01-01', description: 'coffee' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: JSON.stringify({ transactions: [mockTx], warnings: [] }),
      }),
    });
    const result = await aiParse('coffee $5', mockData, 'sk-ant-test');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].amount).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | grep -A 5 "AIParser.test"
```
Expected: FAIL (old `isApiKeyConfigured` is async, wrong endpoint, no `apiKey` param).

- [ ] **Step 3: Replace the entire contents of `src/engine/AIParser.js`**

```js
import { flattenCategories } from '../lib/categories.js';
import { dateString } from '../lib/dates.js';
import { buildSystemPrompt } from './promptTemplate.js';

export class AIParserError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AIParserError';
    this.status = status;
  }
}

function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export async function aiParse(text, data, apiKey) {
  const today = (() => {
    const d = new Date();
    return dateString(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  const categories = {
    income: flattenCategories(data.incomeGroups),
    expense: flattenCategories(data.expenseGroups),
  };

  const systemPrompt = buildSystemPrompt({ categories, today, primaryCurrency: data.primaryCurrency });

  const response = await fetch('/.netlify/functions/parse', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey || '',
    },
    body: JSON.stringify({ text, systemPrompt }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const j = await response.json();
      detail = j.error || '';
    } catch {
      detail = response.statusText;
    }
    throw new AIParserError(detail || `HTTP ${response.status}`, response.status);
  }

  const json = await response.json();
  const raw = json.content || '';

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new AIParserError('AI returned non-JSON response', 502);
  }

  const existingIncome = new Set(categories.income);
  const existingExpense = new Set(categories.expense);

  const results = (parsed.transactions || []).map((t, i) => {
    const existingSet = t.type === 'Income' ? existingIncome : existingExpense;
    return {
      _idx: i,
      type: t.type === 'Income' ? 'Income' : 'Expense',
      category: t.category || (t.type === 'Income' ? 'Other Income' : 'Other Expense'),
      amount: Number(t.amount) || 0,
      date: t.date || today,
      description: t.description || '',
      isNew: !existingSet.has(t.category),
      original: t.description || '',
      currencyCode: data.primaryCurrency,
    };
  });

  return { results, warnings: parsed.warnings || [] };
}

export function isApiKeyConfigured(apiKey) {
  return Boolean(apiKey && apiKey.startsWith('sk-ant-'));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 20 "AIParser.test"
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/AIParser.js src/tests/AIParser.test.js
git commit -m "feat: update AIParser for Netlify endpoint and user-provided API key"
```

---

### Task 8: Thread `apiKey` through `HybridParser` and `SmartInput`

**Files:**
- Modify: `src/engine/HybridParser.js`
- Modify: `src/components/SmartInput.jsx`

`HybridParser.hybridParse` gains `options.apiKey` which it passes to `aiParse`. `SmartInput` receives `apiKey` as a prop instead of fetching it via async `isApiKeyConfigured()`.

- [ ] **Step 1: Replace the entire contents of `src/engine/HybridParser.js`**

```js
import { parseTransactions } from './NLPParser.js';
import { aiParse, AIParserError } from './AIParser.js';

const VALID_PREFERENCES = new Set(['local', 'fallback', 'always']);

function tagSource(result, source) {
  return {
    results: result.results.map((r) => ({ ...r, source })),
    warnings: result.warnings,
  };
}

function looksUncertain(localResult) {
  if (localResult.warnings.length > 0) return true;
  return localResult.results.some(
    (r) =>
      r.isNew &&
      (r.category === 'Other Income' ||
        r.category === 'Other Expense' ||
        /^[A-Z][a-z]+$/.test(r.category))
  );
}

export async function hybridParse(text, data, options = {}) {
  const preference = VALID_PREFERENCES.has(options.preference)
    ? options.preference
    : data.aiPreference || 'fallback';
  const hasApiKey = options.hasApiKey !== false;
  const apiKey = options.apiKey || '';

  if (preference === 'local' || !hasApiKey) {
    return tagSource(parseTransactions(text, data), 'local');
  }

  if (preference === 'always') {
    try {
      const ai = await aiParse(text, data, apiKey);
      return tagSource(ai, 'ai');
    } catch (err) {
      const local = parseTransactions(text, data);
      return {
        ...tagSource(local, 'local'),
        warnings: [...local.warnings, `AI unavailable, used local. ${formatError(err)}`],
      };
    }
  }

  const local = parseTransactions(text, data);
  if (!looksUncertain(local)) {
    return tagSource(local, 'local');
  }

  try {
    const ai = await aiParse(text, data, apiKey);
    return tagSource(ai, 'ai');
  } catch (err) {
    return {
      ...tagSource(local, 'local'),
      warnings: [...local.warnings, `AI fallback failed: ${formatError(err)}`],
    };
  }
}

function formatError(err) {
  if (err instanceof AIParserError) {
    if (err.status === 503) return 'No API key configured.';
    if (err.status === 429) return 'Rate limit hit, try again in a moment.';
    if (err.status === 501) return 'AI parser is not yet enabled.';
  }
  return err?.message || 'unknown error';
}
```

- [ ] **Step 2: Run existing HybridParser tests to confirm nothing broke**

```
npm test -- --reporter=verbose 2>&1 | grep -A 15 "HybridParser.test"
```
Expected: all existing HybridParser tests PASS. (Adding `options.apiKey` is backwards-compatible — it defaults to `''`.)

- [ ] **Step 3: Update `src/components/SmartInput.jsx`**

Make three targeted edits:

**Edit 1** — Change the import line (line 1–6). Replace:
```jsx
import React, { useEffect, useState } from 'react';
import { hybridParse } from '../engine/HybridParser.js';
import { isApiKeyConfigured } from '../engine/AIParser.js';
```
With:
```jsx
import React, { useState } from 'react';
import { hybridParse } from '../engine/HybridParser.js';
import { isApiKeyConfigured } from '../engine/AIParser.js';
```

**Edit 2** — Change the function signature and replace the `hasApiKey` state + useEffect. Replace:
```jsx
export default function SmartInput({ data, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorToast, setErrorToast] = useState(null);

  useEffect(() => {
    isApiKeyConfigured().then(setHasApiKey);
  }, []);
```
With:
```jsx
export default function SmartInput({ data, onConfirm, apiKey }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasApiKey = isApiKeyConfigured(apiKey);
  const [saved, setSaved] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
```

**Edit 3** — In the `run` function, add `apiKey` to the `hybridParse` options. Find:
```jsx
      const r = await hybridParse(text, data, {
        preference: preferenceOverride || data.aiPreference,
        hasApiKey,
      });
```
Replace with:
```jsx
      const r = await hybridParse(text, data, {
        preference: preferenceOverride || data.aiPreference,
        hasApiKey,
        apiKey,
      });
```

- [ ] **Step 4: Run all tests**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/HybridParser.js src/components/SmartInput.jsx
git commit -m "feat: thread API key from SmartInput through HybridParser to aiParse"
```

---

### Task 9: Update `src/App.jsx`

**Files:**
- Modify: `src/App.jsx` (full replacement)
- Modify: `src/tabs/TransactionsTab.jsx` (add `apiKey` prop)
- Modify: `src/components/Shell.jsx` or `src/components/Sidebar.jsx` (if they use `auth.name`)

- [ ] **Step 1: Check how Shell/Sidebar use the `auth` prop**

```
grep -n "auth\." src/components/Shell.jsx src/components/Sidebar.jsx src/components/BottomNav.jsx
```

The old `auth` was `{ name, email, provider }`. The Firebase user object has `displayName` (not `name`) and `photoURL`. Note any occurrences of `auth.name` — you will fix those in Step 3.

- [ ] **Step 2: Replace the entire contents of `src/App.jsx`**

```jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ThemeProvider } from './lib/theme.jsx';
import {
  loadData,
  saveData,
  loadProfile,
  saveProfile,
  loadLegacyData,
  clearLegacyData,
} from './lib/firestore.js';
import { auth } from './lib/firebase.js';
import { migrate, DEFAULT_STATE } from './lib/migrate.js';
import { generateNotifications } from './lib/notifications.js';
import { flattenCategories } from './lib/categories.js';
import Auth from './components/Auth.jsx';
import Shell from './components/Shell.jsx';
import SetupTab from './tabs/SetupTab.jsx';
import TransactionsTab from './tabs/TransactionsTab.jsx';
import OverviewTab from './tabs/OverviewTab.jsx';
import GoalsTab from './tabs/GoalsTab.jsx';
import { pad, monthRange, dateString } from './lib/dates.js';

export default function App() {
  // user: undefined = Firebase resolving, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setData(null);
        return;
      }
      setUser(firebaseUser);

      // Load or create profile document
      let prof = await loadProfile(firebaseUser.uid);
      if (!prof) {
        prof = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          createdAt: new Date().toISOString(),
        };
        await saveProfile(firebaseUser.uid, prof);
      }
      setProfile(prof);

      // Load or migrate appdata
      let appData = await loadData(firebaseUser.uid);
      if (!appData) {
        const legacy = loadLegacyData();
        if (legacy) {
          const confirmed = window.confirm(
            'Found existing local data. Import it to your account?'
          );
          if (confirmed) {
            const migrated = migrate(legacy);
            await saveData(firebaseUser.uid, migrated);
            clearLegacyData();
            appData = migrated;
          }
        }
        if (!appData) {
          appData = { ...DEFAULT_STATE };
          await saveData(firebaseUser.uid, appData);
        }
      } else {
        appData = migrate(appData);
      }
      setData(appData);
    });
    return unsub;
  }, []);

  const update = useCallback(
    (fn) => {
      setData((prev) => {
        const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
        if (user?.uid) saveData(user.uid, next);
        return next;
      });
    },
    [user?.uid]
  );

  // Auto-fill recurring transactions on month change
  useEffect(() => {
    if (!data || !data.recurringTemplates || data.recurringTemplates.length === 0) return;
    const now = new Date();
    const cmKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    if (data.lastAutoFillMonth === cmKey) return;
    const range = monthRange(now.getFullYear(), now.getMonth());
    const existing = data.transactions.filter(
      (t) => t.date >= range.start && t.date <= range.end
    );
    const toAdd = [];
    let nid = data.nextId;
    data.recurringTemplates
      .filter((t) => t.active !== false)
      .forEach((tpl) => {
        const already = existing.some(
          (t) =>
            t.category === tpl.category &&
            t.type === tpl.type &&
            Math.abs(t.amount - tpl.amount) < 0.01 &&
            t.recurring === tpl.id
        );
        if (!already) {
          toAdd.push({
            id: nid++,
            date: dateString(now.getFullYear(), now.getMonth(), 1),
            type: tpl.type,
            category: tpl.category,
            currencyCode: tpl.currencyCode,
            amount: tpl.amount,
            description: tpl.description || '',
            recurring: tpl.id,
          });
        }
      });
    if (toAdd.length > 0) {
      update((p) => ({
        ...p,
        transactions: [...p.transactions, ...toAdd],
        nextId: nid,
        lastAutoFillMonth: cmKey,
      }));
    } else {
      update((p) => ({ ...p, lastAutoFillMonth: cmKey }));
    }
  }, [data?.recurringTemplates, data?.lastAutoFillMonth, data?.nextId, update]);

  const logout = async () => {
    await signOut(auth);
    setTab('overview');
  };

  const saveApiKey = useCallback(
    async (key) => {
      if (!user?.uid) return;
      const updated = { ...profile, anthropicApiKey: key };
      await saveProfile(user.uid, updated);
      setProfile(updated);
    },
    [user?.uid, profile]
  );

  const incomeCategories = useMemo(
    () => (data ? flattenCategories(data.incomeGroups) : []),
    [data?.incomeGroups]
  );
  const expenseCategories = useMemo(
    () => (data ? flattenCategories(data.expenseGroups) : []),
    [data?.expenseGroups]
  );
  const notifications = useMemo(() => (data ? generateNotifications(data) : []), [data]);
  const apiKey = profile?.anthropicApiKey || '';

  if (user === undefined || (user && !data)) {
    return (
      <ThemeProvider>
        <div className="boot-loading">Loading…</div>
      </ThemeProvider>
    );
  }
  if (!user) {
    return (
      <ThemeProvider>
        <Auth />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Shell
        auth={user}
        data={data}
        tab={tab}
        setTab={setTab}
        notifications={notifications}
        onLogout={logout}
      >
        {tab === 'setup' && (
          <SetupTab
            data={data}
            update={update}
            anthropicApiKey={apiKey}
            onSaveApiKey={saveApiKey}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsTab
            data={data}
            update={update}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            apiKey={apiKey}
          />
        )}
        {tab === 'overview' && (
          <OverviewTab
            data={data}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
          />
        )}
        {tab === 'goals' && <GoalsTab data={data} update={update} />}
      </Shell>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Fix `auth.name` references in Shell/Sidebar**

From the grep output in Step 1, find any `auth.name` usage and replace with `auth.displayName`. If `auth.provider` is referenced, replace with `'google'` (or omit it — all users are Google users now).

Common pattern to find and fix in `src/components/Shell.jsx` or `src/components/Sidebar.jsx`:
```jsx
// Before:
auth.name
// After:
auth.displayName

// Before:
auth.provider === 'google'
// After:
true  (or just remove the condition)
```

- [ ] **Step 4: Add `apiKey` prop to `src/tabs/TransactionsTab.jsx`**

Open `src/tabs/TransactionsTab.jsx`. Find the function signature:
```jsx
export default function TransactionsTab({ data, update, incomeCategories, expenseCategories }) {
```
Replace with:
```jsx
export default function TransactionsTab({ data, update, incomeCategories, expenseCategories, apiKey }) {
```

Find the `<SmartInput` JSX element in `TransactionsTab.jsx` and add the `apiKey` prop:
```jsx
<SmartInput data={data} onConfirm={handleConfirm} apiKey={apiKey} />
```
(The existing prop names may differ slightly — preserve all existing props and add `apiKey={apiKey}`.)

- [ ] **Step 5: Verify the build compiles**

```
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors. (Firebase will init but data calls will fail gracefully if `.env.local` isn't filled in yet — that's fine at this stage.)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/Shell.jsx src/components/Sidebar.jsx src/tabs/TransactionsTab.jsx
git commit -m "feat: wire Firebase auth and Firestore into App.jsx"
```

---

### Task 10: Add AI Settings section to `src/tabs/SetupTab.jsx`

**Files:**
- Modify: `src/tabs/SetupTab.jsx`

- [ ] **Step 1: Add `anthropicApiKey`, `onSaveApiKey` to the function signature**

Find:
```jsx
export default function SetupTab({ data, update }) {
```
Replace with:
```jsx
export default function SetupTab({ data, update, anthropicApiKey, onSaveApiKey }) {
```

- [ ] **Step 2: Add state for the API key input**

Add these three lines alongside the existing `useState` calls near the top of the `SetupTab` function body (after the existing `const [newIncomeGroup, setNewIncomeGroup] = useState('')` lines):

```jsx
const [apiKeyInput, setApiKeyInput] = useState(anthropicApiKey || '');
const [keySaved, setKeySaved] = useState(false);

const handleSaveKey = async () => {
  await onSaveApiKey(apiKeyInput.trim());
  setKeySaved(true);
  setTimeout(() => setKeySaved(false), 3000);
};
```

- [ ] **Step 3: Add the AI Settings card**

Find the closing `</div>` of the outer `<div className="app-section">` container (the very last `</div>` before the closing `)`  of the `return`). Insert this block immediately before it:

```jsx
      <div className="card" style={{ borderLeft: '3px solid var(--ai)', marginBottom: 16 }}>
        <span className="eyebrow ai">Anthropic API Key</span>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, marginBottom: 10 }}>
          Used for AI transaction parsing. Stored in your account — only sent directly to Anthropic.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type="password"
            placeholder="sk-ant-..."
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              setKeySaved(false);
            }}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            className="btn primary"
            onClick={handleSaveKey}
            disabled={!apiKeyInput.trim()}
          >
            Save
          </button>
        </div>
        {keySaved && (
          <p style={{ color: 'var(--positive)', fontSize: 12, marginTop: 8 }}>API key saved.</p>
        )}
      </div>
```

- [ ] **Step 4: Verify build still passes**

```
npm run build 2>&1 | tail -10
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/SetupTab.jsx
git commit -m "feat: add AI Settings section to SetupTab for Anthropic API key"
```

---

### Task 11: Update `vite.config.js` and delete `server/proxy.js`

**Files:**
- Modify: `vite.config.js` (full replacement)
- Delete: `server/proxy.js`

- [ ] **Step 1: Replace the entire contents of `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/**/*.test.{js,jsx}'],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**', 'legacy/**'],
  },
});
```

- [ ] **Step 2: Run the full test suite**

```
npm test
```
Expected: all tests pass. (The proxy plugin was dev-server-only; no tests depended on it.)

- [ ] **Step 3: Delete `server/proxy.js`**

```bash
git rm server/proxy.js
```

If `server/` is now empty, also remove it:
```bash
rmdir server 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add vite.config.js
git commit -m "chore: remove Vite proxy plugin and server/proxy.js (replaced by Netlify function)"
```

---

### Task 12: Update `landing/index.html`

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 1: Update the nav "Get Started" CTA (line 387)**

Find:
```html
  <a class="btn-primary" href="#get-started">Get Started →</a>
```
Replace with:
```html
  <a class="btn-primary" href="https://cashflowtracker.net">Open the App →</a>
```

- [ ] **Step 2: Update the hero CTA (line 397)**

Find:
```html
      <a class="btn-primary btn-lg" href="#get-started">Run It Locally →</a>
```
Replace with:
```html
      <a class="btn-primary btn-lg" href="https://cashflowtracker.net">Open the App →</a>
```

- [ ] **Step 3: Replace the How It Works section content (lines 484–511)**

Find the entire block:
```html
    <h2 class="section-heading">Up and running in 3 steps</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h3>Clone &amp; Install</h3>
        <div class="code-block"><code>git clone &lt;repo&gt;
cd "Cashflow app"
npm install</code></div>
        <p>Node 18+ required. Takes about 30 seconds.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h3>Add API Key (optional)</h3>
        <div class="code-block"><code>cp .env.example .env
# paste your Anthropic key
ANTHROPIC_API_KEY=sk-ant-...</code></div>
        <p>Skip this to use local-only parsing — works great without AI.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h3>Launch</h3>
        <div class="code-block"><code>npm run dev
# or double-click
Start CashFlow.bat</code></div>
        <p>Opens at http://localhost:5173. Start tracking immediately.</p>
      </div>
    </div>
```

Replace with:
```html
    <h2 class="section-heading">Up and running in seconds</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h3>Sign in with Google</h3>
        <p>One click. No account setup, no password to remember.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h3>Your data is ready</h3>
        <p>If you used the local app, import your history in one tap.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h3>Start tracking</h3>
        <p>Works on phone, tablet, and desktop — no installation required.</p>
      </div>
    </div>
```

- [ ] **Step 4: Update the get-started section (lines 557–561)**

Find:
```html
    <h2 class="section-heading" style="color:#fff">Ready to track your money quietly?</h2>
    <p style="color:rgba(255,255,255,0.8);font-size:1.1rem;margin-bottom:2rem">Free, private, and runs entirely on your machine.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn-white btn-lg" href="mailto:bghrph@gmail.com?subject=CashFlow%20Tracker">Request a Copy →</a>
    </div>
```

Replace with:
```html
    <h2 class="section-heading" style="color:#fff">Ready to track your money quietly?</h2>
    <p style="color:rgba(255,255,255,0.8);font-size:1.1rem;margin-bottom:2rem">Free, private, and syncs across all your devices.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn-white btn-lg" href="https://cashflowtracker.net">Open the App →</a>
    </div>
```

- [ ] **Step 5: Open `landing/index.html` directly in a browser and verify**

Double-click `landing/index.html` to open it. Check:
- Nav button reads "Open the App →"
- Hero button reads "Open the App →"
- How-it-works shows 3 new steps with no code blocks, no git clone, no npm install
- Get-started section says "syncs across all your devices" and links to cashflowtracker.net

- [ ] **Step 6: Commit**

```bash
git add landing/index.html
git commit -m "feat: update landing page CTA and how-it-works for hosted app"
```

---

### Task 13: Final cleanup

**Files:**
- Modify: `.gitignore` (verify `.env.local` is excluded)

- [ ] **Step 1: Verify `.env.local` is in `.gitignore`**

```bash
grep "\.env\.local" .gitignore
```

If the line is missing, add it:
```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 2: Run the full test suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Run a final production build**

```
npm run build 2>&1 | tail -15
```
Expected: build succeeds, `dist/` is populated.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: ensure .env.local is gitignored"
```

---

## Manual Steps After Code Is Complete

These require Firebase and Netlify accounts and cannot be done in code:

1. **Create Firebase project** — console.firebase.google.com → Add project → Add web app → copy the config object values into Netlify env vars
2. **Enable Google Sign-In** — Firebase Console → Authentication → Sign-in method → Google → Enable
3. **Deploy Firestore rules** — `npx firebase-tools login` then `npx firebase-tools deploy --only firestore:rules` from the project root
4. **Connect to Netlify** — Push code to GitHub, then Netlify → New site → import from GitHub
5. **Set env vars in Netlify** — Site Settings → Environment Variables → add the four `VITE_FIREBASE_*` values
6. **Add custom domain** — Netlify → Domain settings → `cashflowtracker.net`
7. **Add DNS records at registrar** — A record: `@` → `75.2.60.5`; CNAME: `www` → `your-site.netlify.app`
8. **Add authorised domain in Firebase** — Authentication → Settings → Authorised Domains → add `cashflowtracker.net`
9. **Local dev with functions** — Use `npx netlify dev` instead of `npm run dev` so `/.netlify/functions/parse` is served locally
