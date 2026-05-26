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
