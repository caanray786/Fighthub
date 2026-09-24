// Builds a fighter record from a Wikipedia page. Facts that can be read
// directly (fight record, sport) come from Wikipedia itself; the AI only
// writes prose (bio, highlights) from the article text.

import { askJson } from './openrouter.js';
import { pageText, commonsPhoto, infoboxFields, recordFromInfobox } from './wikipedia.js';
import { slugify } from './util.js';

export const SPORTS = ['Boxing', 'MMA', 'Muay Thai', 'Grappling', 'Martial Arts'];

export const displayName = title => title.replace(/\s*\([^)]*\)\s*$/, '');

// From Wikipedia's short description ("American boxer (1942–2016)"), falling back
// to the opening paragraph for vague ones like "American martial artist"
export function sportFromDescription(description = '', extract = '') {
  for (const text of [description, extract.slice(0, 400)]) {
    const d = text.toLowerCase();
    if (/mixed martial art|\bmma\b/.test(d)) return 'MMA';
    if (/kickbox|muay thai|nak muay|lethwei/.test(d)) return 'Muay Thai';
    if (/\bboxer\b/.test(d)) return 'Boxing';
    if (/judoka|wrestler|grappl|jiu-jitsu|sambo/.test(d)) return 'Grappling';
  }
  return 'Martial Arts';
}

function flagEmoji(code) {
  return /^[A-Za-z]{2}$/.test(code || '')
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : '';
}

const list = (value, max) => Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, max) : [];

export async function buildFighter(page, { draft, source }) {
  const [text, fields, photo] = await Promise.all([
    pageText(page.title),
    infoboxFields(page.title).catch(() => ({})),
    commonsPhoto(page).catch(() => null)
  ]);
  const sport = sportFromDescription(page.description, page.extract);
  const record = recordFromInfobox(fields, sport);
  const hasDied = /\(\d{4}\s*[–-]\s*\d{4}\)/.test(page.description || '');

  const prompt = `Write profile details for a combat sports athlete using ONLY the Wikipedia article below.

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}

RULES
- Only use information stated in the article. If something is not stated, use "" or [].
- "bio": 3-5 neutral sentences covering who they are and why they matter.
- "highlights": up to 6 short career highlights stated in the article.
- "championships": titles they won, as stated in the article.
- "countryCode": ISO 3166-1 alpha-2 code of the country they represent (e.g. "US", "GB", "TH"), or "".
- "status": "Retired" if the article says they retired or have died, otherwise "Active".
- "timeline": up to 5 notable fights stated in the article, newest first, with the date as YYYY-MM-DD if given (otherwise YYYY).

ARTICLE: ${page.title}
Short description: ${page.description || ''}
Infobox nickname: ${fields.nickname || ''} | weight/division: ${fields.weight || fields.division || ''} | team: ${fields.team || ''} | style: ${fields.style || ''}

${text}

Reply with JSON only:
{"nickname": "", "country": "", "countryCode": "", "weightClass": "", "style": "", "team": "", "status": "", "bio": "", "championships": [], "highlights": [], "timeline": [{"date": "", "opponent": "", "result": "Win|Loss|Draw", "finishing": "", "event": ""}]}`;

  const { json, model } = await askJson(prompt, { temperature: 0.1 });

  return {
    id: 'fighter-' + slugify(page.title),
    name: displayName(page.title).slice(0, 100),
    nickname: String(json.nickname || '').replace(/^["']|["']$/g, '').slice(0, 60),
    nationality: flagEmoji(json.countryCode),
    country: String(json.country || '').slice(0, 60),
    sport,
    weightClass: String(json.weightClass || '').slice(0, 60),
    wins: record?.wins ?? null,
    losses: record?.losses ?? null,
    draws: record?.draws ?? null,
    ko: record?.ko ?? null,
    sub: record?.sub ?? null,
    dec: record?.dec ?? null,
    recordSport: record?.recordSport || '',
    recordSource: record ? 'Wikipedia infobox' : '',
    style: String(json.style || fields.style || '').slice(0, 80),
    team: String(json.team || '').slice(0, 80),
    status: hasDied || json.status === 'Retired' ? 'Retired' : 'Active',
    bio: String(json.bio || page.extract || '').slice(0, 1500),
    championships: list(json.championships, 10),
    highlights: list(json.highlights, 8),
    timeline: Array.isArray(json.timeline) ? json.timeline.slice(0, 5).map(t => ({
      date: String(t.date || ''), opponent: String(t.opponent || ''), result: String(t.result || ''),
      finishing: String(t.finishing || ''), event: String(t.event || '')
    })) : [],
    ...(photo || { image: '' }),
    photoCheckedAt: new Date().toISOString().slice(0, 10),
    wikipediaTitle: page.title,
    sourceUrl: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    aiModel: model,
    createdBy: 'ai-worker',
    addedFrom: source,
    draft
  };
}
