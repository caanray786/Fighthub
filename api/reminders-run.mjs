// POST /api/reminders-run: called every hour by the "Training reminders"
// GitHub Actions timer. Sends each member's reminder once on their chosen
// days, at their chosen hour in their own time zone. Safe to call at any
// time: nobody gets more than one reminder a day.
import { json, handle } from './_lib/http.mjs';
import { listClerkUsers, updateClerkMetadata } from './_lib/clerk.mjs';
import { sendPush } from './_lib/webpush.mjs';
import { isDue, reminderMessage } from './_lib/reminders.mjs';

export async function POST() {
  return handle(async () => {
    // Before the reminder key is in Vercel, the hourly timer simply has nothing to do
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.CLERK_SECRET_KEY) return json({ checked: 0, sent: 0, removed: 0, note: 'Reminders are not set up yet.' });
    const now = new Date();
    let checked = 0, sent = 0, removed = 0;
    for (let offset = 0; offset < 20000; offset += 100) {
      const users = await listClerkUsers(offset, 100);
      if (!Array.isArray(users) || !users.length) break;
      await Promise.all(users.map(async user => {
        const settings = user.public_metadata?.reminders;
        const push = user.private_metadata?.push;
        checked++;
        const due = isDue(settings, push, now);
        if (!due) return;
        const message = reminderMessage(user.first_name, push, due);
        const results = await Promise.all(push.subs.map(s => sendPush(s, message)));
        const subs = push.subs.filter((s, i) => results[i] !== 'gone');
        removed += push.subs.length - subs.length;
        if (results.includes('sent')) sent++;
        await updateClerkMetadata(user.id, {
          private_metadata: { push: { ...push, subs, last: due.isoDate } },
          ...(subs.length ? {} : { public_metadata: { reminders: { ...settings, on: false } } })
        });
      }));
      if (users.length < 100) break;
    }
    return json({ checked, sent, removed });
  });
}

export const GET = POST;
