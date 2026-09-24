// Builds worker/data/fighter-candidates.json: combat sports athletes linked from
// Wikipedia's Hall of Fame and champion lists, most notable sources first.
// Re-run whenever you add sources:  node scripts/build-candidates.js

import { writeFile, mkdir } from 'node:fs/promises';

const UA = { 'User-Agent': 'FightHubBot/1.0 (+https://fighthub-swart.vercel.app)' };

// Order = priority: the worker adds fighters from the top of the list down
const SOURCES = [
  'International Boxing Hall of Fame',
  'UFC Hall of Fame',
  'List of undisputed world boxing champions',
  'List of UFC champions',
  'List of Pride Fighting Championships champions',
  'List of ONE Championship champions',
  'List of Muay Thai practitioners',
  'Lumpinee Boxing Stadium',
  'Rajadamnern Stadium',
  'List of K-1 champions',
  'Glory (kickboxing)',
  'List of Strikeforce champions',
  'List of Bellator MMA champions',
  'List of Professional Fighters League champions',
  'List of WBC world champions',
  'List of female boxers',
  'List of female mixed martial artists',
  'List of Brazilian jiu-jitsu practitioners',
  'ADCC Submission Fighting World Championship',
  'List of Olympic medalists in boxing',
  'List of Olympic medalists in judo',
  'List of male mixed martial artists'
];

const COMBAT = /\b(boxer|mixed martial artist|kickboxer|muay thai|nak muay|lethwei|judoka|wrestler|grappler|jiu-jitsu|sambo|karateka|taekwondo|martial artist|mma fighter)\b/i;
const EXCLUDE = /\b(professional wrestler|actor|actress|politician|referee|promoter|commentator|announcer|trainer|coach|manager)\b/i;

async function api(params) {
  const url = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&' + new URLSearchParams(params);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function linksOf(title) {
  const links = [];
  let cont = {};
  do {
    const data = await api({ action: 'query', prop: 'links', titles: title, plnamespace: 0, pllimit: 'max', redirects: 1, ...cont });
    (data.query.pages[0].links || []).forEach(l => links.push(l.title));
    cont = data.continue || null;
  } while (cont);
  return links;
}

// Short descriptions ("American boxer (1942–2016)") for up to 50 titles per request
async function describe(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const data = await api({ action: 'query', prop: 'description', titles: titles.slice(i, i + 50).join('|'), redirects: 1 });
    const redirects = new Map((data.query.redirects || []).map(r => [r.to, r.from]));
    for (const page of data.query.pages || []) {
      if (page.missing || !page.description) continue;
      out.set(page.title, { description: page.description, from: redirects.get(page.title) });
    }
  }
  return out;
}

const seen = new Set();
const candidates = [];
for (const source of SOURCES) {
  const links = (await linksOf(source)).filter(t => !seen.has(t) && !/^(List of|Category:)/.test(t));
  const described = await describe(links);
  let kept = 0;
  for (const [title, { description }] of described) {
    if (seen.has(title)) continue;
    seen.add(title);
    if (COMBAT.test(description) && !EXCLUDE.test(description)) {
      candidates.push({ title, description, source });
      kept++;
    }
  }
  links.forEach(t => seen.add(t));
  console.log(`${source}: ${links.length} links -> ${kept} fighters`);
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/fighter-candidates.json', import.meta.url), JSON.stringify(candidates, null, 1));
console.log(`\n${candidates.length} candidate fighters written to data/fighter-candidates.json`);
