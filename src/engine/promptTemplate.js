// Builds the system prompt for the Claude API parser. The system prompt is
// designed to be cache-friendly: the static instruction block sits at the top,
// the variable context (categories, today, currency) is appended as a stable
// suffix so the prefix remains hot in prompt cache for the whole session.

const STATIC_INSTRUCTIONS = `You are a financial transaction parser. Parse the user's natural language text into structured transactions.

Return ONLY valid JSON in this exact shape, with no markdown, no backticks, no commentary:

{
  "transactions": [
    {
      "type": "Income" | "Expense",
      "category": "string",
      "amount": number,
      "date": "YYYY-MM-DD",
      "description": "string (original segment)"
    }
  ],
  "warnings": ["string"]
}

Rules:
- Default to Expense when ambiguous; default to today's date when no date is mentioned.
- If a segment has no resolvable amount, omit it from transactions and add a warning string.
- Resolve relative dates: "yesterday", "last friday", "3 days ago", "march 5", "12/14", etc.
- Handle typos, slang, abbreviations naturally.
- Handle complex phrases:
  - "split dinner, my half was 45" → one Expense $45 (Dining Out)
  - "3 months rent at 2000 each from tenant" → three Income $2000 entries (Rental Income)
  - "returned the jacket, got 80 back" → one Income $80 (Refunds)
- Map to existing categories when possible; otherwise suggest a short descriptive new name.

Context: the user manages rental properties, a medical practice, and legal work, so terms like "retainer", "copay", "tenant", "lease", "settlement", "deposition" are common.`;

export function buildSystemPrompt({ categories, today, primaryCurrency }) {
  const incomeList = (categories?.income || []).join(', ') || '(none)';
  const expenseList = (categories?.expense || []).join(', ') || '(none)';
  return `${STATIC_INSTRUCTIONS}

Today is ${today}.
Primary currency: ${primaryCurrency}.

User's existing income categories: ${incomeList}.
User's existing expense categories: ${expenseList}.`;
}

export const STATIC_PROMPT_PREFIX = STATIC_INSTRUCTIONS;
