// OpenRouter chat completion that returns parsed JSON.
// Free models are often rate-limited upstream, so each call walks the model
// list (primary first) and, if every model is busy, waits and tries once more.

import { config } from './config.js';
import { log } from './log.js';

const RETRY_WAIT_MS = 20000;

export function aiAvailable() {
  return !!config.openRouterKey;
}

class RetryableError extends Error {}

async function callModel(model, prompt, temperature) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fighthub-swart.vercel.app',
      'X-Title': 'FightHub Worker'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a careful combat sports editor. You reply with a single JSON object and nothing else.' },
        { role: 'user', content: prompt }
      ],
      temperature
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    // 429 = rate limited, 5xx = provider trouble: worth trying another model
    if (res.status === 429 || res.status >= 500) {
      throw new RetryableError(`${model} ${res.status} (${describeLimit(detail)})`);
    }
    throw new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new RetryableError(`${model}: ${data.error.message || 'provider error'}`);
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new RetryableError(`${model}: empty reply`);
  return { json: parseJsonObject(text), model: data.model || model };
}

export async function askJson(prompt, { temperature = 0.3 } = {}) {
  const failures = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      log(`  (all models busy: ${failures.join('; ')}; waiting ${RETRY_WAIT_MS / 1000}s)`);
      await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
    }
    for (const model of config.models) {
      try {
        return await callModel(model, prompt, temperature);
      } catch (err) {
        if (!(err instanceof RetryableError) && !(err instanceof SyntaxError)) throw err;
        failures.push(err.message);
      }
    }
  }
  throw new Error(`No model available: ${failures.slice(-3).join('; ')}`);
}

// Distinguish "this free model is busy right now" from "your account's daily
// free-model allowance is used up", which need different fixes.
function describeLimit(body) {
  try {
    const err = JSON.parse(body).error || {};
    const text = `${err.message || ''} ${err.metadata?.raw || ''}`;
    if (/free-models-per-day|per day|daily/i.test(text)) return 'DAILY FREE LIMIT REACHED';
    if (/upstream|temporarily/i.test(text)) return 'model busy upstream';
    return text.trim().slice(0, 120) || 'rate limited';
  } catch {
    return body.slice(0, 120);
  }
}

// Models sometimes wrap JSON in prose or code fences; take the outermost object.
function parseJsonObject(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError(`AI reply had no JSON object: ${text.slice(0, 120)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}
