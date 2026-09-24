// News: pull RSS feeds, rewrite new stories with the AI (facts from the source
// only), tag fighters, and publish with a link back to the original.

import Parser from 'rss-parser';
import { config } from '../config.js';
import { log } from '../log.js';
import { askJson, aiAvailable } from '../openrouter.js';
import { upsert } from '../supabase.js';
import { shortHash, slugify, stripHtml } from '../util.js';

const CATEGORIES = ['UFC', 'MMA', 'Boxing', 'ONE', 'PFL', 'Muay Thai', 'Kickboxing', 'BJJ', 'General'];

// Bump when the writing rules change: recent AI articles written under older
// rules are rewritten from their feed item (while it is still in the feed).
const PROMPT_VERSION = 2;

async function fetchFeedItems() {
  const parser = new Parser();
  const items = [];
  for (const feed of config.feeds) {
    try {
      // Fetch ourselves and strip characters that are illegal in XML: some feeds
      // (ESPN) include them, which makes the parser reject the whole feed
      const res = await fetch(feed.url, { headers: { 'User-Agent': config.userAgent }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = (await res.text())
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&(?!#?\w+;)/g, '&amp;');
      const parsed = await parser.parseString(xml);
      for (const entry of parsed.items || []) {
        if (!entry.link || !entry.title) continue;
        items.push({
          id: 'news-' + shortHash(entry.link),
          title: stripHtml(entry.title),
          link: entry.link,
          pubDate: entry.isoDate || new Date().toISOString(),
          source: feed.name,
          category: feed.category,
          description: stripHtml(entry.contentSnippet || entry.content || entry.summary || '').slice(0, 2500)
        });
      }
      log(`  ${feed.name}: ${parsed.items?.length || 0} items`);
    } catch (err) {
      log(`  ${feed.name}: FAILED (${err.message})`);
    }
  }
  return items;
}

function baseArticle(item) {
  return {
    id: item.id,
    slug: slugify(item.title),
    category: item.category,
    discipline: item.category,
    image: '',
    sourceName: item.source,
    sourceUrl: item.link,
    sourceDescription: item.description, // kept for fact-checking and later rewrites
    likes: 0,
    comments: 0,
    status: 'published',
    draft: !config.publishArticlesDirectly,
    date: item.pubDate.slice(0, 10)
  };
}

// Plain source-linked summary. When the AI was only temporarily unavailable the
// brief is marked so a later run can rewrite it (up to MAX_AI_ATTEMPTS times).
function newsBrief(item, aiAttempts = 0) {
  return {
    ...baseArticle(item),
    title: item.title,
    excerpt: item.description.slice(0, 160),
    content: item.description.slice(0, 600),
    author: item.source,
    tags: [item.category],
    taggedFighters: [],
    isAIPreview: false,
    aiAttempts
  };
}

const MAX_AI_ATTEMPTS = 3;
const RETRY_WINDOW_MS = 3 * 86400000;

// Briefs saved while the AI was busy, rebuilt as feed items for another attempt
function pendingRewrites(articles) {
  return articles
    .filter(a => a.id.startsWith('news-') && a.isAIPreview === false && (a.aiAttempts || 0) < MAX_AI_ATTEMPTS
      && a.sourceUrl && (Date.now() - new Date(a.createdAt || a.date).getTime()) < RETRY_WINDOW_MS)
    .map(a => ({
      id: a.id,
      title: a.title,
      link: a.sourceUrl,
      source: a.sourceName,
      category: a.category,
      description: a.sourceDescription || a.content || '',
      pubDate: a.date ? `${a.date}T00:00:00Z` : new Date().toISOString(),
      aiAttempts: a.aiAttempts || 0,
      createdAt: a.createdAt
    }));
}

async function aiArticle(item) {
  const prompt = `Rewrite this combat sports news item as a short article for FightHub.

NEWS ITEM
Title: ${item.title}
Source: ${item.source}
Details: ${item.description || '(no details beyond the title)'}

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}

RULES
- Use ONLY facts stated in the news item. Never add records, dates, venues, results, quotes, odds or rumours that are not in it.
- Tense matters. Do NOT say a fight has happened, or give a result, unless the item explicitly says it took place. Headlines like "eyes title shot with win", "targets", "set for", "ahead of" describe FUTURE fights: write them as upcoming.
- Do not invent context such as "speaking after the fight" or "in a press conference" unless the item says so.
- Length follows the source: 60-120 words if the details are brief, up to 180 words if they are rich. Never pad with invented facts.
- Neutral, clear sports-journalism tone. No clickbait.
- "taggedFighters": full names of every fighter named in the item (empty list if none).
- "category": one of ${CATEGORIES.join(', ')}. Use UFC/ONE/PFL when the story is about that promotion.
- "prediction": only for an upcoming fight, one sentence of clearly-labelled analysis; otherwise "".

Reply with JSON only:
{"title": "...", "excerpt": "one sentence", "content": "the article", "category": "...", "taggedFighters": ["..."], "tags": ["..."], "prediction": ""}`;

  const { json, model } = await askJson(prompt);
  if (!json.title || !json.content) throw new Error('AI reply missing title/content');

  return {
    ...baseArticle(item),
    title: String(json.title).slice(0, 200),
    excerpt: String(json.excerpt || '').slice(0, 300),
    content: String(json.content).slice(0, 3000),
    category: CATEGORIES.includes(json.category) ? json.category : item.category,
    taggedFighters: Array.isArray(json.taggedFighters) ? json.taggedFighters.map(String).slice(0, 10) : [],
    tags: Array.isArray(json.tags) ? json.tags.map(String).slice(0, 8) : [item.category],
    prediction: String(json.prediction || '').slice(0, 300),
    author: `FightHub AI (source: ${item.source})`,
    aiModel: model,
    promptVersion: PROMPT_VERSION,
    isAIPreview: true
  };
}

const STOPWORDS = new Set(('a an the and or of for to in on at by with vs v versus is are was be as it its his her their from after '
  + 'over into set says say said will could would new report official officially finally announced announces confirms').split(' '));

function keywords(title) {
  return new Set(title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w)));
}

// Two headlines are treated as the same story when they share most key words
// ("Fury vs. Joshua set for Dec. 11 in Cardiff" / "Fury v Joshua announced for 11 December in Cardiff")
function sameStory(a, b) {
  const shared = [...a].filter(w => b.has(w)).length;
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.6;
}

const baseModel = m => String(m || '').replace(/:free$/, '');

export async function runNews(state) {
  log('NEWS: fetching feeds');
  // Articles written by a model no longer on the approved list, or under older
  // writing rules, are rewritten from the original feed item (while still in the feed)
  const approved = new Set(config.models.map(baseModel));
  const redoIds = new Set(state.articles
    .filter(a => a.isAIPreview && !a.duplicate && a.aiModel
      && (!approved.has(baseModel(a.aiModel)) || (a.promptVersion || 1) < PROMPT_VERSION))
    .map(a => a.id));
  const current = state.articles.filter(a => !redoIds.has(a.id));

  const known = new Set(current.map(a => a.id));
  const knownTitles = new Set(current.map(a => (a.title || '').toLowerCase()));

  const fresh = (await fetchFeedItems())
    .filter(item => !known.has(item.id) && !knownTitles.has(item.title.toLowerCase()))
    // Very short titles ("Boxing schedule") are standing pages, not news stories
    .filter(item => item.title.split(/\s+/).length >= 4)
    // Live shows, podcasts and videos aren't articles
    .filter(item => !/\b(live now|livestream|live stream|live blog|podcast|watch live|video)\b|^btl\b/i.test(item.title))
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate));

  // Deduplicate the same story carried by two feeds
  const seen = new Set();
  const unique = fresh.filter(item => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Round-robin across feeds (newest first within each) so every sport gets coverage
  const byFeed = new Map();
  unique.forEach(item => {
    const key = `${item.source}|${item.category}`;
    if (!byFeed.has(key)) byFeed.set(key, []);
    byFeed.get(key).push(item);
  });
  const queues = [...byFeed.values()];
  const recentTitles = (excludeIds = new Set()) => current
    .filter(a => !excludeIds.has(a.id) && !a.duplicate && a.date && (Date.now() - new Date(a.date).getTime()) < 7 * 86400000)
    .map(a => keywords(a.title || ''));
  const toProcess = unique.filter(item => redoIds.has(item.id));
  queues.forEach(q => q.splice(0, q.length, ...q.filter(item => !redoIds.has(item.id))));
  if (toProcess.length) log(`NEWS: rewriting ${toProcess.length} article(s) written by an unapproved model or older rules`);
  const covered = recentTitles();
  while (toProcess.length < config.maxArticlesPerRun && queues.some(q => q.length)) {
    for (const q of queues) {
      if (!q.length || toProcess.length >= config.maxArticlesPerRun) continue;
      const item = q.shift();
      const words = keywords(item.title);
      if (covered.some(c => sameStory(c, words))) continue; // already covered this week
      covered.push(words);
      toProcess.push(item);
    }
  }

  // Earlier briefs waiting for an AI rewrite go first, within the same per-run cap
  const retries = aiAvailable() ? pendingRewrites(state.articles).slice(0, Math.ceil(config.maxArticlesPerRun / 2)) : [];
  // Corrections to live articles first, then waiting briefs, then new stories
  const redoFirst = toProcess.filter(item => redoIds.has(item.id));
  const newStories = toProcess.filter(item => !redoIds.has(item.id));
  const queue = [...redoFirst, ...retries, ...newStories].slice(0, config.maxArticlesPerRun);

  log(`NEWS: ${fresh.length} new stories; processing ${queue.length} (${retries.length} rewrite retries)`);
  const articles = [];
  // Rewritten headlines match far better than raw ones across outlets, so each
  // AI title is checked against this week's titles to catch the same story twice
  const publishedTitles = recentTitles(new Set(queue.map(item => item.id)));
  let aiBlocked = false; // once every model has failed, stop spending quota this run
  for (const item of queue) {
    const attempts = (item.aiAttempts || 0) + 1;
    let article;
    if (aiAvailable() && !aiBlocked) {
      try {
        article = await aiArticle(item);
        const words = keywords(article.title);
        if (publishedTitles.some(t => sameStory(t, words))) {
          // Kept hidden (not deleted) so the feed item isn't picked up again
          Object.assign(article, { draft: true, duplicate: true });
          log(`  = duplicate of an existing story, hidden: "${article.title}"`);
        } else {
          publishedTitles.push(words);
          log(`  + "${article.title}" (${article.aiModel})`);
        }
      } catch (err) {
        log(`  ! AI failed for "${item.title}": ${err.message}; saved as brief, will retry`);
        if (/No model available/.test(err.message)) aiBlocked = true;
        article = newsBrief(item, attempts);
      }
    } else {
      article = newsBrief(item, aiAvailable() ? item.aiAttempts || 0 : MAX_AI_ATTEMPTS);
      log(`  + brief: "${item.title}"`);
    }
    if (item.createdAt) article.createdAt = item.createdAt;
    articles.push(article);
    (article.taggedFighters || []).forEach(name => state.mentionedFighters.add(name));
  }

  await upsert('articles', articles);
  const byId = new Map(state.articles.map(a => [a.id, a]));
  articles.forEach(a => byId.set(a.id, a));
  state.articles = [...byId.values()];
  state.summary.articles = articles.filter(a => a.isAIPreview && !a.duplicate).length;
  state.summary.duplicates = articles.filter(a => a.duplicate).length;
  state.summary.briefs = articles.filter(a => !a.isAIPreview).length;
}
