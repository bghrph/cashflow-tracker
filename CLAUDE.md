# Project: CashFlow Tracker

## What this project does
A personal finance tracker that uses local NLP + Claude AI to parse plain-English transaction entries. Hosted at cashflowtracker.net with Google authentication and per-user Firestore cloud storage.

## Current status (as of 2026-05-27)
- Full hosting migration complete (local Vite app → Netlify + Firebase)
- Google Sign-In working via Firebase Auth
- Firestore data storage working (per-user isolation)
- Netlify Function AI proxy working (user brings own Anthropic key)
- All 51 unit tests passing
- Auto-deploy on every git push to main

## Architecture overview
- `src/components/` → UI components (Auth, Shell, SmartInput, etc.)
- `src/tabs/` → Tab-level pages (Overview, Transactions, Goals, Setup)
- `src/engine/` → Parsing logic (NLPParser, HybridParser, AIParser, promptTemplate)
- `src/lib/` → Utilities (firebase.js, firestore.js, storage.js, categories, currencies, dates, migrate, notifications, theme)
- `src/styles/` → CSS (tokens.css, globals.css, components.css)
- `netlify/functions/` → Serverless AI proxy (parse.js — receives x-api-key header, calls Anthropic)
- `landing/` → Static landing page (not served by Netlify — separate file)
- `tests/e2e/` → TestCafe end-to-end tests
- `src/tests/` → Vitest unit tests

## Data flow
- Auth: Browser → Firebase signInWithPopup(GoogleAuthProvider) → onAuthStateChanged in App.jsx
- Data: Browser ↔ Firestore at users/{uid}/appdata/main (single doc per user)
- Profile (incl. Anthropic key): users/{uid} document
- AI parse: Browser → POST /.netlify/functions/parse with x-api-key header → Anthropic API

## Deployment
- Hosting: Netlify (cashflow-tracker-408.netlify.app → cashflowtracker.net)
- Repo: https://github.com/bghrph/cashflow-tracker
- Deploy: git push main → Netlify CI → npm run build → CDN + Function deployed
- Firebase project: cashflowtracker-a3dbe
- Env vars: Set in Netlify dashboard (VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID)

## Important decisions made
- BYOK (Bring Your Own Key): each user provides their own Anthropic API key, stored in their Firestore profile — no shared server key
- Single Firestore document per user for app state (mirrors old localStorage approach, keeps code changes minimal)
- Netlify Functions instead of Vite dev proxy — key is sent as x-api-key header, never stored server-side
- isApiKeyConfigured(apiKey) is synchronous (format check only: startsWith('sk-ant-')) — actual validation happens when Netlify function calls Anthropic
- Cross-Origin-Opener-Policy set to same-origin-allow-popups — required for Firebase signInWithPopup to work
- firebase.json added for Firebase CLI rule deployment

## Next steps
1. Deploy Firestore security rules via CLI: `npx firebase-tools login && npx firebase-tools deploy --only firestore:rules --project cashflowtracker-a3dbe`
2. Test AI parsing end-to-end (add Anthropic key in Setup tab → try Smart Input)
3. Test first-login localStorage migration (open on a device that had the old local app)
4. Add Firestore indexes if queries slow down with large transaction sets

## How to run locally
```
npm install
npm run dev
```
Note: For local dev the Netlify AI proxy is not available. Local NLP parsing works without any setup. For AI parsing locally, you'd need to run `netlify dev` instead of `npm run dev`.

## How to run tests
```
npx vitest run          # unit tests (51 tests)
npm run test:e2e        # TestCafe e2e tests
```
