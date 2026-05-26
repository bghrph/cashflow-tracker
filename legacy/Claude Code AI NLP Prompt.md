# Claude Code Prompt: Add AI-Powered NLP to CashFlow Tracker

## Paste this entire prompt into Claude Code after your project is set up.

-----

## Context

I have a personal finance tracker called “Monthly Budget Review” (CashFlow Tracker). It’s a React single-page app (currently 1,147 lines in one JSX file) with these features:

- 16-currency support with cross-conversion
- Transaction management (add, edit, delete, search, sort, CSV export)
- Budget targets with 4 rollover types per expense category
- Recurring transactions (auto-generate monthly)
- Savings goals with budget surplus sweep
- Smart notifications (4 alert types)
- Financial health score (4 metrics, 25% each)
- 5 chart types (donut, bar, area, heatmap, radial gauge)
- Monthly savings target with progress tracking
- Carbon & Gold design system (Syne + Outfit fonts, glass morphism, grain texture)

It currently has an on-device NLP parser (pattern matching, no API) in the Log tab called “AI Smart Input” that lets users type natural language like “Salary 5000, rent 1500, groceries 80 yesterday” and it parses them into structured transactions. The parser uses:

- `splitInput()` - splits on commas, semicolons, newlines, “and”
- `extractAmount()` - regex for $X, Xk, word numbers
- `resolveDate()` / `extractDateFromSeg()` - handles “today”, “yesterday”, “last friday”, “3 days ago”, “march 5”
- `classifyType()` - 28 income signals + 28 expense signals
- `matchCategory()` - 96-keyword dictionary mapping (uber→Transport, netflix→Subscriptions, etc.), checks existing user categories first, auto-creates new ones
- `parseTransactions()` - orchestrator

This parser passes 106 functional tests across 10 test categories.

## Task

Add a **hybrid AI fallback** to the existing NLP parser. The architecture should be:

### How it should work:

1. User types natural language text in the Smart Input box
1. **First pass**: Run the existing pattern matching parser (instant, free, offline)
1. **Confidence check**: If the pattern matcher successfully extracted amount AND category for all segments, use those results (fast path)
1. **AI fallback**: If ANY segment has warnings (no amount found), unknown category, or the user explicitly clicks an “AI Parse” button, send the text to the Claude API for intelligent parsing
1. Show results in the same preview table UI, with an indicator showing which entries came from pattern matching vs AI

### Claude API integration details:

- Use the Anthropic SDK (`@anthropic-ai/sdk`)
- Model: `claude-sonnet-4-20250514`
- The API call should send a system prompt that instructs Claude to return ONLY valid JSON with this structure:

```json
{
  "transactions": [
    {
      "type": "Income" | "Expense",
      "category": "string",
      "amount": number,
      "date": "YYYY-MM-DD",
      "description": "original text segment"
    }
  ],
  "warnings": ["string"]
}
```

- The system prompt should include the user’s existing category list so Claude maps to existing categories when possible
- The system prompt should include today’s date for relative date resolution
- The API key should be stored in a `.env` file (ANTHROPIC_API_KEY), never hardcoded
- Add error handling: if the API call fails, fall back to pattern matching results with a warning toast

### System prompt for the API call:

```
You are a financial transaction parser. Parse the user's natural language text into structured transactions.

Rules:
- Extract each transaction with: type (Income/Expense), category, amount, date, description
- Use these existing categories when possible: [INSERT USER'S CATEGORIES]
- If no existing category matches, suggest a new descriptive category name
- Today's date is [INSERT TODAY]. Resolve relative dates (yesterday, last friday, 3 days ago, etc.)
- Default to Expense if unclear whether income or expense
- Default to today's date if no date mentioned
- If a segment has no amount, include it in warnings
- Handle typos, slang, abbreviations naturally
- Handle complex phrases like "split dinner, my half was $45" or "3 months rent from tenant"
- Currency: always use [INSERT PRIMARY CURRENCY]
- Return ONLY valid JSON, no other text, no markdown, no backticks

The user manages: rental properties, medical practice, legal work. So terms like "retainer", "copay", "tenant", "lease" are common.
```

### UI changes needed:

1. Add an “AI Parse” button next to the existing “Parse” button (different color, maybe purple/violet)
1. When AI is processing, show a loading spinner with “AI analyzing…”
1. In the preview table, add a small badge on each row: “AI” (purple) or “Local” (gold) to show which parser handled it
1. Add a settings toggle somewhere (maybe Setup tab) for “Always use AI” vs “AI as fallback only” vs “Local only”
1. Store the AI preference in the app’s data model

### Important constraints:

- DO NOT remove the existing pattern matching parser. It stays as the primary/fast path
- DO NOT break any existing features. All 106 NLP tests should still pass
- The AI call should be async with proper loading states
- Handle rate limits and API errors gracefully
- The API key should NEVER be committed to Git (add .env to .gitignore)
- Keep the app working without an API key (pattern matching only mode)

### File structure (after project is split into modules):

```
src/
  engine/
    NLPParser.js          (existing pattern matching - keep as is)
    AIParser.js           (NEW - Claude API integration)
    HybridParser.js       (NEW - orchestrator that tries local first, AI fallback)
  components/
    SmartInput.jsx        (update with AI button, loading states, source badges)
    SettingsPanel.jsx     (add AI preference toggle)
```

### Testing:

After implementation, run these test cases to verify:

1. “Salary 5000, rent 1500” → should use local parser (fast path), no API call
1. “Paid Ahmed for fixing the AC unit 350” → local parser may fail on category, AI fallback should handle it
1. “My tenant gave me 3 months rent at 2000 each” → AI should create 3 transactions of $2,000 each
1. “Split dinner with Sarah, my half was 45” → AI should parse $45 Dining Out
1. “Returned the jacket, got $80 back” → AI should classify as Income/Refund
1. “Property tax for duplex 3200, water bill 85, HOA 250” → AI should categorize all three correctly
1. No API key set → app works normally with local parser only, AI button disabled with tooltip “Set API key in settings”
1. API fails/timeout → falls back to local results with warning toast

### Environment variables:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Note: For a client-side app, the API key will be visible in the browser. For production, you’d want a small backend proxy. For personal use this is fine. Add a comment noting this.

-----

## Summary

Build a hybrid NLP system where the fast local parser handles simple inputs and the Claude API handles complex natural language that the pattern matcher can’t parse. Both paths feed into the same preview UI. The user can choose their preference. Everything should degrade gracefully if the API is unavailable.