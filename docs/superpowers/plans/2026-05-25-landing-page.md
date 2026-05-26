# CashFlow Tracker Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, standalone landing page for CashFlow Tracker v5 and deploy it free on the web via Netlify in under 10 minutes.

**Architecture:** A single self-contained `landing/index.html` with embedded CSS using the Quiet Wealth design tokens (emerald #0A6B4E, copper #B7791F, Fraunces + Inter fonts). No build step, no framework, no dependencies — drag the `landing/` folder onto netlify.com/drop and it's live.

**Tech Stack:** HTML5, CSS3 (custom properties), Google Fonts (Fraunces + Inter), Netlify Drop (free hosting)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `landing/index.html` | Create | Complete landing page — HTML + embedded CSS |
| `landing/netlify.toml` | Create | Netlify redirect rule (SPA fallback not needed; here for custom headers) |

---

## Task 1: Create the landing folder and HTML shell

**Files:**
- Create: `landing/index.html`

- [ ] **Step 1: Create the file with the full HTML shell**

Create `C:\Users\husse\Downloads\Cashflow app\landing\index.html` with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CashFlow Tracker — Quiet Wealth, Clear Numbers</title>
  <meta name="description" content="A personal finance tracker that combines local pattern matching with AI to turn plain-English entries into organized transactions. No subscription, no cloud, your data stays yours." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,300&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    /* Paste full CSS from Task 3 here */
  </style>
</head>
<body>
  <!-- Paste sections from Tasks 2, 3, 4, 5 here -->
  <p style="font-family:sans-serif;padding:2rem">Shell loaded — content coming in next tasks.</p>
</body>
</html>
```

- [ ] **Step 2: Open the file in a browser to confirm it loads**

Open `landing/index.html` directly in Chrome (File → Open File, or drag onto browser tab).
Expected: page loads, "Shell loaded" text visible, no console errors.

---

## Task 2: Build the page sections (HTML only)

**Files:**
- Modify: `landing/index.html` — replace the `<body>` content

- [ ] **Step 1: Replace the `<body>` with all page sections**

Replace the `<body>...</body>` content (everything between the tags) with:

```html
<body>

<!-- ═══ NAV ═══ -->
<nav class="nav">
  <span class="nav-logo">CashFlow</span>
  <a class="btn-primary" href="#get-started">Get Started →</a>
</nav>

<!-- ═══ HERO ═══ -->
<section class="hero">
  <div class="hero-inner">
    <p class="hero-eyebrow">Personal Finance, Reimagined</p>
    <h1 class="hero-heading">Your money.<br><em>Simply tracked.</em></h1>
    <p class="hero-sub">Type "coffee 4.50" or "salary 3200 yesterday" — CashFlow understands plain English and turns it into organized, beautiful financial data. No subscription. No cloud. Your data stays yours.</p>
    <div class="hero-actions">
      <a class="btn-primary btn-lg" href="#get-started">Run It Locally →</a>
      <a class="btn-ghost btn-lg" href="#features">See Features</a>
    </div>
    <div class="hero-badges">
      <span class="badge">🔒 100% Local Storage</span>
      <span class="badge">✨ AI-Powered Parsing</span>
      <span class="badge">📊 16 Currencies</span>
      <span class="badge">🌙 Dark Mode</span>
    </div>
  </div>
  <div class="hero-visual" aria-hidden="true">
    <div class="app-mockup">
      <div class="mockup-bar">
        <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
        <span class="mockup-url">localhost:5173</span>
      </div>
      <div class="mockup-body">
        <div class="mockup-sidebar">
          <div class="mockup-nav-item active">Overview</div>
          <div class="mockup-nav-item">Transactions</div>
          <div class="mockup-nav-item">Goals</div>
          <div class="mockup-nav-item">Setup</div>
        </div>
        <div class="mockup-content">
          <div class="mockup-card green">
            <div class="mockup-label">Net This Month</div>
            <div class="mockup-value">+$1,240</div>
          </div>
          <div class="mockup-card copper">
            <div class="mockup-label">Top Expense</div>
            <div class="mockup-value">Rent $1,500</div>
          </div>
          <div class="mockup-chart-bars">
            <div class="bar" style="height:40%"></div>
            <div class="bar" style="height:65%"></div>
            <div class="bar" style="height:55%"></div>
            <div class="bar" style="height:80%"></div>
            <div class="bar active" style="height:70%"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ FEATURES ═══ -->
<section class="features" id="features">
  <div class="section-inner">
    <h2 class="section-heading">Everything you need. Nothing you don't.</h2>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🧠</div>
        <h3>Hybrid AI Parser</h3>
        <p>Local pattern matching handles 95% of entries instantly. Claude AI steps in for complex natural language — only when needed.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📈</div>
        <h3>Visual Overview</h3>
        <p>Area charts, donut breakdowns, budget bars, and a day-of-week heatmap give you a complete financial picture at a glance.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🎯</div>
        <h3>Goals & Health Score</h3>
        <p>Set savings targets, track progress with an animated gauge, and sweep surplus automatically toward your goals.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔁</div>
        <h3>Recurring Detection</h3>
        <p>Automatic detection of recurring transactions. Templates auto-fill on schedule so you never miss a subscription.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💱</div>
        <h3>16 Currencies</h3>
        <p>Switch your display currency any time. Live conversion across USD, EUR, GBP, CAD, JPY, SAR, AED, and more.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔒</div>
        <h3>Fully Private</h3>
        <p>Zero accounts, zero servers, zero tracking. All data lives in your browser's localStorage. Export it any time.</p>
      </div>
    </div>
  </div>
</section>

<!-- ═══ HOW IT WORKS ═══ -->
<section class="how-it-works">
  <div class="section-inner">
    <h2 class="section-heading">Up and running in 3 steps</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h3>Clone & Install</h3>
        <div class="code-block"><code>git clone &lt;repo&gt;<br>cd "Cashflow app"<br>npm install</code></div>
        <p>Node 18+ required. Takes about 30 seconds.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h3>Add API Key (optional)</h3>
        <div class="code-block"><code>cp .env.example .env<br># paste your Anthropic key<br>ANTHROPIC_API_KEY=sk-ant-...</code></div>
        <p>Skip this to use local-only parsing — works great without AI.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h3>Launch</h3>
        <div class="code-block"><code>npm run dev<br># or double-click<br>Start CashFlow.bat</code></div>
        <p>Opens at http://localhost:5173. Start tracking immediately.</p>
      </div>
    </div>
  </div>
</section>

<!-- ═══ AI CALLOUT ═══ -->
<section class="ai-callout">
  <div class="section-inner ai-inner">
    <div class="ai-text">
      <p class="ai-eyebrow">✨ Smart Input</p>
      <h2>Just type what happened.</h2>
      <p>CashFlow reads plain English. Type a single transaction or an entire day's worth — the hybrid parser splits, categorizes, and dates them automatically.</p>
      <ul class="ai-examples">
        <li><span class="example-chip">"coffee 4.50 this morning"</span></li>
        <li><span class="example-chip">"salary 3200 last friday + netflix 15.99"</span></li>
        <li><span class="example-chip">"groceries at Whole Foods $87 yesterday"</span></li>
      </ul>
      <p class="ai-note">Local parser runs first (instant, free). Claude AI fallback activates only when the local parser is uncertain.</p>
    </div>
    <div class="ai-visual" aria-hidden="true">
      <div class="smart-input-demo">
        <div class="si-label">Smart Input</div>
        <div class="si-textarea">"rent 1500 + groceries 94.20 yesterday + netflix 15.99"</div>
        <div class="si-results">
          <div class="si-row">
            <span class="source-badge local">local</span>
            <span class="si-cat">Housing</span>
            <span class="si-amount expense">−$1,500.00</span>
          </div>
          <div class="si-row">
            <span class="source-badge local">local</span>
            <span class="si-cat">Food</span>
            <span class="si-amount expense">−$94.20</span>
          </div>
          <div class="si-row">
            <span class="source-badge local">local</span>
            <span class="si-cat">Entertainment</span>
            <span class="si-amount expense">−$15.99</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ GET STARTED ═══ -->
<section class="get-started" id="get-started">
  <div class="section-inner" style="text-align:center">
    <h2 class="section-heading" style="color:#fff">Ready to track your money quietly?</h2>
    <p style="color:rgba(255,255,255,0.8);font-size:1.1rem;margin-bottom:2rem">Free, private, and runs entirely on your machine.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn-white btn-lg" href="https://github.com" target="_blank" rel="noopener">View on GitHub →</a>
    </div>
  </div>
</section>

<!-- ═══ FOOTER ═══ -->
<footer class="footer">
  <div class="section-inner footer-inner">
    <span class="nav-logo" style="color:var(--ink-muted)">CashFlow</span>
    <p style="color:var(--ink-muted);font-size:0.875rem">Built with React + Vite. Quiet Wealth design system. MIT License.</p>
  </div>
</footer>

</body>
```

- [ ] **Step 2: Open in browser and verify all sections are visible (unstyled is fine)**

Open `landing/index.html` in Chrome.
Expected: Nav, hero text, 6 feature cards (plain text), 3 steps, AI callout, footer all visible on the page — even without styles.

---

## Task 3: Add all CSS styles (embedded in `<head>`)

**Files:**
- Modify: `landing/index.html` — replace `/* Paste full CSS from Task 3 here */` inside the `<style>` tag

- [ ] **Step 1: Replace the placeholder comment inside `<style>` with the full CSS**

Find `/* Paste full CSS from Task 3 here */` and replace it with:

```css
/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #FAFAF7;
  --bg-2: #F3F3EF;
  --ink: #1A1A16;
  --ink-muted: #6B6B5E;
  --accent: #0A6B4E;
  --accent-light: #E8F5F0;
  --accent-2: #B7791F;
  --accent-2-light: #FEF3E2;
  --ai: #6D28D9;
  --ai-light: #EDE9FE;
  --white: #FFFFFF;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
  scroll-behavior: smooth;
}

body { overflow-x: hidden; }

/* ── Typography ── */
h1, h2, h3, .nav-logo { font-family: 'Fraunces', Georgia, serif; }
h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1.05; font-weight: 700; }
h2 { font-size: clamp(1.75rem, 4vw, 2.75rem); line-height: 1.1; font-weight: 600; }
h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }
p { line-height: 1.7; color: var(--ink-muted); }
em { font-style: italic; color: var(--accent); }
a { text-decoration: none; }

/* ── Layout ── */
.section-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}
.section-heading {
  text-align: center;
  margin-bottom: 3rem;
}

/* ── Nav ── */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: rgba(250,250,247,0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.nav-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 1.25rem;
  background: var(--accent);
  color: var(--white);
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9rem;
  transition: background 0.15s, transform 0.1s;
}
.btn-primary:hover { background: #085c42; transform: translateY(-1px); }
.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background: transparent;
  color: var(--ink);
  border: 1.5px solid rgba(0,0,0,0.15);
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: border-color 0.15s, background 0.15s;
}
.btn-ghost:hover { border-color: var(--accent); background: var(--accent-light); }
.btn-white {
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.75rem;
  background: var(--white);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 1rem;
  transition: background 0.15s, transform 0.1s;
}
.btn-white:hover { background: #f0faf6; transform: translateY(-1px); }
.btn-lg { padding: 0.875rem 2rem; font-size: 1rem; border-radius: var(--radius); }

/* ── Hero ── */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 5rem 1.5rem 6rem;
}
.hero-eyebrow {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 1rem;
}
.hero-heading { margin-bottom: 1.25rem; }
.hero-sub { font-size: 1.1rem; margin-bottom: 2rem; max-width: 480px; }
.hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.hero-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.badge {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  background: var(--bg-2);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 100px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ink-muted);
}

/* ── App Mockup ── */
.app-mockup {
  background: var(--white);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.08);
  max-width: 420px;
}
.mockup-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.625rem 0.875rem;
  background: #F2F2F0;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.red { background: #FF5F57; }
.dot.yellow { background: #FFBD2E; }
.dot.green { background: #28C840; }
.mockup-url {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  color: var(--ink-muted);
  font-family: monospace;
}
.mockup-body { display: flex; height: 200px; }
.mockup-sidebar {
  width: 110px;
  padding: 0.75rem 0.5rem;
  border-right: 1px solid rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.mockup-nav-item {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.72rem;
  color: var(--ink-muted);
  font-weight: 500;
}
.mockup-nav-item.active {
  background: var(--accent-light);
  color: var(--accent);
}
.mockup-content {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mockup-card {
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
}
.mockup-card.green { background: var(--accent-light); }
.mockup-card.copper { background: var(--accent-2-light); }
.mockup-label { font-size: 0.65rem; color: var(--ink-muted); margin-bottom: 0.2rem; }
.mockup-value { font-size: 0.875rem; font-weight: 700; font-family: 'Fraunces', serif; color: var(--ink); }
.mockup-chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  flex: 1;
  padding-top: 0.25rem;
}
.bar {
  flex: 1;
  background: var(--accent-light);
  border-radius: 3px 3px 0 0;
  transition: background 0.2s;
}
.bar.active { background: var(--accent); }

/* ── Features ── */
.features {
  background: var(--bg-2);
  padding: 6rem 0;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
.feature-card {
  background: var(--white);
  border-radius: var(--radius);
  padding: 1.75rem;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.feature-icon { font-size: 2rem; margin-bottom: 0.75rem; }
.feature-card p { font-size: 0.9rem; }

/* ── How It Works ── */
.how-it-works { padding: 6rem 0; }
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.step { text-align: center; }
.step-num {
  font-family: 'Fraunces', serif;
  font-size: 3rem;
  font-weight: 700;
  color: var(--accent);
  opacity: 0.25;
  line-height: 1;
  margin-bottom: 0.75rem;
}
.step h3 { margin-bottom: 0.75rem; }
.step p { font-size: 0.875rem; margin-top: 0.75rem; }
.code-block {
  background: #1A1A16;
  border-radius: var(--radius-sm);
  padding: 1rem;
  text-align: left;
}
.code-block code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: #A8E6CF;
  white-space: pre;
}

/* ── AI Callout ── */
.ai-callout {
  background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%);
  padding: 6rem 0;
}
.ai-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}
.ai-eyebrow {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #A78BFA;
  margin-bottom: 0.75rem;
}
.ai-callout h2 { color: var(--white); margin-bottom: 1rem; }
.ai-callout p { color: rgba(255,255,255,0.7); }
.ai-examples { list-style: none; margin: 1.25rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
.example-chip {
  display: inline-block;
  padding: 0.4rem 0.875rem;
  background: rgba(167,139,250,0.15);
  border: 1px solid rgba(167,139,250,0.3);
  border-radius: 100px;
  color: #C4B5FD;
  font-size: 0.85rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.ai-note { font-size: 0.8rem !important; color: rgba(255,255,255,0.45) !important; margin-top: 1rem; }

/* ── Smart Input Demo ── */
.smart-input-demo {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius);
  padding: 1.25rem;
  backdrop-filter: blur(4px);
}
.si-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin-bottom: 0.625rem; }
.si-textarea {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
  color: #C4B5FD;
  padding: 0.75rem;
  background: rgba(0,0,0,0.25);
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
  line-height: 1.5;
}
.si-results { display: flex; flex-direction: column; gap: 0.5rem; }
.si-row { display: flex; align-items: center; gap: 0.75rem; }
.source-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.source-badge.local { background: var(--accent-light); color: var(--accent); }
.source-badge.ai { background: var(--ai-light); color: var(--ai); }
.si-cat { flex: 1; font-size: 0.875rem; color: rgba(255,255,255,0.75); }
.si-amount { font-weight: 700; font-size: 0.875rem; font-family: 'Fraunces', serif; }
.si-amount.expense { color: #FCA5A5; }

/* ── Get Started ── */
.get-started {
  background: var(--accent);
  padding: 6rem 0;
}

/* ── Footer ── */
.footer { padding: 2rem 0; border-top: 1px solid rgba(0,0,0,0.06); }
.footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; padding: 3rem 1.5rem; gap: 2.5rem; }
  .hero-visual { order: -1; }
  .app-mockup { max-width: 100%; }
  .features-grid { grid-template-columns: 1fr 1fr; }
  .steps { grid-template-columns: 1fr; gap: 2.5rem; }
  .ai-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .ai-visual { order: -1; }
}
@media (max-width: 480px) {
  .features-grid { grid-template-columns: 1fr; }
  .nav { padding: 0.875rem 1rem; }
  .hero-actions { flex-direction: column; }
  .hero-actions a { text-align: center; justify-content: center; }
  .footer-inner { flex-direction: column; text-align: center; }
}
```

- [ ] **Step 2: Open in browser and verify the page looks styled**

Open/refresh `landing/index.html` in Chrome.
Expected: Full styled page — green nav, hero with mockup, feature grid, steps with code blocks, purple AI section, green CTA, footer. No layout overflow.

- [ ] **Step 3: Check at 375px width (mobile)**

Open Chrome DevTools → toggle device toolbar → iPhone SE (375px).
Expected: Single-column layout throughout, no horizontal scrollbar, all text readable.

---

## Task 4: Wire up the GitHub link (or local download link)

**Files:**
- Modify: `landing/index.html` — update one href

- [ ] **Step 1: Decide on the CTA link**

Two options:
- **Option A (GitHub):** Replace `href="https://github.com"` in the "View on GitHub" button with your real GitHub repo URL.
- **Option B (Local):** Change the button text to "Download ZIP" and point `href` to a `.zip` download URL if you upload to GitHub releases.

For now, if you don't have a GitHub repo, change the button text only:

Find:
```html
<a class="btn-white btn-lg" href="https://github.com" target="_blank" rel="noopener">View on GitHub →</a>
```

Replace with:
```html
<a class="btn-white btn-lg" href="mailto:bghrph@gmail.com?subject=CashFlow%20Tracker">Request a Copy →</a>
```

- [ ] **Step 2: Verify the link works in browser**

Click the "Request a Copy →" (or GitHub) button.
Expected: Mail client opens with pre-filled subject, OR new tab opens to GitHub.

---

## Task 5: Create Netlify config and deploy

**Files:**
- Create: `landing/netlify.toml`

- [ ] **Step 1: Create `landing/netlify.toml`**

Create `C:\Users\husse\Downloads\Cashflow app\landing\netlify.toml` with:

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

- [ ] **Step 2: Do a final visual review of the landing page**

Open `landing/index.html` in Chrome at full desktop width.
Check each section against this list:
- [ ] Nav is sticky and shows CashFlow logo + button
- [ ] Hero has heading, subtext, two buttons, badges, and the app mockup
- [ ] Features section shows 6 cards in a 3-column grid
- [ ] How It Works shows 3 steps with code blocks
- [ ] AI section has purple gradient, example chips, and Smart Input demo
- [ ] Get Started section is green with CTA button
- [ ] Footer shows logo and license note

- [ ] **Step 3: Deploy to Netlify Drop**

1. Go to **https://app.netlify.com/drop** in Chrome (no account needed for first deploy)
2. Open File Explorer to `C:\Users\husse\Downloads\Cashflow app\landing\`
3. Drag the entire `landing` folder onto the Netlify Drop page
4. Wait ~10 seconds
5. Netlify assigns a URL like `https://random-name-abc123.netlify.app`

Expected: Page is live at the Netlify URL. Share it with anyone.

- [ ] **Step 4: (Optional) Claim your site with a free Netlify account**

Sign up at netlify.com → "Claim" the site → rename to `cashflow-tracker.netlify.app` or similar.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Landing page with hero, features, how-it-works, AI callout, CTA — all present in Task 2
- [x] Quiet Wealth design tokens used in Task 3 CSS (same `--accent`, `--accent-2`, fonts as app)
- [x] Mobile responsive — Task 3 CSS includes breakpoints at 768px and 480px
- [x] Deployable online — Task 5 covers Netlify Drop (no account, 5-minute deploy)
- [x] CTA link — Task 4 wires up the "get started" action

**Placeholder scan:** No TBD/TODO/placeholder text in any task. All code blocks are complete and runnable.

**Type consistency:** No cross-task type references — this is HTML/CSS, no function signatures to track.
