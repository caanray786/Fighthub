// Events housekeeping: anything dated before today is marked completed.

import { log } from '../log.js';
import { upsert } from '../supabase.js';
import { todayStr } from '../util.js';

export async function runEventHousekeeping(state) {
  const today = todayStr();
  const finished = state.events.filter(e => e.date && e.date < today && e.status !== 'completed');
  log(`EVENTS: ${finished.length} past events to mark completed`);
  await upsert('events', finished.map(e => ({ ...e, status: 'completed' })));
  state.summary.eventsCompleted = finished.length;
}
