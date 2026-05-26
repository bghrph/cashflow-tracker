# CashFlow Tracker

Personal finance tracker with a hybrid local + Claude AI transaction parser. Quiet Wealth edition.

This is v5 — a full Vite/React rewrite of the original `CashFlow_Tracker.jsx` / `CashFlow_Tracker.html` monolith. All features from v4 are preserved; the AI Smart Input now calls Claude (Haiku 4.5) for natural-language transaction parsing.

> The original files are preserved under `legacy/` and still open directly in a browser (legacy/CashFlow_Tracker.html).

## Features

- **16-currency support** with cross-conversion
- **Hybrid AI parser** — fast on-device NLP first, Claude AI when input is ambiguous
- **Budget targets** with 4 rollover modes per category (none / full / limited / accumulate)
- **Recurring templates** that auto-add on the 1st of each month
- **Savings goals** with budget-surplus auto-sweep
- **Financial health score** (4 metrics, 25% each: savings, adherence, consistency, goals)
- **Smart notifications** (over-budget, 80% warning, weekly recap, savings opportunity)
- **5 chart types** — area trend, income/expense donuts, budget bars, day-of-week heatmap, recurring detection
- **Light + dark theme** with editorial typography (Fraunces + Inter)
- **Inline editing** + search + CSV export
- **Local-first storage** (uses the same `mbr-data-v4` key as v4 — data from the legacy build carries over)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and paste your Anthropic API key
npm run dev
```

Open http://localhost:5173.

## Getting an Anthropic API key

1. Visit https://console.anthropic.com
2. Settings → API Keys → Create Key
3. Paste into `.env` as `ANTHROPIC_API_KEY=sk-ant-...`
4. Restart the dev server

The key lives only in `.env` and is read by the **Vite dev-server proxy** (`server/proxy.js`). It is never bundled into the client and never reaches the browser.

## Project layout

```
.
├── legacy/                    # Original v4 files preserved
├── public/                    # Static assets (favicon)
├── server/
│   └── proxy.js               # Vite middleware → Anthropic API
├── src/
│   ├── lib/                   # Pure logic: currencies, dates, budget, health, notifications, …
│   ├── engine/                # Parsing: NLPParser, AIParser, HybridParser, promptTemplate
│   ├── components/            # Shared React: icons, AnimatedNumber, Sidebar, SmartInput, …
│   ├── tabs/                  # SetupTab, TransactionsTab, OverviewTab, GoalsTab
│   ├── styles/                # tokens.css + globals.css + components.css
│   ├── tests/                 # Vitest unit tests
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── .env.example               # Template
├── .env                       # Real key (gitignored)
└── package.json
```

## How the hybrid parser works

```
User types in Smart Input
        │
        ▼
preference = "local"     ─────► NLPParser only         (instant, free)
preference = "always"    ─────► AIParser only          (best on messy input)
preference = "fallback"  (default):
        │
        ▼
   Run NLPParser (pattern matching)
        │
        ├─ Confident? (no warnings, no "Other …" categories)
        │    YES → return local results, "Local" badge
        │    NO  → fall through to AI
        ▼
   Run AIParser (POST /api/parse → Claude Haiku 4.5)
        │
        ├─ Success → return AI results, "AI" badge
        └─ Failure → graceful fallback to local results + warning toast
```

Switch the mode in **Setup → AI Smart Input Mode**.

## AI prompt caching

The Claude system prompt is split into:

1. **Static prefix** (~700 tokens) — instructions, format spec, examples
2. **Variable tail** — your categories + today's date + primary currency

The static prefix is marked with `cache_control: { type: 'ephemeral' }` so subsequent calls within ~5 minutes pay only the per-call delta. First call pays the full price.

## Switching the AI model

Edit `.env`:

```env
ANTHROPIC_MODEL=claude-sonnet-4-6
# or
ANTHROPIC_MODEL=claude-haiku-4-5-20251001   # default
# or
ANTHROPIC_MODEL=claude-opus-4-7
```

Haiku 4.5 is the recommended default — sub-second latency for transaction parsing, much cheaper per call than Sonnet/Opus. Switch to Sonnet 4.6 if you find Haiku missing edge cases in your particular phrasing.

## Test cases that exercise the AI path

| Input | Expected behavior |
|---|---|
| `Salary 5000, rent 1500` | Local fast-path — no API call |
| `Paid Ahmed for fixing the AC unit 350` | Local has unknown cat → AI fills in Maintenance |
| `My tenant gave me 3 months rent at 2000 each` | AI fans out into 3 × $2,000 Rental Income |
| `Split dinner with Sarah, my half was 45` | AI extracts just $45 Dining Out |
| `Returned the jacket, got $80 back` | AI classifies as Income / Refunds |
| `Property tax for duplex 3200, water bill 85, HOA 250` | AI categorizes all 3 correctly |
| (no API key set) | AI Parse button disabled with tooltip |
| (proxy down mid-call) | Falls back to local results + warning toast |

## Commands

```bash
npm run dev          # Dev server with HMR + AI proxy
npm run build        # Production build → dist/
npm run preview      # Preview the production build
npm test             # Run Vitest unit tests (28 tests)
npm run test:watch   # Watch mode
```

## Production deployment notes

The included Vite middleware only runs in dev mode. For production, lift the contents of `server/proxy.js` into:

- **Cloudflare Workers** (recommended — edge-cached, fast)
- **Vercel Function** at `/api/parse`
- **A small Express/Hono server** behind your static host

The client only ever calls `POST /api/parse`, so swapping the backend is a one-line change.

## Design system: Quiet Wealth

- **Typography:** Fraunces (display, variable, optical sizing) + Inter (body)
- **Palette:** warm off-white #FAFAF7 / warm ink #0E0E10, emerald #0A6B4E + copper #B7791F accents
- **Numerals:** tabular figures everywhere — financial columns align cleanly
- **Layout:** sidebar + content (desktop) / collapsible + bottom nav (mobile)
- **Effects:** soft shadows, no glass morphism, light/dark theme toggle (top-right)

## Data

All data is stored in `localStorage` under the key `mbr-data-v4`. To wipe and start fresh:

```js
localStorage.removeItem('mbr-data-v4');
localStorage.removeItem('mbr-auth-v4');
```

## Out of scope (intentionally)

- Backend sync / multi-device — local-only by design
- Push notifications, biometric login, home-screen widgets
- Production hosting of the proxy (you can lift it onto Cloudflare/Vercel)
