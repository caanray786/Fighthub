/* ============================================
   FightHub — RSS News Feeds Parser Module
   Pulls breaking combat sports news from major feeds via rss2json.
   If every feed fails it returns an empty list; it never substitutes
   made-up headlines.
   ============================================ */

class RSSParserService {
  constructor() {
    this.feeds = [
      { name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/current', category: 'MMA' },
      { name: 'MMA Junkie', url: 'https://mmajunkie.usatoday.com/feed', category: 'MMA' },
      { name: 'BoxingScene', url: 'https://www.boxingscene.com/rss.xml', category: 'Boxing' },
      { name: 'Bad Left Hook', url: 'https://www.badlefthook.com/rss/current', category: 'Boxing' }
    ];
    this.proxy = 'https://api.rss2json.com/v1/api.json?rss_url=';
  }

  async fetchAllBreakingNews() {
    const results = await Promise.allSettled(this.feeds.map(feed => this.fetchFeed(feed)));
    const allArticles = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      } else {
        console.warn(`Failed fetching RSS feed ${this.feeds[i].name}:`, result.reason);
      }
    });
    return this.deduplicateAndSort(allArticles);
  }

  async fetchFeed(feed) {
    const response = await fetch(`${this.proxy}${encodeURIComponent(feed.url)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} from RSS proxy for ${feed.name}`);

    const data = await response.json();
    if (data.status !== 'ok' || !data.items) throw new Error(`Invalid response from RSS proxy for ${feed.name}`);

    return data.items.map(item => ({
      id: 'rss-' + this.hash(item.link || item.title),
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || new Date().toISOString(),
      source: feed.name,
      category: feed.category,
      author: item.author || feed.name,
      description: this.stripHtml(item.description || item.content || ''),
      thumbnail: item.thumbnail || item.enclosure?.link || ''
    }));
  }

  stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').trim();
  }

  // Stable id from the article URL so the same story is never stored twice.
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  deduplicateAndSort(articles) {
    const seenTitles = new Set();
    const unique = articles.filter(art => {
      const key = art.title.toLowerCase();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });
    return unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
}

window.rssParserService = new RSSParserService();
