// Worker configuration. Secrets come from environment variables (GitHub Actions
// secrets in production); nothing secret is ever committed to the repo.

const env = process.env;

export const config = {
  dryRun: process.argv.includes('--dry-run') || env.DRY_RUN === 'true',

  supabaseUrl: env.SUPABASE_URL || 'https://ewfuhrlgdivwtdremkdv.supabase.co',
  // Service role / secret key: bypasses row level security, so it must stay server-side.
  // In dry-run mode the public key is enough, because nothing is written.
  supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '',

  openRouterKey: env.OPENROUTER_API_KEY || '',
  // Primary model first; the worker falls back through the list when one is busy.
  // Only capable models: the openrouter/free router can pick tiny models that
  // invent facts, so if all of these are busy the story waits for the next run.
  models: (env.OPENROUTER_MODELS || 'z-ai/glm-5.2:free,google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free,nvidia/nemotron-3-super-120b-a12b:free')
    .split(',').map(s => s.trim()).filter(Boolean),

  // Free OpenRouter models allow ~50 requests/day without purchased credits, so each
  // run is capped. At 6 runs/day: (4 + 2) * 6 = 36 AI calls/day.
  maxArticlesPerRun: parseInt(env.MAX_ARTICLES_PER_RUN || '4', 10),
  maxNewFightersPerRun: parseInt(env.MAX_NEW_FIGHTERS_PER_RUN || '2', 10),
  maxPhotosPerRun: parseInt(env.MAX_PHOTOS_PER_RUN || '10', 10),

  // New fighter profiles wait in the admin review queue; news publishes directly.
  publishArticlesDirectly: env.PUBLISH_ARTICLES_DIRECTLY !== 'false',

  userAgent: 'FightHubBot/1.0 (+https://fighthub-swart.vercel.app)',

  // Checked 2026-09-24. Stories are rotated across feeds so no single source dominates.
  feeds: [
    { name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/index.xml', category: 'MMA' },
    { name: 'Sherdog', url: 'https://www.sherdog.com/rss/news.xml', category: 'MMA' },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml', category: 'MMA' },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/boxing/rss.xml', category: 'Boxing' },
    // ESPN's feeds block GitHub's servers, so they are not used
    { name: 'Bad Left Hook', url: 'https://www.badlefthook.com/rss/index.xml', category: 'Boxing' },
    { name: 'Boxing News', url: 'https://www.boxingnewsonline.net/feed/', category: 'Boxing' },
    { name: 'ONE Championship', url: 'https://www.onefc.com/feed/', category: 'ONE' },
    { name: 'BJJEE', url: 'https://www.bjjee.com/feed/', category: 'BJJ' }
  ]
};
