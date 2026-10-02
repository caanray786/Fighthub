/* Weekly recap: early each week, Today shows how last week went (sessions,
   minutes, weekly goal and streak) with a fresh start for the new week.
   It can be shared, and dismissed until the next week. Everything is worked
   out on the phone from the journal and logged sessions. */

const RECAP_KEY = 'fight-hub-recap-dismissed';

function lastWeekRecap() {
  const days = trainingDays();
  const week = weekDays(1);
  const inWeek = new Set(week);
  const entries = journal.entries.filter(e => inWeek.has(e.date) && e.type !== 'Rest / recovery');
  const trained = week.filter(d => days.has(d)).length;
  const minutes = entries.reduce((t, e) => t + (Number(e.minutes) || 0), 0);
  const rounds = entries.reduce((t, e) => t + (Number(e.rounds) || 0), 0);
  const longest = entries.reduce((best, e) => ((Number(e.minutes) || 0) > (Number(best?.minutes) || 0) ? e : best), null);
  return { weekStart: week[0], trained, minutes, rounds, longest, goal: retention.goal, hit: trained >= retention.goal, streak: goalStreak(days) };
}

function recapMarkup(r) {
  const art = r.longest && FightData.arts.find(a => a.id === r.longest.art)?.name;
  const longest = r.longest?.minutes
    ? `Longest session: ${esc(art || r.longest.type)}, ${r.longest.minutes} min on ${dayFrom(r.longest.date).toLocaleDateString(appLocale(), { weekday: 'long' })}.`
    : '';
  const headline = r.trained
    ? `${r.trained} ${r.trained === 1 ? 'session' : 'sessions'}${r.minutes ? ` · ${r.minutes} minutes` : ''}${r.rounds ? ` · ${r.rounds} rounds` : ''}`
    : 'A quiet week';
  const verdict = r.hit
    ? `Weekly goal hit (${r.trained} of ${r.goal}).${r.streak > 1 ? ` That’s a ${r.streak}-week streak.` : ''} Keep it rolling.`
    : r.trained
      ? `${r.trained} of ${r.goal} training days. This week’s a fresh start: ${r.goal} days is the target.`
      : `No sessions logged. This week’s a fresh start: aim for ${r.goal} days, even short ones count.`;
  return `<div class="card recap-card"><span class="eyebrow">Last week</span><h3>${headline}</h3>
    <p class="small">${verdict}${longest ? ` ${longest}` : ''}</p>
    <div class="row-buttons">${r.trained ? `<button data-recap="share">${icon('share')} Share</button>` : ''}<button data-recap="dismiss">Got it</button></div></div>`;
}

const beforeRecap = render;
render = function () {
  beforeRecap();
  if (state.page !== 'today' || state.mode === 'fan' || needsSignIn() || screen.querySelector('.recap-card')) return;
  // Monday to Wednesday, once per week
  const weekday = (new Date().getDay() + 6) % 7;
  const r = lastWeekRecap();
  let dismissed = '';
  try { dismissed = localStorage.getItem(RECAP_KEY) || ''; } catch { /* ignore */ }
  const everTrained = journal.entries.length || (training.history || []).length;
  if (weekday > 2 || dismissed === r.weekStart || !everTrained) return;
  (screen.querySelector('.week-card') || screen.querySelector('h2'))?.insertAdjacentHTML(screen.querySelector('.week-card') ? 'beforebegin' : 'afterend', recapMarkup(r));
};

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-recap]');
  if (!b) return;
  const r = lastWeekRecap();
  if (b.dataset.recap === 'dismiss') {
    try { localStorage.setItem(RECAP_KEY, r.weekStart); } catch { /* ignore */ }
    return render();
  }
  const text = `My Fight Hub week: ${r.trained} ${r.trained === 1 ? 'session' : 'sessions'}${r.minutes ? `, ${r.minutes} minutes` : ''}${r.streak > 1 ? `, a ${r.streak}-week streak` : ''}. Train with me:`;
  const url = `${SITE_URL}/app/`;
  try {
    if (navigator.share) await navigator.share({ text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); b.textContent = 'Copied'; }
  } catch { /* cancelled */ }
});
