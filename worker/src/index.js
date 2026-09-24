// FightHub AI worker: runs every few hours on GitHub Actions.
//   node src/index.js            normal run (needs secrets)
//   node src/index.js --dry-run  fetch and generate, but write nothing

import { config } from './config.js';
import { log, fullLog } from './log.js';
import { aiAvailable } from './openrouter.js';
import { getAll, startRun, finishRun } from './supabase.js';
import { runNews } from './jobs/news.js';
import { runNewFighters } from './jobs/fighters.js';
import { runPhotos } from './jobs/photos.js';
import { runEventHousekeeping } from './jobs/events.js';

async function main() {
  if (!config.supabaseKey) {
    // Not configured yet (secrets not added): skip quietly rather than fail every 4 hours
    log('SUPABASE_SERVICE_ROLE_KEY is not set: add it under GitHub → Settings → Secrets and variables → Actions. Skipping this run.');
    return;
  }
  log(`FightHub worker starting${config.dryRun ? ' (DRY RUN: nothing will be saved)' : ''}`);
  log(`AI: ${aiAvailable() ? config.models.join(' -> ') : 'no OPENROUTER_API_KEY; news saved as source-linked briefs'}`);

  const runId = await startRun();
  const state = {
    fighters: await getAll('fighters'),
    articles: await getAll('articles'),
    events: await getAll('events'),
    mentionedFighters: new Set(),
    summary: { errors: [] }
  };
  log(`Loaded ${state.fighters.length} fighters, ${state.articles.length} articles, ${state.events.length} events`);

  // Each job is independent: one failing doesn't stop the others
  const jobs = [
    ['news', runNews],
    ['newFighters', runNewFighters],
    ['photos', runPhotos],
    ['events', runEventHousekeeping]
  ];
  for (const [name, job] of jobs) {
    try {
      await job(state);
    } catch (err) {
      log(`JOB ${name} FAILED: ${err.message}`);
      state.summary.errors.push(`${name}: ${err.message}`);
    }
  }

  const ok = state.summary.errors.length === 0;
  log(`Finished: ${JSON.stringify(state.summary)}`);
  await finishRun(runId, ok, state.summary, fullLog());
  if (!ok) process.exitCode = 1;
}

main().catch(err => {
  log(`FATAL: ${err.stack || err.message}`);
  process.exit(1);
});
