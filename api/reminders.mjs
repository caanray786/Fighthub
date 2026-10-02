// POST /api/reminders: a member's training reminders.
// { on, days: [0-6], hour: 5-22, tz, lang, subscription, unsubscribe, progress: { weekStart, done, goal }, test }
// The push subscription (this phone's address for notifications) is kept in
// private metadata; the chosen days and time in public metadata for the app.
import { json, handle, httpError } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';
import { isPushEndpoint, sendPush } from './_lib/webpush.mjs';
import { DEFAULT_REMINDERS, REMINDER_LANGUAGES, validTimeZone, testMessage } from './_lib/reminders.mjs';

export async function POST(request) {
  return handle(async () => {
    if (!process.env.VAPID_PRIVATE_KEY) throw httpError(503, 'Reminders are being set up. Please try again soon.');
    const member = await memberFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const user = await getClerkUser(member.id);
    const settings = { ...DEFAULT_REMINDERS, ...(user.public_metadata?.reminders || {}) };
    const push = { subs: [], ...(user.private_metadata?.push || {}) };

    if (typeof body.on === 'boolean') settings.on = body.on;
    if (body.days !== undefined) {
      if (!Array.isArray(body.days) || !body.days.length || body.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw httpError(400, 'Choose at least one day.');
      settings.days = [...new Set(body.days)].sort();
    }
    if (body.hour !== undefined) {
      if (!Number.isInteger(body.hour) || body.hour < 5 || body.hour > 22) throw httpError(400, 'Choose a time between 5am and 10pm.');
      settings.hour = body.hour;
    }
    if (body.tz !== undefined) {
      if (!validTimeZone(body.tz)) throw httpError(400, 'Unknown time zone.');
      settings.tz = body.tz;
    }
    if (typeof body.lang === 'string' && REMINDER_LANGUAGES[body.lang]) settings.lang = body.lang;
    if (body.subscription) {
      const s = body.subscription;
      if (!isPushEndpoint(s.endpoint) || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string' || s.keys.p256dh.length > 200 || s.keys.auth.length > 50) {
        throw httpError(400, 'This browser’s notification address was not recognised.');
      }
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, added: new Date().toISOString() };
      push.subs = [sub, ...push.subs.filter(x => x.endpoint !== sub.endpoint)].slice(0, 3); // up to 3 devices
    }
    if (typeof body.unsubscribe === 'string') push.subs = push.subs.filter(x => x.endpoint !== body.unsubscribe);
    if (body.progress) {
      const { weekStart, done, goal } = body.progress;
      if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart) && Number.isInteger(done) && Number.isInteger(goal) && done >= 0 && done <= 7 && goal >= 1 && goal <= 7) {
        push.week = { start: weekStart, done, goal };
      }
    }
    if (!push.subs.length) settings.on = false;

    let test = null;
    if (body.test && settings.on) {
      const message = testMessage(settings);
      const results = await Promise.all(push.subs.map(s => sendPush(s, message)));
      push.subs = push.subs.filter((s, i) => results[i] !== 'gone');
      test = results.includes('sent') ? 'sent' : 'failed';
    }

    await updateClerkMetadata(member.id, { public_metadata: { reminders: settings }, private_metadata: { push } });
    return json({ reminders: settings, devices: push.subs.length, test });
  });
}
