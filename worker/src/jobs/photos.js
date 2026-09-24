// Photos: give fighters without a real photo a freely licensed image of the
// actual person from Wikimedia Commons, with credit. No AI needed.

import { config } from '../config.js';
import { log } from '../log.js';
import { upsert } from '../supabase.js';
import { findFighterPage, commonsPhoto } from '../wikipedia.js';
import { todayStr } from '../util.js';

const RECHECK_DAYS = 30;

function needsPhoto(f) {
  if (f.image && !/images\.unsplash\.com/.test(f.image)) return false;
  if (!f.photoCheckedAt) return true;
  const age = (Date.now() - new Date(f.photoCheckedAt).getTime()) / 86400000;
  return age > RECHECK_DAYS;
}

export async function runPhotos(state) {
  const pending = state.fighters.filter(needsPhoto).slice(0, config.maxPhotosPerRun);
  log(`PHOTOS: checking ${pending.length} fighters without a photo`);

  const updated = [];
  let found = 0;
  for (const fighter of pending) {
    try {
      const page = await findFighterPage(fighter.wikipediaTitle || fighter.name);
      const photo = page ? await commonsPhoto(page) : null;
      if (photo) {
        updated.push({ ...fighter, ...photo, wikipediaTitle: page.title, photoCheckedAt: todayStr() });
        found++;
        log(`  + ${fighter.name}: ${photo.imageCredit}`);
      } else {
        // Remember the check so the same fighter isn't looked up every run
        updated.push({ ...fighter, image: fighter.image && !/unsplash/.test(fighter.image) ? fighter.image : '', photoCheckedAt: todayStr() });
        log(`  - ${fighter.name}: no free photo${page ? '' : ' (no Wikipedia page)'}`);
      }
    } catch (err) {
      log(`  ! ${fighter.name}: ${err.message}`);
    }
  }

  await upsert('fighters', updated);
  state.summary.photosAdded = found;
}
