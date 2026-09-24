// New fighters: for fighters named in the news who aren't in the database yet,
// build a profile from their Wikipedia article. Saved as drafts for admin review.

import { config } from '../config.js';
import { log } from '../log.js';
import { askJson, aiAvailable } from '../openrouter.js';
import { upsert } from '../supabase.js';
import { findFighterPage, pageText, commonsPhoto } from '../wikipedia.js';
import { nameKey, slugify } from '../util.js';

const SPORTS = ['Boxing', 'MMA', 'Muay Thai', 'Grappling', 'Martial Arts'];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function list(value, max) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, max) : [];
}

async function buildProfile(page) {
  const text = await pageText(page.title);
  const prompt = `Create a fighter profile from the Wikipedia article below.

RULES
- Use ONLY information in the article. If something is not stated, use null (numbers) or "" / [] (text, lists). Never guess records or titles.
- "sport": one of ${SPORTS.join(', ')} (Grappling = BJJ, wrestling, judo, sambo; Muay Thai includes kickboxing).
- Record numbers are for the fighter's main professional sport.
- "nationality": the flag emoji of their country; "country": the country name.
- "status": "Active" or "Retired", based on the article.
- "bio": 2-4 neutral sentences.
- "timeline": up to 5 notable fights stated in the article, newest first.

ARTICLE: ${page.title}
${text}

Reply with JSON only:
{"name": "", "nickname": "", "nationality": "", "country": "", "sport": "", "weightClass": "", "wins": null, "losses": null, "draws": null, "ko": null, "sub": null, "dec": null, "style": "", "team": "", "status": "", "bio": "", "championships": [], "highlights": [], "timeline": [{"date": "YYYY-MM-DD", "opponent": "", "result": "Win|Loss|Draw", "finishing": "", "event": ""}]}`;

  const { json, model } = await askJson(prompt, { temperature: 0.1 });
  return {
    name: String(json.name || page.title).slice(0, 100),
    nickname: String(json.nickname || '').slice(0, 60),
    nationality: String(json.nationality || '').slice(0, 16),
    country: String(json.country || '').slice(0, 60),
    sport: SPORTS.includes(json.sport) ? json.sport : 'Martial Arts',
    weightClass: String(json.weightClass || '').slice(0, 60),
    wins: num(json.wins), losses: num(json.losses), draws: num(json.draws),
    ko: num(json.ko), sub: num(json.sub), dec: num(json.dec),
    style: String(json.style || '').slice(0, 80),
    team: String(json.team || '').slice(0, 80),
    status: json.status === 'Retired' ? 'Retired' : 'Active',
    bio: String(json.bio || page.extract || '').slice(0, 1500),
    championships: list(json.championships, 10),
    highlights: list(json.highlights, 10),
    timeline: Array.isArray(json.timeline) ? json.timeline.slice(0, 5).map(t => ({
      date: String(t.date || ''), opponent: String(t.opponent || ''), result: String(t.result || ''),
      finishing: String(t.finishing || ''), event: String(t.event || '')
    })) : [],
    aiModel: model
  };
}

export async function runNewFighters(state) {
  const known = new Set(state.fighters.map(f => nameKey(f.name)));
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
      if (known.has(nameKey(page.title))) continue;

      const profile = await buildProfile(page);
      const photo = await commonsPhoto(page).catch(() => null);
      const fighter = {
        id: 'fighter-' + slugify(page.title),
        ...profile,
        ...(photo || { image: '' }),
        wikipediaTitle: page.title,
        sourceUrl: page.content_urls?.desktop?.page || '',
        draft: true, // waits in the admin review queue
        createdBy: 'ai-worker'
      };
      created.push(fighter);
      known.add(nameKey(page.title));
      log(`  + draft profile: ${fighter.name} (${fighter.sport}${photo ? ', with photo' : ''})`);
    } catch (err) {
      log(`  ! ${name}: ${err.message}`);
    }
  }

  await upsert('fighters', created);
  state.fighters.push(...created);
  state.summary.newFighters = created.length;
}
