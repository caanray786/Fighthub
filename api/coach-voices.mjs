// GET /api/coach-voices: which ElevenLabs voices the coach is set up to use,
// with each voice's name, gender and accent, so a wrong voice ID is easy to spot.
// - male / female: ELEVENLABS_VOICE_MALE / ELEVENLABS_VOICE_FEMALE in Vercel
// - agentDefault: the agent's own voice (used when no voice is chosen)
// - languageVoices: voices set for particular languages in the agent
// Shows voice names and IDs only (not secret); never the API key.
import { json, handle, httpError } from './_lib/http.mjs';

const API = 'https://api.elevenlabs.io/v1/';

async function voiceInfo(key, id) {
  if (!id) return { set: false };
  const res = await fetch(`${API}voices/${encodeURIComponent(id)}`, { headers: { 'xi-api-key': key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data.detail?.message || (typeof data.detail === 'string' ? data.detail : '') || `error ${res.status}`;
    return { set: true, id, problem: res.status === 404 ? 'No voice with this ID in your ElevenLabs account' : `ElevenLabs: ${reason}` };
  }
  const l = data.labels || {};
  return { set: true, id, name: data.name, gender: l.gender || '', accent: l.accent || '', age: l.age || '', category: data.category || '' };
}

export async function GET() {
  return handle(async () => {
    const key = process.env.ELEVENLABS_API_KEY, agent = process.env.ELEVENLABS_AGENT_ID;
    if (!key || !agent) throw httpError(503, 'The coach is not set up.');
    const res = await fetch(`${API}convai/agents/${encodeURIComponent(agent)}`, { headers: { 'xi-api-key': key } });
    const cfg = res.ok ? await res.json() : {};
    const tts = cfg.conversation_config?.tts || {};
    const presets = cfg.conversation_config?.language_presets || {};
    const switches = cfg.platform_settings?.overrides?.conversation_config_override || {};
    const male = process.env.ELEVENLABS_VOICE_MALE || '', female = process.env.ELEVENLABS_VOICE_FEMALE || '';
    const languageVoices = {};
    for (const [code, p] of Object.entries(presets)) {
      const id = p?.overrides?.tts?.voice_id;
      if (id) languageVoices[code] = await voiceInfo(key, id);
    }
    return json({
      male: await voiceInfo(key, male),
      female: await voiceInfo(key, female),
      sameVoiceForBoth: !!male && male === female,
      agentDefault: await voiceInfo(key, tts.voice_id),
      agentModel: tts.model_id || '',
      agentLanguages: [cfg.conversation_config?.agent?.language || 'en', ...Object.keys(presets)],
      languageVoices,
      appMayChooseVoice: switches.tts?.voice_id === true,
      appMayChooseLanguage: switches.agent?.language === true,
      agentReadable: res.ok
    }, 200, { 'Cache-Control': 'public, s-maxage=60' });
  });
}
