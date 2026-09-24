// OpenRouter chat completion that returns parsed JSON.

import { config } from './config.js';

export function aiAvailable() {
  return !!config.openRouterKey;
}

export async function askJson(prompt, { temperature = 0.3 } = {}) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fighthub-swart.vercel.app',
      'X-Title': 'FightHub Worker'
    },
    body: JSON.stringify({
      model: config.models[0],
      models: config.models, // fallbacks, tried in order
      messages: [
        { role: 'system', content: 'You are a careful combat sports editor. You reply with a single JSON object and nothing else.' },
        { role: 'user', content: prompt }
      ],
      temperature
    })
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { json: parseJsonObject(text), model: data.model };
}

// Models sometimes wrap JSON in prose or code fences; take the outermost object.
function parseJsonObject(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`AI reply had no JSON object: ${text.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}
