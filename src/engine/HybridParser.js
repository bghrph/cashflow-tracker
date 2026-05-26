// Hybrid orchestrator. Routes between the local NLP parser and the Claude API
// parser based on the user's preference and the local parser's confidence.

import { parseTransactions } from './NLPParser.js';
import { aiParse, AIParserError, isApiKeyConfigured } from './AIParser.js';

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
        // Single-word capitalization heuristic from NLP fallback path
        /^[A-Z][a-z]+$/.test(r.category))
  );
}

export async function hybridParse(text, data, options = {}) {
  const preference = VALID_PREFERENCES.has(options.preference)
    ? options.preference
    : data.aiPreference || 'fallback';
  const apiKey = options.apiKey || '';
  const hasApiKey = isApiKeyConfigured(apiKey);

  // Mode: local only
  if (preference === 'local' || !hasApiKey) {
    return tagSource(parseTransactions(text, data), 'local');
  }

  // Mode: always AI
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

  // Mode: fallback (default). Try local first.
  const local = parseTransactions(text, data);
  if (!looksUncertain(local)) {
    return tagSource(local, 'local');
  }

  // Local is uncertain → ask AI on the whole input (cleaner merge semantics).
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
