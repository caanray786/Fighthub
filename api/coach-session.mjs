// POST /api/coach-session { voice: 'male' | 'female', lang: 'en' | 'es' | ... }
// Starts a private voice-coach conversation (ElevenLabs) for a signed-in
// Premium member. The ElevenLabs key stays here; the app only gets a
// single-use signed address, valid for 15 minutes.
// Usage limits keep ElevenLabs and OpenRouter costs under control:
// - COACH_SESSIONS_PER_MONTH (default 12), counted on the member's Clerk account
// - COACH_MINUTES per session (default 10); the app ends the conversation then.
//   Also set the agent's "Max conversation duration" in ElevenLabs to match,
//   which enforces it on ElevenLabs' side.
import { json, handle, httpError, hasPremium } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';
import { resolveMemory, memoryText } from './_lib/coach-memory.mjs';

// ---- Coach voice and language ----
// The app asks for the member's chosen voice and language, which need the
// agent's "voice" and "language" overrides switched on. If they are off, they
// are switched on here: the agent's full settings are read, only those switches
// are changed, and everything is sent back unchanged. If that cannot be done,
// the agent's default voice and language are used.
const AGENTS = 'https://api.elevenlabs.io/v1/convai/agents/';
const OVERRIDES = { tts: 'voice_id', agent: 'language' };
// Remembered for 10 minutes while the server stays warm
let agentInfo = null, checkedAt = 0;

export async function coachAgentSettings(key, agent, { fresh = false } = {}) {
  if (!fresh && agentInfo && Date.now() - checkedAt < 600000) return agentInfo;
  checkedAt = Date.now();
  const headers = { 'xi-api-key': key, 'Content-Type': 'application/json' };
  const url = AGENTS + encodeURIComponent(agent);
  const read = async () => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`agent settings ${r.status}`); return r.json(); };
  const switches = cfg => cfg?.platform_settings?.overrides?.conversation_config_override || {};
  const allOn = cfg => Object.entries(OVERRIDES).every(([part, name]) => switches(cfg)[part]?.[name] === true);
  try {
    let cfg = await read();
    if (!allOn(cfg)) {
      const settings = structuredClone(cfg.platform_settings || {});
      settings.overrides ??= {};
      settings.overrides.conversation_config_override ??= {};
      const wanted = settings.overrides.conversation_config_override;
      for (const [part, name] of Object.entries(OVERRIDES)) wanted[part] = { ...(wanted[part] || {}), [name]: true };
      const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ platform_settings: settings }) });
      if (res.ok) cfg = await read();
      if (!allOn(cfg)) console.warn(`Coach: voice and language overrides not switched on (${res.status})`);
    }
    // The languages the agent can speak: its main one plus any added in "Additional languages"
    const languages = [cfg.conversation_config?.agent?.language || 'en', ...Object.keys(cfg.conversation_config?.language_presets || {})];
    agentInfo = { voice: switches(cfg).tts?.voice_id === true, language: switches(cfg).agent?.language === true, languages };
  } catch (err) {
    console.warn(`Coach: agent settings check failed (${err.message}); using the default voice and language`);
    agentInfo = { voice: false, language: false, languages: ['en'] };
  }
  return agentInfo;
}

export const voiceOverrideAllowed = async (...args) => (await coachAgentSettings(...args)).voice;

// The agent's code for the member's language (for example "pt" may be set up
// as "pt-br"), or '' when the agent has not been given that language.
export function agentLanguage(info, lang) {
  if (!lang || lang === 'en' || !info.language) return '';
  return info.languages.find(code => code.toLowerCase() === lang || code.toLowerCase().startsWith(lang + '-')) || '';
}

// A private conversation address from ElevenLabs (valid 15 minutes). If
// ElevenLabs refuses, its reason is passed on so the problem can be fixed.
export async function getSignedUrl(key, agent) {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`, {
    headers: { 'xi-api-key': key }
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !data.signed_url) {
    const reason = data.detail?.message || (typeof data.detail === 'string' ? data.detail : '') || data.message || text.slice(0, 200) || `error ${res.status}`;
    throw httpError(502, `Voice service: ${reason}`);
  }
  return data.signed_url;
}

const setting = (name, fallback) => Math.max(1, parseInt(process.env[name] || '', 10) || fallback);
const allowance = () => setting('COACH_SESSIONS_PER_MONTH', 12);
const sessionMinutes = () => setting('COACH_MINUTES', 10);

export async function POST(request) {
  return handle(async () => {
    const key = process.env.ELEVENLABS_API_KEY, agent = process.env.ELEVENLABS_AGENT_ID;
    if (!key || !agent) throw httpError(503, 'The coach is being set up. Please try again soon.');
    const member = await memberFromRequest(request);
    const user = await getClerkUser(member.id);
    if (!hasPremium(user.public_metadata?.premium)) throw httpError(402, 'Your voice coach is part of Fight Hub Premium.');

    const month = new Date().toISOString().slice(0, 7);
    const used = user.private_metadata?.coach?.month === month ? user.private_metadata.coach.sessions || 0 : 0;
    const limit = allowance();
    if (used >= limit) throw httpError(429, `You’ve used all ${limit} coach sessions this month. They reset on the 1st.`);

    const { voice, lang } = await request.json().catch(() => ({}));
    const chosen = (voice === 'female' ? process.env.ELEVENLABS_VOICE_FEMALE : process.env.ELEVENLABS_VOICE_MALE) || '';
    const settings = await coachAgentSettings(key, agent);
    const voiceId = chosen && settings.voice ? chosen : '';
    const language = agentLanguage(settings, String(lang || '').toLowerCase());

    const signedUrl = await getSignedUrl(key, agent);

    // Coach memory: collect summaries of earlier chats that have finished processing
    let memory = user.private_metadata?.coachMemory || { items: [], pending: [] };
    if (memory.pending?.length) memory = await resolveMemory(key, agent, memory);

    const usage = { month, sessions: used + 1, limit };
    await updateClerkMetadata(member.id, {
      private_metadata: { coach: usage, coachMemory: memory },
      public_metadata: { coachUsage: usage, coachMemoryCount: memory.items.length }
    });
    return json({ signedUrl, voiceId, language, remaining: limit - usage.sessions, limit, maxMinutes: sessionMinutes(), memory: memoryText(memory.items) });
  });
}
