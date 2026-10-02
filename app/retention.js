/* Reasons to come back: a weekly training goal, a monthly challenge,
   achievements and a technique of the day (from the member's discipline).
   Everything is worked out from the training journal and app session logs. */

const goalKey = 'fight-hub-goal-v1';
const badgesKey = 'fight-hub-badges-v1';
const retention = { goal: 3 };
try { retention.goal = Math.min(6, Math.max(1, JSON.parse(localStorage.getItem(goalKey) || '{}').days || 3)); } catch { /* default */ }

/* ---- Training days (journal entries plus sessions logged in the app) ---- */
function trainingDays() {
  const days = new Set(journal.entries.filter(e => e.type !== 'Rest / recovery').map(e => e.date));
  for (const h of training.history || []) if (h.date) days.add(isoDay(new Date(h.date)));
  return days;
}

function weekDays(offsetWeeks = 0) {
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return isoDay(d); });
}

function goalStreak(days) {
  // Consecutive weeks meeting the goal, counting this week only once it is met
  let streak = weekDays(0).filter(d => days.has(d)).length >= retention.goal ? 1 : 0;
  for (let w = 1; w < 520; w++) {
    if (weekDays(w).filter(d => days.has(d)).length >= retention.goal) streak++;
    else break;
  }
  return streak;
}

/* ---- Monthly challenge ---- */
const CHALLENGES = [
  { name: '100 rounds', target: 100, unit: 'rounds', measure: es => es.reduce((t, e) => t + (Number(e.rounds) || 0), 0), hint: 'Log the rounds from pads, bag work, sparring and the round timer.' },
  { name: '16 training days', target: 16, unit: 'days', measure: es => new Set(es.filter(e => e.type !== 'Rest / recovery').map(e => e.date)).size, hint: 'Any session counts: gym, class, run or at home.' },
  { name: '600 minutes of training', target: 600, unit: 'minutes', measure: es => es.reduce((t, e) => t + (Number(e.minutes) || 0), 0), hint: 'Ten hours this month, from every kind of session.' },
  { name: '10 flexibility sessions', target: 10, unit: 'sessions', measure: es => es.filter(e => e.type === 'Flexibility').length, hint: 'The Splits and high kicks programme makes this easy.' },
  { name: '8 runs', target: 8, unit: 'runs', measure: es => es.filter(e => e.type === 'Run / roadwork').length, hint: 'Roadwork builds the engine that recovers you between rounds.' },
  { name: '3 different disciplines', target: 3, unit: 'disciplines', measure: es => new Set(es.map(e => e.art).filter(Boolean)).size, hint: 'Cross-train: try a session from another martial art.' }
];

function monthChallenge(date = new Date()) {
  const c = CHALLENGES[(date.getFullYear() * 12 + date.getMonth()) % CHALLENGES.length];
  const prefix = isoDay(date).slice(0, 7);
  const done = c.measure(journal.entries.filter(e => e.date.startsWith(prefix)));
  const daysLeft = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - date.getDate();
  return { ...c, month: date.toLocaleDateString(appLocale(), { month: 'long' }), done: Math.min(done, c.target), complete: done >= c.target, daysLeft };
}

/* ---- Achievements ---- */
function journalTotals() {
  const es = journal.entries.filter(e => e.type !== 'Rest / recovery');
  const days = [...trainingDays()].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && (dayFrom(d) - dayFrom(prev)) / 86400000 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const months = new Set(journal.entries.map(e => e.date.slice(0, 7)));
  const challengesWon = [...months].filter(m => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1, 28); return monthChallenge(d).complete; }).length;
  return {
    sessions: es.length + (training.history || []).length,
    rounds: es.reduce((t, e) => t + (Number(e.rounds) || 0), 0),
    minutes: es.reduce((t, e) => t + (Number(e.minutes) || 0), 0),
    arts: new Set(es.map(e => e.art).filter(Boolean)).size,
    bestStreak: best,
    goalWeeks: goalStreak(trainingDays()),
    challengesWon
  };
}

const ACHIEVEMENTS = [
  { id: 'first', name: 'First session', icon: 'flame', key: 'sessions', target: 1, text: 'Log your first session.' },
  { id: 'sessions-10', name: 'Ten sessions', icon: 'target', key: 'sessions', target: 10, text: 'Log 10 sessions.' },
  { id: 'sessions-25', name: 'Committed', icon: 'target', key: 'sessions', target: 25, text: 'Log 25 sessions.' },
  { id: 'sessions-50', name: 'Fighter’s habit', icon: 'trophy', key: 'sessions', target: 50, text: 'Log 50 sessions.' },
  { id: 'sessions-100', name: 'Centurion', icon: 'crown', key: 'sessions', target: 100, text: 'Log 100 sessions.' },
  { id: 'streak-3', name: 'On a roll', icon: 'flame', key: 'bestStreak', target: 3, text: 'Train 3 days in a row.' },
  { id: 'streak-7', name: 'Seven straight', icon: 'flame', key: 'bestStreak', target: 7, text: 'Train 7 days in a row.' },
  { id: 'rounds-100', name: '100 rounds', icon: 'timer', key: 'rounds', target: 100, text: 'Log 100 rounds.' },
  { id: 'rounds-500', name: '500 rounds', icon: 'timer', key: 'rounds', target: 500, text: 'Log 500 rounds.' },
  { id: 'hours-10', name: 'Ten hours', icon: 'clock', key: 'minutes', target: 600, text: 'Log 10 hours of training.' },
  { id: 'hours-50', name: 'Fifty hours', icon: 'clock', key: 'minutes', target: 3000, text: 'Log 50 hours of training.' },
  { id: 'arts-3', name: 'Cross-trainer', icon: 'users', key: 'arts', target: 3, text: 'Train 3 different disciplines.' },
  { id: 'arts-9', name: 'Complete martial artist', icon: 'crown', key: 'arts', target: 9, text: 'Train all 9 disciplines.' },
  { id: 'goal-4', name: 'Four-week streak', icon: 'calendar', key: 'goalWeeks', target: 4, text: 'Meet your weekly goal 4 weeks running.' },
  { id: 'goal-12', name: 'Twelve-week streak', icon: 'calendar', key: 'goalWeeks', target: 12, text: 'Meet your weekly goal 12 weeks running.' },
  { id: 'challenge', name: 'Challenge champion', icon: 'trophy', key: 'challengesWon', target: 1, text: 'Complete a monthly challenge.' }
];

function achievementState() {
  const t = journalTotals();
  return ACHIEVEMENTS.map(a => ({ ...a, value: Math.min(t[a.key], a.target), unlocked: t[a.key] >= a.target }));
}

// Tell the member when they unlock something new
function checkNewAchievements() {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(badgesKey) || '[]'); } catch { /* none */ }
  const now = achievementState().filter(a => a.unlocked).map(a => a.id);
  const fresh = now.filter(id => !seen.includes(id));
  try { localStorage.setItem(badgesKey, JSON.stringify(now)); } catch { /* storage unavailable */ }
  if (seen.length || now.length <= 1) fresh.forEach((id, i) => setTimeout(() => toast(`Achievement unlocked: ${ACHIEVEMENTS.find(a => a.id === id).name}`), i * 2600));
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'app-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon('trophy')} <span>${esc(text)}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 20);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2400);
}

/* ---- Technique of the day (from the member's discipline when known) ---- */
function techniqueOfDay() {
  const art = (typeof account !== 'undefined' && account.profile?.discipline) || '';
  const skip = ['Warm-up', 'Running'];
  let pool = Object.entries(FightData.drills).filter(([, d]) => !skip.includes(d.t));
  const mine = pool.filter(([, d]) => art && d.arts.includes(art));
  if (mine.length >= 5) pool = mine;
  const day = Math.floor(Date.now() / 86400000);
  const [id, d] = pool[day % pool.length];
  return { id, ...d };
}

/* ---- Markup ---- */
function weekCard() {
  const days = trainingDays(), week = weekDays(0), today = isoDay(new Date());
  const done = week.filter(d => days.has(d)).length, streak = goalStreak(days);
  const c = monthChallenge();
  return `<div class="card week-card">
    <div class="row"><span class="eyebrow">Your week</span><button class="link-button" data-retention="goal">Goal: ${retention.goal} days</button></div>
    <h3>${done >= retention.goal ? 'Weekly goal done.' : `${done} of ${retention.goal} training days`}</h3>
    <div class="week-dots">${week.map((d, i) => `<span class="${days.has(d) ? 'on' : ''} ${d === today ? 'today' : ''}"><b>${weekdayLetters()[i]}</b></span>`).join('')}</div>
    <p class="small">${streak > 1 ? `${streak}-week goal streak. Keep it going.` : done >= retention.goal ? 'Goal met. Rest well or add a bonus session.' : 'Every session counts: gym, class, run or here in the app.'}</p>
    <div class="challenge-line"><span class="small"><strong>${esc(c.month)} challenge:</strong> ${esc(c.name)}</span><span class="small">${c.done}/${c.target}</span></div>
    <div class="meter"><span style="width:${Math.round((c.done / c.target) * 100)}%"></span></div>
    <button class="primary full" data-journal="new">${icon('plus')} Log a session</button>
  </div>`;
}

function techniqueCard() {
  const t = techniqueOfDay();
  const arts = t.arts.includes('all') ? 'All disciplines' : t.arts.map(a => FightData.arts.find(x => x.id === a)?.name).filter(Boolean).slice(0, 2).join(' · ');
  return `<div class="card technique-card"><span class="eyebrow">Technique of the day · ${esc(arts)}</span><h3>${esc(t.n)}</h3><p class="small">${esc(t.s[0])}</p><button class="full" data-fight="drill" data-id="${t.id}">Learn it</button></div>`;
}

function achievementsMarkup() {
  const list = achievementState();
  const c = monthChallenge();
  return title('Your progress', 'Achievements.')
    + `<div class="card feature"><span class="eyebrow">${esc(c.month)} challenge</span><h3>${esc(c.name)}</h3><p class="small">${esc(c.hint)}</p>
        <div class="challenge-line"><span class="small">${c.complete ? 'Complete. Well done.' : `${c.daysLeft} days left`}</span><span class="small">${c.done}/${c.target} ${esc(c.unit)}</span></div>
        <div class="meter"><span style="width:${Math.round((c.done / c.target) * 100)}%"></span></div></div>
      <p class="small">${list.filter(a => a.unlocked).length} of ${list.length} unlocked</p>
      <div class="badge-grid">${list.map(a => `<div class="achievement ${a.unlocked ? 'unlocked' : ''}">
        <span class="achievement-icon">${icon(a.icon)}</span><strong>${esc(a.name)}</strong><span class="small">${a.unlocked ? esc(a.text) : `${a.value}/${a.target} · ${esc(a.text)}`}</span></div>`).join('')}</div>
      <button class="full" data-go="journal">Back to your journal</button>`;
}

const beforeRetention = render;
render = function () {
  beforeRetention();
  if (state.page === 'achievements') { screen.innerHTML = achievementsMarkup(); document.querySelector('#nav [data-go="journal"]')?.setAttribute('aria-current', 'page'); }
  if (state.page === 'today' && state.mode !== 'fan' && !screen.querySelector('.week-card')) {
    screen.querySelector('.journal-today')?.remove(); // the week card replaces it
    const heading = screen.querySelector('h2');
    (heading || screen.firstChild)?.insertAdjacentHTML?.('afterend', weekCard());
    const fightCard = screen.querySelector('.fight-today');
    (fightCard ? fightCard : screen.lastElementChild)?.insertAdjacentHTML('beforebegin', techniqueCard());
  }
  if (state.page === 'journal' && !screen.querySelector('.journal-achievements')) {
    const count = achievementState().filter(a => a.unlocked).length;
    screen.querySelector('.journal-chart')?.insertAdjacentHTML('afterend', `<button class="full journal-achievements" data-go="achievements">${icon('trophy')} Achievements: ${count} of ${ACHIEVEMENTS.length} · ${esc(monthChallenge().month)} challenge</button>`);
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-retention]');
  if (!b) return;
  if (b.dataset.retention === 'goal') {
    retention.goal = retention.goal >= 6 ? 2 : retention.goal + 1; // 2 to 6 days a week
    try { localStorage.setItem(goalKey, JSON.stringify({ days: retention.goal })); } catch { /* storage unavailable */ }
    render();
  }
});

// New achievements are announced after each journal save
const saveJournalBeforeRetention = saveJournal;
saveJournal = function (opts) {
  saveJournalBeforeRetention(opts);
  if (!opts?.skipSync) checkNewAchievements();
};
