// Minimal Supabase REST client. Content tables store each record as { id, doc }.

import { config } from './config.js';
import { log } from './log.js';

function headers(extra = {}) {
  const h = { apikey: config.supabaseKey, 'Content-Type': 'application/json', ...extra };
  // Legacy JWT keys also go in Authorization; new sb_secret_/sb_publishable_ keys are apikey-only.
  if (config.supabaseKey.startsWith('eyJ')) h.Authorization = `Bearer ${config.supabaseKey}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers)
  });
  if (!res.ok) {
    throw new Error(`Supabase ${options.method || 'GET'} ${path.split('?')[0]} failed: ${res.status} ${await res.text()}`);
  }
  // Writes with "return=minimal" reply 201/204 with an empty body
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

export async function getAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await request(`${table}?select=id,doc&order=id`, {
      headers: { Range: `${from}-${from + 999}` }
    });
    rows.push(...page.map(r => ({ ...r.doc, id: r.id })));
    if (page.length < 1000) break;
  }
  return rows;
}

// Insert or replace records. Skipped (logged only) in dry-run mode.
export async function upsert(table, items) {
  if (!items.length) return;
  const now = new Date().toISOString();
  const rows = items.map(item => ({
    id: item.id,
    doc: { ...item, createdAt: item.createdAt || now, updatedAt: now }
  }));
  if (config.dryRun) {
    log(`  [dry-run] would upsert ${rows.length} into ${table}: ${rows.map(r => r.id).join(', ')}`);
    return;
  }
  await request(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

// Small JSON documents that let long jobs resume where they left off
export async function getState(key) {
  const rows = await request(`worker_state?select=value&key=eq.${encodeURIComponent(key)}`);
  return rows?.[0]?.value || null;
}

export async function setState(key, value) {
  if (config.dryRun) return;
  await request('worker_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

export async function startRun() {
  if (config.dryRun) return null;
  const [row] = await request('ai_runs?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({})
  });
  return row.id;
}

export async function finishRun(id, ok, summary, logText) {
  if (config.dryRun || id === null) return;
  await request(`ai_runs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ finished_at: new Date().toISOString(), ok, summary, log: logText.slice(-50000) })
  });
}
