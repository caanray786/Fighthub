// Wikipedia / Wikimedia Commons lookups: fighter pages, article text and
// freely licensed photos with attribution.

import { config } from './config.js';
import { stripHtml } from './util.js';

const COMBAT = /\b(boxer|boxing|mixed martial art|mma|kickbox\w*|muay thai|nak muay|wrestler|wrestling|judoka|judo|jiu-jitsu|grappler|martial artist|sambo|karate\w*|taekwondo|lethwei|ufc)\b/i;
// Scripted pro wrestling is entertainment, not a combat sport
const ENTERTAINMENT = /\bprofessional wrestl(er|ing)\b/i;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent, Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

function isCombatPage(summary) {
  if (!summary || summary.type !== 'standard') return false;
  const text = `${summary.description || ''} ${summary.extract || ''}`;
  if (ENTERTAINMENT.test(summary.description || '') && !/\b(mma|mixed martial|boxer|kickbox)/i.test(text)) return false;
  return COMBAT.test(text);
}

export async function summary(title) {
  return getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
}

// Finds the Wikipedia page for a combat sports athlete, or null if unsure.
export async function findFighterPage(name) {
  const direct = await summary(name);
  if (isCombatPage(direct)) return direct;

  // Disambiguation or non-athlete page: search with sport keywords instead
  const surname = name.split(/\s+/).pop().toLowerCase();
  const q = `${name} boxer OR "mixed martial artist" OR kickboxer OR "Muay Thai" OR wrestler OR judoka`;
  const search = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(q)}`);
  for (const hit of search?.query?.search || []) {
    if (!hit.title.toLowerCase().includes(surname)) continue;
    const s = await summary(hit.title);
    if (isCombatPage(s)) return s;
  }
  return null;
}

// Plain-text article body (trimmed), used as the only source for AI profile writing.
export async function pageText(title, maxChars = 9000) {
  const data = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`);
  const page = Object.values(data?.query?.pages || {})[0];
  return (page?.extract || '').slice(0, maxChars);
}

// Infobox fields from the article's lead section, e.g. { wins: '56', KO: '37', ... }.
// Values are lightly cleaned (comments, refs and markup removed).
export async function infoboxFields(title) {
  const data = await getJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&redirects=1&page=${encodeURIComponent(title)}`);
  const wikitext = data?.parse?.wikitext?.['*'] || '';
  const fields = {};
  for (const line of wikitext.split('\n')) {
    const m = /^\s*\|\s*([A-Za-z_ ]+?)\s*=\s*(.*)$/.exec(line);
    if (!m || fields[m[1]] !== undefined) continue;
    fields[m[1]] = m[2]
      .replace(/<!--.*?-->/g, '')
      .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/'''?|<[^>]+>/g, '')
      .trim();
  }
  return fields;
}

// Fight record from infobox fields, for the fighter's main sport only (a boxer's
// one-off MMA bouts shouldn't replace their boxing record). Boxer infoboxes use
// wins/KO/losses/draws; martial artist infoboxes use mma_*, box_* or kickbox_*.
export function recordFromInfobox(fields, sport) {
  const num = key => {
    const m = /^\s*(\d{1,4})\b/.exec(fields[key] || '');
    return m ? parseInt(m[1], 10) : null;
  };
  const sum = (...keys) => keys.reduce((total, key) => total + (num(key) || 0), 0);
  const any = (...keys) => keys.some(key => num(key) !== null);

  const readers = {
    MMA: () => {
      if (!any('mma_win', 'mma_kowin', 'mma_subwin', 'mma_decwin')) return null;
      const wins = num('mma_win') ?? sum('mma_kowin', 'mma_subwin', 'mma_decwin', 'mma_dqwin', 'mma_otherwin');
      const losses = num('mma_loss') ?? sum('mma_koloss', 'mma_subloss', 'mma_decloss', 'mma_dqloss', 'mma_otherloss');
      return { recordSport: 'MMA', wins, losses, draws: num('mma_draw') || 0, noContests: num('mma_nc') || 0,
        ko: num('mma_kowin'), sub: num('mma_subwin'), dec: num('mma_decwin') };
    },
    Boxing: () => {
      const p = any('wins') ? { w: 'wins', ko: 'KO', l: 'losses', d: 'draws' }
        : any('box_win', 'box_kowin') ? { w: 'box_win', ko: 'box_kowin', l: 'box_loss', d: 'box_draw' } : null;
      if (!p) return null;
      const ko = num(p.ko) ?? num('ko');
      const wins = num(p.w) ?? ko;
      return { recordSport: 'Boxing', wins, losses: num(p.l) || 0, draws: num(p.d) || 0,
        ko, sub: null, dec: ko !== null && wins !== null ? Math.max(0, wins - ko) : null };
    },
    Kickboxing: () => {
      const pre = any('kickbox_win', 'kickbox_kowin') ? 'kickbox' : any('kick_win', 'kick_kowin') ? 'kick' : null;
      if (!pre) return null;
      const ko = num(`${pre}_kowin`);
      const wins = num(`${pre}_win`) ?? ko;
      return { recordSport: 'Muay Thai / Kickboxing', wins, losses: num(`${pre}_loss`) || 0, draws: num(`${pre}_draw`) || 0,
        ko, sub: null, dec: ko !== null && wins !== null ? Math.max(0, wins - ko) : null };
    }
  };

  const order = {
    MMA: ['MMA'],
    Boxing: ['Boxing'],
    'Muay Thai': ['Kickboxing'],
    Grappling: ['MMA'],
    'Martial Arts': ['MMA', 'Kickboxing', 'Boxing']
  }[sport] || ['MMA', 'Boxing', 'Kickboxing'];

  for (const key of order) {
    const record = readers[key]();
    if (record && record.wins !== null) return record;
  }
  return null;
}

// The page's lead image, only if it is hosted on Commons (i.e. freely licensed).
// Returns { image, imageCredit, imageSourceUrl } or null.
export async function commonsPhoto(pageSummary) {
  const src = pageSummary?.originalimage?.source || pageSummary?.thumbnail?.source;
  if (!src) return null;
  const match = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/.exec(src);
  if (!match) return null; // local "fair use" files live under /wikipedia/en/ and are skipped

  const fileName = decodeURIComponent(match[1]);
  const info = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&titles=${encodeURIComponent('File:' + fileName)}`);
  const ii = Object.values(info?.query?.pages || {})[0]?.imageinfo?.[0];
  if (!ii) return null;

  const meta = ii.extmetadata || {};
  const license = meta.LicenseShortName?.value || '';
  if (!license || /fair use|non-free/i.test(license)) return null;
  let artist = stripHtml(meta.Artist?.value || '').slice(0, 120);
  if (!artist || /unknown author/i.test(artist)) artist = 'Unknown author';

  return {
    image: ii.thumburl || ii.url,
    imageCredit: `${artist} · ${license} · via Wikimedia Commons`,
    imageSourceUrl: ii.descriptionurl
  };
}
