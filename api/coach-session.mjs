// POST /api/coach-session { voice: 'male' | 'female' }
// Starts a private voice-coach conversation (ElevenLabs) for a signed-in
// Premium member. The ElevenLabs key stays here; the app only gets a
// single-use signed address, valid for 15 minutes.
// Monthly allowance: COACH_SESSIONS_PER_MONTH (default 20), counted on the
// member's Clerk account, so ElevenLabs minutes stay under control.
import { json, handle, httpError, hasPremium } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';

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
    const voiceId = (voice === 'female' ? process.env.ELEVENLABS_VOICE_FEMALE : process.env.ELEVENLABS_VOICE_MALE) || '';

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
