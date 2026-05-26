# CashFlow Tracker — Hosted Web App Design

**Date:** 2026-05-25
**Status:** Approved for implementation

---

## Goal

Transform CashFlow Tracker v5 from a local Vite dev-server app into a fully hosted web application at `cashflowtracker.net`, accessible from any device, with Google authentication and per-user cloud data storage.

---

## Decisions Made

| Question | Decision |
|---|---|
| Who pays for AI? | Each user provides their own Anthropic API key |
| Domain | `cashflowtracker.net` — already purchased |
| Database | Firebase Firestore |
| Auth | Firebase Google OAuth |
| AI proxy | Netlify Function (not Vercel) |

---

## Architecture

Three parallel data flows, no backend server:

**① Login flow**
Browser → `signInWithPopup(GoogleAuthProvider)` → Firebase Auth → Google Identity → JWT returned → app unlocks

**② Data flow**
Browser ↔ Firestore via Firebase SDK directly. Each user's data lives at `users/{uid}/appdata`. Security rules enforce strict per-user isolation — no user can read or write another's documents.

**③ AI Parse flow**
Browser reads user's Anthropic key from memory (loaded from Firestore on login) → POST to `/.netlify/functions/parse` with key in `X-Api-Key` header → Netlify Function forwards request to Anthropic API → result returned. Key is never logged or stored server-side.

---

## Data Layer

### Firestore Structure

```
users/ (collection)
  └── {uid} (document — profile fields stored directly here)
        ├── email: string
        ├── displayName: string
        ├── photoURL: string
        ├── createdAt: timestamp
        ├── anthropicApiKey: string?   ← user's own key, optional
        │
        └── appdata/ (subcollection)
              └── main (document — single doc per user)
                    ├── transactions: array
                    ├── budget: object
                    ├── recurring: array
                    ├── goals: array
                    ├── categoryGroups: array
                    ├── currency: string
                    ├── aiPreference: string   ← 'local' | 'fallback' | 'always'
                    ├── savingsTarget: number
                    └── updatedAt: timestamp
```

**Firestore paths in code:**
- Profile: `doc(db, 'users', uid)` — read/write profile fields directly on this document
- App data: `doc(db, 'users', uid, 'appdata', 'main')` — single document in the `appdata` subcollection

**Why one document for appdata?** The app always reads and writes its full state at once — identical to how it uses localStorage today. A single document keeps code changes minimal. Firestore's 1 MB limit comfortably holds ~5,000+ transactions.

### Firestore Security Rules

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

### First-Login Migration

On first login the app checks Firestore for an existing `appdata` document:
- **Found** → load from Firestore (returning user), skip migration
- **Not found** → check localStorage for `mbr-data-v4`
  - **Found** → show one-time prompt: "Import your existing data?"
    - Yes → write to Firestore, then clear localStorage only after confirmed write
    - No → start fresh
  - **Not found** → start fresh

Existing data is never discarded. The user always chooses.

### Anthropic API Key Flow

1. User navigates to Setup tab → "AI Settings" section → pastes `sk-ant-...` key → clicks Save
2. Key saved to `profile.anthropicApiKey` in Firestore (encrypted at rest by Google)
3. On app load, key is read once into memory alongside profile data
4. On AI Parse: key sent as `X-Api-Key` header to Netlify Function → forwarded to Anthropic → never logged

---

## File Changes

### Deleted / Replaced

| File | Replacement |
|---|---|
| `server/proxy.js` | `netlify/functions/parse.js` |
| `src/lib/storage.js` | `src/lib/firestore.js` |
| `src/components/Auth.jsx` | New Auth.jsx (Google Sign-In only) |
| `.env` / `.env.example` | Netlify dashboard env vars |
| `Start CashFlow.bat` | Not needed — hosted |
| Vite proxy config in `vite.config.js` | Removed |

### New Files

| File | Purpose |
|---|---|
| `netlify/functions/parse.js` | Serverless AI proxy — receives `X-Api-Key` header, calls Anthropic |
| `src/lib/firebase.js` | Initialises Firebase app, exports `auth` and `db` |
| `src/lib/firestore.js` | Drop-in replacement for `storage.js` — same `loadData(uid)`/`saveData(uid, data)` API signature (uid added), reads/writes Firestore |
| `firestore.rules` | Security rules (deploy via Firebase CLI) |
| `netlify.toml` | Build config + security headers + function directory |

### Modified Files

| File | Change |
|---|---|
| `src/App.jsx` | Replace `storage.js` import with `firestore.js`; add `onAuthStateChanged` listener (unauthenticated → show Auth screen; authenticated → load profile + run migration check + load appdata into state); pass `uid` and `anthropicApiKey` through app state |
| `src/components/Auth.jsx` | Full replacement — Google Sign-In popup only, no email/password |
| `src/tabs/SetupTab.jsx` | Add "AI Settings" section with password input for Anthropic API key |
| `src/engine/AIParser.js` | Change endpoint from `/api/parse` to `/.netlify/functions/parse`; read key from app state and send as `X-Api-Key` header |
| `package.json` | Add `firebase` SDK; add `@netlify/functions` dev dep |
| `landing/index.html` | Update hero CTA and how-it-works section (see below) |

### Untouched (80% of the app)

All tabs (OverviewTab, TransactionsTab, GoalsTab, SetupTab logic), NLPParser, HybridParser, promptTemplate, all `src/lib/` modules except storage.js, all CSS, all icons, all Recharts components, all Vitest tests, and all TestCafe E2E infrastructure.

---

## New Auth Screen

Replaces the current email/password form. Single centred card:

```
CashFlow
Quiet Wealth, Clear Numbers

[ 🔵 Continue with Google ]

Your data is private · syncs across all your devices
```

Implementation: `signInWithPopup(auth, new GoogleAuthProvider())`. On success, Firebase returns a user object with `uid`, `email`, `displayName`, `photoURL`. App creates the `profile` document if it doesn't exist, then runs the migration check.

---

## Netlify Function — AI Proxy

**File:** `netlify/functions/parse.js`

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

  const { text, systemPrompt } = JSON.parse(event.body);
  const client = new Anthropic({ apiKey });

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
};
```

---

## Deployment

### Pipeline

```
git push main → Netlify CI → npm run build (~45s) → CDN + Function deployed
```

### Build Settings (netlify.toml)

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

### DNS Records (add at domain registrar)

| Type | Name | Value |
|---|---|---|
| A | @ | 75.2.60.5 |
| CNAME | www | your-site.netlify.app |

SSL certificate issued automatically by Netlify (Let's Encrypt) within ~60 seconds of DNS propagation.

**Firebase authorised domain:** Add `cashflowtracker.net` in Firebase Console → Authentication → Settings → Authorised Domains. Required for Google login to work on the custom domain.

### Environment Variables (set in Netlify Dashboard — not in .env)

```
VITE_FIREBASE_API_KEY        = AIza...
VITE_FIREBASE_AUTH_DOMAIN    = cashflowtracker-xyz.firebaseapp.com
VITE_FIREBASE_PROJECT_ID     = cashflowtracker-xyz
VITE_FIREBASE_APP_ID         = 1:123456:web:abc...
```

`VITE_` prefix exposes vars to the browser bundle. Firebase public config is safe to expose — security is enforced by Firestore rules and Auth, not by hiding these keys. No `ANTHROPIC_API_KEY` — users bring their own.

---

## Landing Page Update

**Hero CTA:**
- Before: "Run It Locally →" (links to #get-started with npm install steps)
- After: "Open the App →" (links to `https://cashflowtracker.net`)

**How It Works section — rewrite from 3 technical steps to:**
1. **Sign in with Google** — one click, no account setup
2. **Your data is ready** — if you used the local app, import it in one tap
3. **Start tracking** — works on phone, tablet, desktop, anywhere

**Remove entirely:** All copy mentioning `git clone`, `npm install`, `node`, `.env`, or `Start CashFlow.bat`.

---

## What Is Not In Scope

- Multi-user sharing or collaboration
- Billing or subscription management
- Push notifications
- Offline support (the hosted app requires an internet connection)
- Admin dashboard
- Data export (already exists in the app via existing UI)
