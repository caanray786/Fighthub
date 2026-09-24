// New fighters: for fighters named in the news who aren't in the database yet,
// build a profile from their Wikipedia article. Saved as drafts for admin review,
// because news mentions are less reliable than the curated import lists.

import { config } from '../config.js';
import { log } from '../log.js';
import { aiAvailable } from '../openrouter.js';
import { upsert } from '../supabase.js';
import { findFighterPage } from '../wikipedia.js';
import { buildFighter, displayName, isNonAthlete } from '../profile.js';
import { nameKey } from '../util.js';

export async function runNewFighters(state) {
  // Earlier AI profiles used the full legal name; switch them to the known name
  const renamed = state.fighters
    .filter(f => f.createdBy === 'ai-worker' && f.wikipediaTitle && f.name !== displayName(f.wikipediaTitle))
    .map(f => ({ ...f, name: displayName(f.wikipediaTitle) }));
  if (renamed.length) {
    await upsert('fighters', renamed);
    renamed.forEach(r => Object.assign(state.fighters.find(f => f.id === r.id), r));
    log(`FIGHTERS: renamed ${renamed.map(r => r.name).join(', ')}`);
  }

  const known = new Set(state.fighters.map(f => nameKey(f.name)));
  const knownTitles = new Set(state.fighters.map(f => f.wikipediaTitle).filter(Boolean));
  const candidates = [...state.mentionedFighters].filter(name => name && !known.has(nameKey(name)));
  log(`FIGHTERS: ${candidates.length} mentioned fighters not in the database`);
  if (!aiAvailable() || !candidates.length) return;

  const created = [];
  for (const name of candidates) {
    if (created.length >= config.maxNewFightersPerRun) break;
    try {
      const page = await findFighterPage(name);
      if (!page) {
        log(`  - ${name}: no Wikipedia page found, skipped`);
        continue;
      }
      if (knownTitles.has(page.title) || known.has(nameKey(displayName(page.title)))) continue;
      if (isNonAthlete(page)) {
        log(`  - ${name}: not an athlete, skipped`);
        continue;
      }

      const fighter = await buildFighter(page, { draft: true, source: 'news mention' });
      created.push(fighter);
      known.add(nameKey(fighter.name));
      knownTitles.add(page.title);
      log(`  + draft profile: ${fighter.name} (${fighter.sport}${fighter.image ? ', with photo' : ''})`);
    } catch (err) {
      log(`  ! ${name}: ${err.message}`);
      if (/No model available/.test(err.message)) break;
    }
  }

  await upsert('fighters', created);
  state.fighters.push(...created);
  state.summary.newFighters = created.length;
}
