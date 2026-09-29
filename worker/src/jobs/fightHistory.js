// Full fight records: reads each fighter's complete record table from their
// Wikipedia article (every bout: result, opponent, method, event, date...).
// No AI involved. Active fighters are refreshed monthly for new fights.

import { config } from '../config.js';
import { log } from '../log.js';
import { upsert } from '../supabase.js';
import { findFighterPage, fightRecord } from '../wikipedia.js';
import { todayStr } from '../util.js';

const REFRESH_DAYS = 30;

function due(f) {
  if (f.draft) return false;
  if (!f.fightHistoryCheckedAt) return true;
  if (f.status === 'Retired') return false;
  return (Date.now() - new Date(f.fightHistoryCheckedAt).getTime()) / 86400000 > REFRESH_DAYS;
}

export async function runFightHistory(state) {
  const pending = state.fighters.filter(due).slice(0, config.maxFightHistoryPerRun);
  log(`FIGHT HISTORY: ${state.fighters.filter(due).length} fighters due, checking ${pending.length}`);

  let found = 0;
  for (const fighter of pending) {
    if (Date.now() - state.startedAt > config.maxRunMinutes * 60000) break;
    try {
      const title = fighter.wikipediaTitle || (await findFighterPage(fighter.name))?.title;
      const record = title ? await fightRecord(title, fighter.sport) : null;
      const updated = { ...fighter, fightHistoryCheckedAt: todayStr() };
      if (title) updated.wikipediaTitle = title;
      if (record) {
        Object.assign(updated, { fightHistory: record.fights, fightHistorySection: record.section, fightHistoryUrl: record.url });
        found++;
      }
      await upsert('fighters', [updated]);
      Object.assign(fighter, updated);
    } catch (err) {
      log(`  ! ${fighter.name}: ${err.message}`);
    }
  }
  log(`FIGHT HISTORY: added full records for ${found} of ${pending.length}`);
  state.summary.fightRecords = found;
}
