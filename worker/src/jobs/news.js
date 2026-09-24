// News: pull RSS feeds, rewrite new stories with the AI (facts from the source
// only), tag fighters, and publish with a link back to the original.

import Parser from 'rss-parser';
import { config } from '../config.js';
import { log } from '../log.js';
import { askJson, aiAvailable } from '../openrouter.js';
import { upsert } from '../supabase.js';
import { shortHash, slugify, stripHtml } from '../util.js';

const CATEGORIES = ['UFC', 'MMA', 'Boxing', 'ONE', 'PFL', 'Muay Thai', 'Kickboxing', 'BJJ', 'General'];

async function fetchFeedItems() {
  const parser = new Parser({ timeout: 20000, headers: { 'User-Agent': config.userAgent } });
  const items = [];
  for (const feed of config.feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
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
    likes: 0,
    comments: 0,
    status: 'published',
    draft: !config.publishArticlesDirectly,
    date: item.pubDate.slice(0, 10)
  };
}

function newsBrief(item) {
  return {
    ...baseArticle(item),
    title: item.title,
    excerpt: item.description.slice(0, 160),
    content: item.description.slice(0, 600),
    author: item.source,
    tags: [item.category],
    taggedFighters: [],
    isAIPreview: false
  };
}

async function aiArticle(item) {
  const prompt = `Rewrite this combat sports news item as a short article for FightHub.

NEWS ITEM
Title: ${item.title}
Source: ${item.source}
Details: ${item.description || '(no details beyond the title)'}

RULES
- Use ONLY facts stated in the news item. Never add records, dates, venues, results, quotes, odds or rumours that are not in it.
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

export async function runNews(state) {
  log('NEWS: fetching feeds');
  const known = new Set(state.articles.map(a => a.id));
  const knownTitles = new Set(state.articles.map(a => (a.title || '').toLowerCase()));

  const fresh = (await fetchFeedItems())
    .filter(item => !known.has(item.id) && !knownTitles.has(item.title.toLowerCase()))
    // Very short titles ("Boxing schedule") are standing pages, not news stories
    .filter(item => item.title.split(/\s+/).length >= 4)
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
  const toProcess = [];
  const covered = state.articles
    .filter(a => a.date && (Date.now() - new Date(a.date).getTime()) < 7 * 86400000)
    .map(a => keywords(a.title || ''));
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

  log(`NEWS: ${fresh.length} new stories, processing ${toProcess.length}`);
  const articles = [];
  for (const item of toProcess) {
    let article;
    if (aiAvailable()) {
      try {
        article = await aiArticle(item);
        log(`  + "${article.title}" (${article.aiModel})`);
      } catch (err) {
        log(`  ! AI failed for "${item.title}": ${err.message}; saving as brief`);
        article = newsBrief(item);
      }
    } else {
      article = newsBrief(item);
      log(`  + brief: "${item.title}"`);
    }
    articles.push(article);
    (article.taggedFighters || []).forEach(name => state.mentionedFighters.add(name));
  }

  await upsert('articles', articles);
  state.articles.push(...articles);
  state.summary.articles = articles.length;
}
