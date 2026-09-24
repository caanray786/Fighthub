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
  // Used only when every free model is busy. ~$0.0008 per fighter profile at
  // 2026-09 prices. Set the repo variable OPENROUTER_PAID_MODELS to "none" to disable.
  paidModels: (env.OPENROUTER_PAID_MODELS || 'google/gemma-4-31b-it,nvidia/nemotron-3-super-120b-a12b')
    .split(',').map(s => s.trim()).filter(s => s && s !== 'none'),

  // Free OpenRouter models allow ~50 requests/day without purchased credits, so each
  // run is capped. At 6 runs/day: (4 + 2) * 6 = 36 AI calls/day.
  maxArticlesPerRun: parseInt(env.MAX_ARTICLES_PER_RUN || '4', 10),
  maxNewFightersPerRun: parseInt(env.MAX_NEW_FIGHTERS_PER_RUN || '2', 10),
  maxPhotosPerRun: parseInt(env.MAX_PHOTOS_PER_RUN || '10', 10),
  // In-depth martial arts guides (26 in total; ~1 AI call each)
  maxStylesPerRun: parseInt(env.MAX_STYLES_PER_RUN || '6', 10),
  // Fighter import from Wikipedia champion / Hall of Fame lists (~1 AI call each)
  maxBackfillPerRun: parseInt(env.MAX_BACKFILL_PER_RUN || '20', 10),
  // Imported profiles have records read straight from Wikipedia, so they publish
  // directly; set BACKFILL_AS_DRAFTS=true to review each one first
  backfillAsDrafts: env.BACKFILL_AS_DRAFTS === 'true',
  // Club directory: OpenStreetMap regions imported per run (no AI used)
  maxClubRegionsPerRun: parseInt(env.MAX_CLUB_REGIONS_PER_RUN || '4', 10),
  // Stop starting new work after this long (GitHub job timeout is 30 min)
  maxRunMinutes: parseInt(env.MAX_RUN_MINUTES || '22', 10),

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
