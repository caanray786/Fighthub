// POST /api/coach-memory { conversationId } after a coach chat ends, or { forget: true }.
// The conversation's summary is collected at the start of the member's next
// chat (ElevenLabs needs a moment to write it).
import { json, handle, httpError } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';
import { validConversationId } from './_lib/coach-memory.mjs';

export async function POST(request) {
  return handle(async () => {
    const member = await memberFromRequest(request);
    const body = await request.json().catch(() => ({}));
    if (body.forget === true) {
      await updateClerkMetadata(member.id, { private_metadata: { coachMemory: { items: [], pending: [] } }, public_metadata: { coachMemoryCount: 0 } });
      return json({ forgotten: true });
    }
    if (!validConversationId(body.conversationId)) throw httpError(400, 'Unknown conversation.');
    const user = await getClerkUser(member.id);
    const memory = user.private_metadata?.coachMemory || { items: [], pending: [] };
    const pending = [...(memory.pending || []).filter(id => id !== body.conversationId), body.conversationId].slice(-5);
    await updateClerkMetadata(member.id, { private_metadata: { coachMemory: { items: memory.items || [], pending } } });
    return json({ saved: true });
  });
}
