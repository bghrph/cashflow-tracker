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
