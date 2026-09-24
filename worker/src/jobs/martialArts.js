// Martial arts guides: one in-depth page per discipline, written from its
// Wikipedia article (history, rules, ranks, famous fighters come from the
// article), with the article's freely licensed lead photo.

import { config } from '../config.js';
import { log } from '../log.js';
import { askJson, aiAvailable } from '../openrouter.js';
import { upsert } from '../supabase.js';
import { summary, pageText, commonsPhoto } from '../wikipedia.js';

// Bump to rewrite every guide (e.g. after changing the sections below)
const CONTENT_VERSION = 2; // v2: core techniques every beginner learns, careful origins

// Existing ids (ma1-ma11) are kept so links and rankings still work
export const DISCIPLINES = [
  { id: 'ma1', name: 'MMA', title: 'Mixed martial arts', icon: '🥊', category: 'Hybrid' },
  { id: 'ma4', name: 'Boxing', title: 'Boxing', icon: '🥊', category: 'Striking' },
  { id: 'ma2', name: 'Muay Thai', title: 'Muay Thai', icon: '🇹🇭', category: 'Striking' },
  { id: 'ma9', name: 'Kickboxing', title: 'Kickboxing', icon: '🦵', category: 'Striking' },
  { id: 'ma3', name: 'BJJ', title: 'Brazilian jiu-jitsu', icon: '🥋', category: 'Grappling' },
  { id: 'ma5', name: 'Wrestling', title: 'Freestyle wrestling', icon: '🤼', category: 'Grappling' },
  { id: 'ma-greco-roman', name: 'Greco-Roman Wrestling', title: 'Greco-Roman wrestling', icon: '🤼', category: 'Grappling' },
  { id: 'ma6', name: 'Judo', title: 'Judo', icon: '🥋', category: 'Grappling' },
  { id: 'ma7', name: 'Karate', title: 'Karate', icon: '🥋', category: 'Striking' },
  { id: 'ma8', name: 'Taekwondo', title: 'Taekwondo', icon: '🦶', category: 'Striking' },
  { id: 'ma10', name: 'Sambo', title: 'Sambo (martial art)', icon: '🇷🇺', category: 'Grappling' },
  { id: 'ma11', name: 'Krav Maga', title: 'Krav Maga', icon: '🛡️', category: 'Self-defence' },
  { id: 'ma-sanda', name: 'Sanda', title: 'Sanda (sport)', icon: '🐉', category: 'Striking' },
  { id: 'ma-wing-chun', name: 'Wing Chun', title: 'Wing Chun', icon: '🐉', category: 'Traditional' },
  { id: 'ma-jeet-kune-do', name: 'Jeet Kune Do', title: 'Jeet Kune Do', icon: '🐉', category: 'Hybrid' },
  { id: 'ma-capoeira', name: 'Capoeira', title: 'Capoeira', icon: '🇧🇷', category: 'Traditional' },
  { id: 'ma-aikido', name: 'Aikido', title: 'Aikido', icon: '☯️', category: 'Traditional' },
  { id: 'ma-hapkido', name: 'Hapkido', title: 'Hapkido', icon: '🥋', category: 'Traditional' },
  { id: 'ma-savate', name: 'Savate', title: 'Savate', icon: '🇫🇷', category: 'Striking' },
  { id: 'ma-lethwei', name: 'Lethwei', title: 'Lethwei', icon: '🇲🇲', category: 'Striking' },
  { id: 'ma-catch-wrestling', name: 'Catch Wrestling', title: 'Catch wrestling', icon: '🤼', category: 'Grappling' },
  { id: 'ma-kyokushin', name: 'Kyokushin', title: 'Kyokushin', icon: '🥋', category: 'Striking' },
  { id: 'ma-silat', name: 'Silat', title: 'Silat', icon: '🗡️', category: 'Traditional' },
  { id: 'ma-arnis', name: 'Arnis / Eskrima', title: 'Arnis', icon: '🥢', category: 'Weapons' },
  { id: 'ma-bare-knuckle', name: 'Bare-Knuckle Boxing', title: 'Bare-knuckle boxing', icon: '✊', category: 'Striking' },
  { id: 'ma-sumo', name: 'Sumo', title: 'Sumo', icon: '🇯🇵', category: 'Grappling' },
  { id: 'ma-kun-khmer', name: 'Kun Khmer', title: 'Kun Khmer', icon: '🇰🇭', category: 'Striking' }
];

const str = (v, max) => String(v || '').slice(0, max);
const items = (v, max) => Array.isArray(v)
  ? v.slice(0, max).map(x => typeof x === 'string'
    ? { name: str(x, 80), description: '' }
    : { name: str(x.name, 80), description: str(x.description, 400) }).filter(x => x.name)
  : [];

async function buildGuide(d) {
  const page = await summary(d.title);
  if (!page || page.type !== 'standard') throw new Error('Wikipedia page not found');
  const [text, photo] = await Promise.all([pageText(page.title, 14000), commonsPhoto(page).catch(() => null)]);

  const prompt = `Write an in-depth guide to ${d.name} for FightHub, a combat sports website for fans and beginners.

SOURCE: the Wikipedia article "${page.title}" below.

RULES
- Facts (history, dates, origins, rules, scoring, ranks, organisations, famous people) must come from the article. Never invent dates, statistics or names.
- Technique descriptions, the beginner guide, equipment and training tips may use general, widely known practical knowledge, but name no brands, gyms or organisations that are not in the article.
- Write clear, engaging British English for someone new to the sport. Separate paragraphs with a blank line.
- If the discipline has no competition rules or no rank system, say so briefly rather than inventing one.
- "origin" and "founded" are short labels. Where the article says the origin is uncertain or disputed, say so (e.g. "Ancient (disputed); modern rules: England"), never state a disputed theory as fact.
- "techniques": 8-12 entries, starting with the fundamental techniques every beginner learns in this discipline (e.g. for boxing: jab, cross, hook, uppercut, footwork, guard), then more advanced ones.
- "famousFighters": only people the article names as notable practitioners or champions (up to 10).

ARTICLE
${text}

Reply with JSON only:
{
 "fullName": "", "origin": "country/region of origin", "founded": "when it emerged, as stated",
 "description": "one-sentence summary",
 "overview": "2 paragraphs: what it is, what makes it distinctive, who it suits",
 "history": "3-5 paragraphs",
 "rules": "2-3 paragraphs on competition format, rules and scoring",
 "ranks": "1-2 paragraphs on belts/grades/ranking, or that there is none",
 "techniques": [{"name": "", "description": "1-2 sentences"}],
 "equipment": [{"name": "", "description": "what it is for and what to look for"}],
 "beginnerGuide": "2-3 paragraphs: how to start, first classes, what to expect, safety",
 "tips": ["6 short practical training tips"],
 "benefits": ["4-6 fitness or self-defence benefits"],
 "famousFighters": ["names"]
}`;

  const { json, model } = await askJson(prompt, { temperature: 0.3 });
  if (!json.history || !json.overview) throw new Error('AI reply missing sections');

  return {
    id: d.id,
    name: d.name,
    icon: d.icon,
    category: d.category,
    fullName: str(json.fullName || page.title, 120),
    origin: str(json.origin, 120),
    founded: str(json.founded, 120),
    description: str(json.description || page.description, 300),
    overview: str(json.overview, 3000),
    history: str(json.history, 8000),
    rules: str(json.rules, 5000),
    ranks: str(json.ranks, 3000),
    techniques: items(json.techniques, 12),
    equipment: items(json.equipment, 8),
    beginnerGuide: str(json.beginnerGuide, 5000),
    tips: (Array.isArray(json.tips) ? json.tips : []).map(t => str(t, 300)).slice(0, 8),
    benefits: (Array.isArray(json.benefits) ? json.benefits : []).map(t => str(t, 200)).slice(0, 8),
    famousFighters: (Array.isArray(json.famousFighters) ? json.famousFighters : []).map(t => str(t, 80)).slice(0, 10),
    ...(photo || { image: '' }),
    wikipediaTitle: page.title,
    sourceUrl: page.content_urls?.desktop?.page || '',
    aiModel: model,
    contentVersion: CONTENT_VERSION
  };
}

export async function runMartialArts(state) {
  if (!aiAvailable() || config.maxStylesPerRun <= 0) return;
  const existing = new Map(state.martialArts.map(m => [m.id, m]));
  const todo = DISCIPLINES.filter(d => (existing.get(d.id)?.contentVersion || 0) < CONTENT_VERSION);
  log(`MARTIAL ARTS: ${todo.length} of ${DISCIPLINES.length} guides to write`);

  let written = 0;
  for (const d of todo) {
    if (written >= config.maxStylesPerRun) break;
    if (Date.now() - state.startedAt > config.maxRunMinutes * 60000) break;
    try {
      const guide = await buildGuide(d);
      const old = existing.get(d.id);
      await upsert('martial_arts', [{ ...(old || {}), ...guide, createdAt: old?.createdAt }]);
      written++;
      log(`  + ${guide.name}: ${guide.techniques.length} techniques, ${guide.famousFighters.length} fighters${guide.image ? ', photo' : ''} [${guide.aiModel}]`);
    } catch (err) {
      log(`  ! ${d.name}: ${err.message}`);
      if (/No model available/.test(err.message)) break;
    }
  }
  state.summary.stylesWritten = written;
}
