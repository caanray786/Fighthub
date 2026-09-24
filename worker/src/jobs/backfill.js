// Fighter import: works down data/fighter-candidates.json (Hall of Fame and
// champion lists first), adding a batch of profiles each run until done.

import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { log } from '../log.js';
import { aiAvailable } from '../openrouter.js';
import { upsert, remove, getState, setState } from '../supabase.js';
import { summary } from '../wikipedia.js';
import { buildFighter, displayName, isNonAthlete } from '../profile.js';
import { nameKey } from '../util.js';

const MAX_FAILURES = 2;

export async function runBackfill(state) {
  if (!aiAvailable() || config.maxBackfillPerRun <= 0) return;

  const candidates = JSON.parse(await readFile(new URL('../../data/fighter-candidates.json', import.meta.url), 'utf8'));
  const progress = (await getState('fighter-backfill').catch(() => null)) || { failed: {} };
  progress.skipped = progress.skipped || {};

  // Re-check profiles imported before the non-athlete check existed; remove
  // promoters, referees etc. and remember them so they aren't imported again
  const unchecked = state.fighters.filter(f => f.createdBy === 'ai-worker' && f.wikipediaTitle && !f.athleteChecked).slice(0, 40);
  const removed = [];
  const checked = [];
  for (const f of unchecked) {
    const page = await summary(f.wikipediaTitle).catch(() => null);
    if (page && isNonAthlete(page)) {
      removed.push(f);
      progress.skipped[f.wikipediaTitle] = 'not an athlete';
    } else {
      checked.push({ ...f, athleteChecked: true });
    }
  }
  if (removed.length) {
    await remove('fighters', removed.map(f => f.id));
    state.fighters = state.fighters.filter(f => !removed.includes(f));
    log(`BACKFILL: removed non-athletes: ${removed.map(f => f.name).join(', ')}`);
  }
  await upsert('fighters', checked);

  const knownTitles = new Set(state.fighters.map(f => f.wikipediaTitle).filter(Boolean));
  const knownNames = new Set(state.fighters.map(f => nameKey(f.name)));
  const todo = candidates.filter(c => !knownTitles.has(c.title)
    && !knownNames.has(nameKey(displayName(c.title)))
    && !progress.skipped[c.title]
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
      if (isNonAthlete(page)) {
        progress.skipped[candidate.title] = 'not an athlete';
        log(`  - ${candidate.title}: not an athlete (${(page.extract || '').slice(0, 70)}…), skipped`);
        continue;
      }
      const fighter = { ...(await buildFighter(page, { draft: config.backfillAsDrafts, source: candidate.source })), athleteChecked: true };
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
