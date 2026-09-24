/* ============================================
   FightHub — AI Content Bot Processing Layer
   Ingests RSS feeds and API fight cards, rewrites news items into
   short previews via OpenRouter, tags fighters & disciplines, and
   saves them to the dataStore.

   Every article keeps a link to its original source. Without an API key
   (or if the AI call fails) the item is stored as a plain news brief using
   the source's own headline and summary, never generated filler.
   ============================================ */

class ContentBotEngine {
  constructor() {
    this.model = localStorage.getItem('fighthub_model_id') || 'z-ai/glm-5.2';
    this.maxItemsPerRun = 5;
  }

  // Get active OpenRouter API key from cloud/dataStore
  async getApiKey() {
    if (window.dataStore && window.dataStore.getSecureKey) {
      const key = await window.dataStore.getSecureKey('openrouter');
      if (key) return key;
    }
    return localStorage.getItem('fighthub_openrouter_key') || '';
  }

  async setApiKey(key) {
    if (key) {
      if (window.dataStore && window.dataStore.saveSecureKey) {
        await window.dataStore.saveSecureKey('openrouter', key);
      } else {
        localStorage.setItem('fighthub_openrouter_key', key);
      }
    }
  }

  async runFullPipeline(logCallback = () => {}) {
    logCallback('⚡ Starting FightHub data pipeline...');

    // Step 1: Fight schedules
    logCallback('📡 [Step 1/4] Querying API-Sports schedule feed...');
    const schedules = await window.fightAPIService.fetchLiveSchedules();
    logCallback(schedules.length
      ? `✅ Received ${schedules.length} events.`
      : 'ℹ️ No schedule data (API-Sports key not set or feed unavailable). Skipping.');

    // Step 2: RSS news
    logCallback('📰 [Step 2/4] Pulling RSS news feeds...');
    const rssArticles = await window.rssParserService.fetchAllBreakingNews();
    logCallback(`✅ Fetched ${rssArticles.length} news items.`);

    // Only process stories we haven't stored before
    const fresh = [];
    for (const item of rssArticles) {
      if (fresh.length >= this.maxItemsPerRun) break;
      if (!(await window.dataStore.getById('articles', item.id))) fresh.push(item);
    }

    // Step 3: AI processing
    const apiKey = await this.getApiKey();
    logCallback(apiKey
      ? `🤖 [Step 3/4] Rewriting ${fresh.length} new stories via OpenRouter (${this.model})...`
      : `ℹ️ [Step 3/4] No OpenRouter key set, so saving ${fresh.length} new stories as source-linked briefs.`);

    const processedArticles = [];
    for (let i = 0; i < fresh.length; i++) {
      const item = fresh[i];
      logCallback(`  -> ${i + 1}/${fresh.length}: "${item.title.substring(0, 60)}"`);
      if (!apiKey) {
        processedArticles.push(this.buildNewsBrief(item));
        continue;
      }
      try {
        processedArticles.push(await this.generateFightPreview(item, apiKey));
      } catch (err) {
        logCallback(`  ⚠️ AI rewrite failed (${err.message}); saving as a news brief instead.`);
        processedArticles.push(this.buildNewsBrief(item));
      }
    }

    // Step 4: Save (upsert, so re-running never duplicates)
    logCallback('💾 [Step 4/4] Saving to database...');
    for (const article of processedArticles) {
      await window.dataStore.upsert('articles', article);
    }
    for (const event of schedules) {
      await window.dataStore.upsert('events', event);
    }

    logCallback('🎉 Pipeline complete.');

    return {
      status: 'success',
      schedulesCount: schedules.length,
      previewsCount: processedArticles.length,
      timestamp: new Date().toISOString()
    };
  }

  // Fields shared by AI previews and plain briefs
  baseArticle(rssItem) {
    return {
      id: rssItem.id,
      slug: rssItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category: rssItem.category,
      discipline: rssItem.category,
      image: rssItem.thumbnail,
      sourceName: rssItem.source,
      sourceUrl: rssItem.link,
      status: 'published',
      likes: 0,
      comments: 0,
      date: (rssItem.pubDate ? new Date(rssItem.pubDate) : new Date()).toISOString().split('T')[0]
    };
  }

  buildNewsBrief(rssItem) {
    const summary = rssItem.description.length > 280
      ? rssItem.description.substring(0, 277).trimEnd() + '...'
      : rssItem.description;
    return {
      ...this.baseArticle(rssItem),
      title: rssItem.title,
      excerpt: summary.substring(0, 140),
      content: summary,
      author: rssItem.source,
      tags: [rssItem.category],
      isAIPreview: false
    };
  }

  async generateFightPreview(rssItem, apiKey) {
    const prompt = `You are FightHub's combat sports editor. Rewrite the news item below as a ~150-word article in FightHub's voice.

NEWS ITEM:
Title: ${rssItem.title}
Source: ${rssItem.source}
Category: ${rssItem.category}
Details: ${rssItem.description}

RULES:
1. Use ONLY facts stated in the news item. Do not add records, dates, venues, results, quotes or odds that are not in it.
2. You may add general, widely known context about the fighters' styles, but nothing that could be a new factual claim.
3. List every fighter named in the item in "taggedFighters".
4. "prediction" is optional analysis; leave it as an empty string if the item isn't about an upcoming fight.
5. Output ONLY a JSON object with exactly these keys:
{"title": "...", "excerpt": "one-sentence hook", "content": "the ~150-word article", "taggedFighters": ["..."], "prediction": "", "tags": ["..."]}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'FightHub Content Bot'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error status: ${response.status}`);
    }

    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    if (!parsed.title || !parsed.content) throw new Error('AI response missing title/content');

    return {
      ...this.baseArticle(rssItem),
      title: String(parsed.title),
      excerpt: String(parsed.excerpt || ''),
      content: String(parsed.content),
      taggedFighters: Array.isArray(parsed.taggedFighters) ? parsed.taggedFighters.map(String) : [],
      prediction: String(parsed.prediction || ''),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [rssItem.category],
      author: `FightHub AI (source: ${rssItem.source})`,
      isAIPreview: true
    };
  }
}

window.contentBotEngine = new ContentBotEngine();
