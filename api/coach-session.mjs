// POST /api/coach-session { voice: 'male' | 'female' }
// Starts a private voice-coach conversation (ElevenLabs) for a signed-in
// Premium member. The ElevenLabs key stays here; the app only gets a
// single-use signed address, valid for 15 minutes.
// Monthly allowance: COACH_SESSIONS_PER_MONTH (default 20), counted on the
// member's Clerk account, so ElevenLabs minutes stay under control.
import { json, handle, httpError, hasPremium } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';

// ---- Male/female coach voice ----
// The app asks for the member's chosen voice, which needs the agent's "voice
// override" switched on. If it is off, it is switched on here: the agent's full
// settings are read, only that one switch is changed, and everything is sent
// back unchanged. If that cannot be done, the agent's default voice is used.
const AGENTS = 'https://api.elevenlabs.io/v1/convai/agents/';
// Remembered while the server stays warm: "on" for good, "off" for 10 minutes
let voiceOverride = null, checkedAt = 0;

export async function voiceOverrideAllowed(key, agent, { fresh = false } = {}) {
  if (fresh) voiceOverride = null;
  if (voiceOverride === true || (voiceOverride === false && Date.now() - checkedAt < 600000)) return voiceOverride;
  checkedAt = Date.now();
  const headers = { 'xi-api-key': key, 'Content-Type': 'application/json' };
  const url = AGENTS + encodeURIComponent(agent);
  const read = async () => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`agent settings ${r.status}`); return r.json(); };
  const allowed = cfg => cfg?.platform_settings?.overrides?.conversation_config_override?.tts?.voice_id === true;
  try {
    const cfg = await read();
    if (allowed(cfg)) return (voiceOverride = true);
    const settings = structuredClone(cfg.platform_settings || {});
    settings.overrides ??= {};
    settings.overrides.conversation_config_override ??= {};
    settings.overrides.conversation_config_override.tts = { ...(settings.overrides.conversation_config_override.tts || {}), voice_id: true };
    const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ platform_settings: settings }) });
    voiceOverride = res.ok && allowed(await read());
    if (!voiceOverride) console.warn(`Coach: voice override not switched on (${res.status}); using the default voice`);
  } catch (err) {
    console.warn(`Coach: voice override check failed (${err.message}); using the default voice`);
    voiceOverride = false;
  }
  return voiceOverride;
}

const allowance = () => Math.max(1, parseInt(process.env.COACH_SESSIONS_PER_MONTH || '20', 10) || 20);

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

    const { voice } = await request.json().catch(() => ({}));
    const chosen = (voice === 'female' ? process.env.ELEVENLABS_VOICE_FEMALE : process.env.ELEVENLABS_VOICE_MALE) || '';
    const voiceId = chosen && (await voiceOverrideAllowed(key, agent)) ? chosen : '';

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`, {
      headers: { 'xi-api-key': key }
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { signed_url: signedUrl } = await res.json();

    const usage = { month, sessions: used + 1, limit };
    await updateClerkMetadata(member.id, { private_metadata: { coach: usage }, public_metadata: { coachUsage: usage } });
    return json({ signedUrl, voiceId, remaining: limit - usage.sessions, limit });
  });
}
