// Coach memory: a short summary of the member's last few coach chats, so the
// coach can follow up ("how did the switch kicks go?"). ElevenLabs writes the
// summary after each call; it is kept here (private metadata, up to 3) and can
// be cleared by the member at any time.
// Shape: { items: [{ at: ISO date, text }], pending: [conversation ids] }

export const MEMORY_ITEMS = 3;
export const validConversationId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(id);

// The summary of one finished conversation: { at, text }, null if not ready yet,
// or false if it can't be used (unknown, another agent, failed or expired)
export async function fetchSummary(key, agent, id) {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}`, { headers: { 'xi-api-key': key } });
  if (res.status === 404) return false;
  if (!res.ok) return null; // try again next time
  const c = await res.json();
  if (c.agent_id && c.agent_id !== agent) return false;
  if (c.status === 'failed') return false;
  const text = (c.analysis?.transcript_summary || '').trim();
  if (c.status !== 'done' || !text) return c.status === 'done' ? false : null;
  const started = c.metadata?.start_time_unix_secs;
  return { at: new Date(started ? started * 1000 : Date.now()).toISOString(), text: text.replace(/\s+/g, ' ').slice(0, 400) };
}

// Turns finished conversations into memory items (newest last)
export async function resolveMemory(key, agent, memory) {
  const items = [...(memory?.items || [])];
  const pending = [];
  for (const id of memory?.pending || []) {
    let result = null;
    try { result = await fetchSummary(key, agent, id); } catch { result = null; }
    if (result) items.push(result);
    else if (result === null) pending.push(id);
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  return { items: items.slice(-MEMORY_ITEMS), pending: pending.slice(-5) };
}

// What the coach is told: "Mon 29 Sep: ... | Wed 1 Oct: ..."
export function memoryText(items) {
  if (!items?.length) return 'No previous conversations yet.';
  return items.map(i => `${new Date(i.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${i.text}`).join(' | ');
}
