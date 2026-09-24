// Fighter import: works down data/fighter-candidates.json (Hall of Fame and
// champion lists first), adding a batch of profiles each run until done.

import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { log } from '../log.js';
import { aiAvailable } from '../openrouter.js';
import { upsert, getState, setState } from '../supabase.js';
import { summary } from '../wikipedia.js';
import { buildFighter, displayName } from '../profile.js';
import { nameKey } from '../util.js';

const MAX_FAILURES = 2;

export async function runBackfill(state) {
  if (!aiAvailable() || config.maxBackfillPerRun <= 0) return;

  const candidates = JSON.parse(await readFile(new URL('../../data/fighter-candidates.json', import.meta.url), 'utf8'));
  const progress = (await getState('fighter-backfill').catch(() => null)) || { failed: {} };

  const knownTitles = new Set(state.fighters.map(f => f.wikipediaTitle).filter(Boolean));
  const knownNames = new Set(state.fighters.map(f => nameKey(f.name)));
  const todo = candidates.filter(c => !knownTitles.has(c.title)
    && !knownNames.has(nameKey(displayName(c.title)))
    && (progress.failed[c.title] || 0) < MAX_FAILURES);
  log(`BACKFILL: ${todo.length} of ${candidates.length} candidate fighters still to add`);

  let added = 0;
  for (const candidate of todo) {
    if (added >= config.maxBackfillPerRun) break;
    if (Date.now() - state.startedAt > config.maxRunMinutes * 60000) {
      log('BACKFILL: time budget used, continuing next run');
      break;
    }
    try {
      const page = await summary(candidate.title);
      if (!page || page.type !== 'standard') throw new Error('page not found');
      const fighter = await buildFighter(page, { draft: config.backfillAsDrafts, source: candidate.source });
      await upsert('fighters', [fighter]); // saved one by one, so progress survives a timeout
      state.fighters.push(fighter);
      knownTitles.add(page.title);
      added++;
      const record = fighter.wins !== null ? `${fighter.wins}-${fighter.losses}-${fighter.draws}` : 'no record';
      log(`  + ${fighter.name} (${fighter.sport}, ${record}${fighter.image ? ', photo' : ''}) [${fighter.aiModel}]`);
    } catch (err) {
      progress.failed[candidate.title] = (progress.failed[candidate.title] || 0) + 1;
      log(`  ! ${candidate.title}: ${err.message}`);
      if (/No model available/.test(err.message)) break; // AI busy or out of quota: stop for this run
    }
  }

  await setState('fighter-backfill', progress).catch(err => log(`  (could not save progress: ${err.message})`));
  state.summary.backfilled = added;
}
