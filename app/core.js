/* Fight Hub app core: screen state, navigation and the base screens.
   Feature modules (training, routine, HIIT, mobility, membership...) load after
   this file and wrap render() to add or replace their own screens. */

const SITE_URL = 'https://www.fighthub.world';
const appKey = 'fight-hub-app-v1';
const labels = { welcome: 'Welcome', setup: 'Setup', today: 'Today', plan: 'Weekly plan', workout: 'Workout', review: 'Weekly review', explore: 'Explore' };
let state;
const screen = document.querySelector('#screen');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Onboarding answers and the chosen mode survive app restarts
function loadApp() {
  try { return JSON.parse(localStorage.getItem(appKey) || '{}') || {}; } catch { return {}; }
}
function saveApp() {
  try { localStorage.setItem(appKey, JSON.stringify({ onboarded: state.onboarded, mode: state.mode, interest: state.interest })); } catch { /* storage unavailable */ }
}

function reset() {
  const saved = loadApp();
  state = { page: saved.onboarded ? 'today' : 'welcome', goal: 'Get fitter', setting: 'Home', interest: saved.interest || 'All', mode: saved.mode || 'train', onboarded: !!saved.onboarded, done: false, moved: false, checked: false, paused: false };
  render();
}
function go(page) {
  state.page = page;
  render();
  screen.scrollTop = 0;
  screen.querySelector('h2')?.focus({ preventScroll: true });
}
const button = (text, action, cls = '') => `<button class="${cls}" data-action="${action}">${text}</button>`;
const title = (eyebrow, heading) => `<div class="eyebrow">${eyebrow}</div><h2 tabindex="-1">${heading}</h2>`;
function week() {
  return `<div class="week" aria-label="Your week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<div class="day ${[0, 2, state.moved ? 5 : 4].includes(i) ? 'active' : ''}">${d}<b>${i + 1}</b></div>`).join('')}</div>`;
}

/* ---- Live FightHub feed (news and the next fight night) ---- */
const feed = { articles: null, events: null, error: '', loading: false };
const FEED_SPORTS = { All: null, Boxing: ['Boxing'], MMA: ['MMA', 'UFC', 'PFL'], 'Muay Thai': ['ONE', 'Muay Thai', 'Kickboxing'], BJJ: ['BJJ'] };

async function loadFeed() {
  if (feed.loading || feed.articles) return;
  const cfg = window.FIGHTHUB_CONFIG || {};
  if (!cfg.supabaseUrl) { feed.error = 'The news feed is not configured.'; return; }
  feed.loading = true;
  const get = path => fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { headers: { apikey: cfg.supabaseAnonKey } })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  try {
    const [articles, events] = await Promise.all([
      get('articles?select=id,doc&order=doc->>date.desc&limit=40'),
      get('events?select=id,doc')
    ]);
    feed.articles = articles.map(r => ({ id: r.id, ...r.doc })).filter(a => a.status !== 'draft' && !a.draft);
    const today = new Date().toISOString().slice(0, 10);
    feed.events = events.map(r => ({ id: r.id, ...r.doc }))
      .filter(e => e.date >= today && e.status !== 'completed')
      .sort((a, b) => a.date.localeCompare(b.date));
    feed.error = '';
  } catch {
    feed.error = 'Could not load the latest news. Check your connection and try again.';
  } finally {
    feed.loading = false;
    if (['explore', 'today'].includes(state.page)) render();
  }
}

const niceDate = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function feedMarkup() {
  const chips = `<div class="chips">${Object.keys(FEED_SPORTS).map(s => `<button data-sport="${s}" aria-pressed="${state.interest === s}">${s}</button>`).join('')}</div>`;
  if (!feed.articles) {
    loadFeed();
    return chips + (feed.error
      ? `<div class="card"><p>${esc(feed.error)}</p>${button('Try again', 'retry-feed', 'full')}</div>`
      : '<p class="small" role="status">Loading the latest fight news…</p>');
  }
  const cats = FEED_SPORTS[state.interest];
  const news = feed.articles.filter(a => !cats || cats.includes(a.category)).slice(0, 12);
  const next = feed.events.find(e => (e.fights || []).length) || feed.events[0];
  const place = e => [e.venue, e.city, e.country].filter(v => v && v !== 'TBA').join(', ');
  return chips
    + (next ? `<a class="card feature feed-event" href="${SITE_URL}/events.html" target="_blank" rel="noopener">
        <span class="eyebrow">Next fight night · ${esc(niceDate(next.date))}</span>
        <h3>${esc(next.name)}</h3>
        <p class="small">${esc((next.fights || [])[0] || 'Card to be announced')}${place(next) ? ' · ' + esc(place(next)) : ''}</p>
      </a>` : '')
    + `<h3 class="feed-heading">Latest ${state.interest === 'All' ? '' : esc(state.interest) + ' '}news</h3>`
    + (news.length ? news.map(a => `<a class="feed-story" href="${SITE_URL}/news.html?id=${encodeURIComponent(a.id)}" target="_blank" rel="noopener">
        <span class="eyebrow">${esc(a.category || 'News')} · ${esc(niceDate(a.date))}</span>
        <strong>${esc(a.title)}</strong>
        ${a.sourceName ? `<span class="small">via ${esc(a.sourceName)}</span>` : ''}
      </a>`).join('') : '<p class="small">No recent stories in this category.</p>')
    + `<a class="button-link full" href="${SITE_URL}" target="_blank" rel="noopener">Open the FightHub website</a>`;
}

/* ---- Base screens ---- */
function render() {
  document.querySelector('#nav').innerHTML = [['today', 'Today'], ['plan', 'Train'], ['progress', 'Progress'], ['explore', 'Explore']]
    .map(([key, label]) => `<button data-go="${key}" ${state.page === key ? 'aria-current="page"' : ''}>${label}</button>`).join('');
  let html = '';
  if (state.page === 'welcome') html = title('Welcome to Fight Hub', 'Train like a fighter.<br>Follow the fight world.')
    + `<p>Weekly routines, 85 illustrated exercises, HIIT sessions and martial-arts mobility, with the latest boxing, MMA and Muay Thai news alongside.</p>
      <div class="card feature"><div class="eyebrow">Free to start</div><h3>Train. Follow. Progress.</h3><p class="small">Starter workouts, a mobility introduction and your training log are free. Premium unlocks the full library, HIIT, weekly routines and the session builder.</p></div>
      <label class="check"><input type="checkbox" id="age"> I am 18 or over</label>
      <button class="primary full" id="start" disabled>Set up my training week</button>
      ${button('Just follow the fight news', 'fan', 'full')}
      <p class="small">Check each exercise is suitable for you before starting, and stop if you feel pain or unwell.</p>`;
  if (state.page === 'today' && state.mode === 'fan') html = title('Your fight feed', 'The fight world,<br>in your pocket.') + feedMarkup()
    + `<div class="card"><h3>Ready to train?</h3><p class="small">Set up a weekly routine built around your days.</p>${button('Set up my training', 'train', 'primary full')}</div>`;
  if (state.page === 'explore') html = title('Explore', 'The fight world,<br>in your pocket.') + feedMarkup();
  if (state.page === 'review') html = title('Weekly review', 'Make room for<br>next week.')
    + `<div class="card feature"><div class="metric">0</div><strong>Sessions logged</strong><p class="small">Your completed sessions will appear here.</p></div>${button('Choose a session', 'training', 'primary full')}`;
  screen.innerHTML = html;
}

function options(values, selected) { return values.map(v => `<option ${v === selected ? 'selected' : ''}>${v}</option>`).join(''); }

document.addEventListener('change', e => {
  if (e.target.id === 'age') document.querySelector('#start').disabled = !e.target.checked;
  if (['goal', 'setting'].includes(e.target.id)) state[e.target.id] = e.target.value;
  if (e.target.id === 'complete') state.checked = e.target.checked;
});
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'start') { state.onboarded = true; state.mode = 'train'; saveApp(); return go('setup'); }
  if (b.dataset.go) return go(b.dataset.go);
  if (b.dataset.sport) { state.interest = b.dataset.sport; saveApp(); return render(); }
  const a = b.dataset.action;
  if (a === 'fan') { state.onboarded = true; state.mode = 'fan'; saveApp(); return go('today'); }
  if (a === 'train') { state.mode = 'train'; saveApp(); return go('setup'); }
  if (a === 'retry-feed') { feed.error = ''; loadFeed(); return render(); }
  if (a === 'move') { state.moved = !state.moved; return render(); }
  if (a === 'pause') { state.paused = !state.paused; return render(); }
  if (a === 'save') { state.done = true; return go('progress'); }
  if (a) go(a);
});
reset();
