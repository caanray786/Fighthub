// Training reminders: who is due a reminder right now, and what it says.
// Settings (public metadata, shown in the app): { on, days: [0-6, Sunday = 0], hour, tz }
// Private metadata: { subs: [push subscriptions], last: 'YYYY-MM-DD', week: { start, done, goal } }

export const DEFAULT_REMINDERS = { on: false, days: [1, 3, 5], hour: 18, tz: 'Europe/London' };
export const validTimeZone = tz => {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64; } catch { return false; }
};

// The member's local weekday (Sunday = 0), hour and date
export function localParts(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { weekday, hour: Number(parts.hour), isoDate: `${parts.year}-${parts.month}-${parts.day}` };
}

// Monday of the week containing an ISO date
export function weekStart(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Due once on each chosen day, from the chosen hour (allowing two hours for a late timer)
export function isDue(settings, push, now = new Date()) {
  if (!settings?.on || !push?.subs?.length) return null;
  const parts = localParts(now, validTimeZone(settings.tz) ? settings.tz : DEFAULT_REMINDERS.tz);
  const days = Array.isArray(settings.days) ? settings.days : DEFAULT_REMINDERS.days;
  const hour = Number.isInteger(settings.hour) ? settings.hour : DEFAULT_REMINDERS.hour;
  if (!days.includes(parts.weekday) || parts.hour < hour || parts.hour > hour + 2 || push.last === parts.isoDate) return null;
  return parts;
}

const GENERAL = [
  ['Time to train', n => `${n}, your session’s waiting. Even 20 minutes keeps the habit going.`],
  ['Gloves on', n => `It’s a training day, ${n}. Your routine is ready when you are.`],
  ['Your corner’s ready', () => 'Get a session in today, then log it in your journal.'],
  ['Show up today', n => `Consistency beats intensity, ${n}. One good session today.`]
];

export function reminderMessage(name, push, parts) {
  const n = (name || '').trim() || 'champ';
  const week = push?.week;
  const base = { url: '/app/', tag: 'training-reminder' };
  if (week && week.start === weekStart(parts.isoDate) && week.goal > 0) {
    if (week.done >= week.goal) return { ...base, title: 'Weekly goal done', body: `You’ve hit ${week.goal} sessions this week, ${n}. Fancy a bonus round or some mobility today?` };
    const left = week.goal - week.done;
    return { ...base, title: `${week.done} of ${week.goal} this week`, body: `${left} more ${left === 1 ? 'session' : 'sessions'} to hit your weekly goal. Today’s a good day for one.` };
  }
  const dayOfYear = Math.floor((Date.parse(parts.isoDate) - Date.parse(parts.isoDate.slice(0, 4) + '-01-01')) / 86400000);
  const [title, body] = GENERAL[dayOfYear % GENERAL.length];
  return { ...base, title, body: body(n) };
}
