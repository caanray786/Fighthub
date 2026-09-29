/* Fight training: disciplines, round-based sessions, multi-week programmes,
   the drill library and the round timer (bell, 10-second warning, spoken
   callouts, screen kept awake). Content lives in fight-data.js. */

const fight = { art: null, session: null, programme: null, week: 1, day: 0, drill: null, back: 'fight', artFilter: 'all', run: null, done: null, painted: -1 };
const fightPrefsKey = 'fight-hub-fight-prefs-v1';
try { Object.assign(fight, { voice: true, sound: true }, JSON.parse(localStorage.getItem(fightPrefsKey) || '{}')); } catch { fight.voice = true; fight.sound = true; }
const saveFightPrefs = () => { try { localStorage.setItem(fightPrefsKey, JSON.stringify({ voice: fight.voice, sound: fight.sound })); } catch { /* storage unavailable */ } };

const fbtn = (text, action, id = '', cls = 'full') => `<button class="${cls}" data-fight="${action}" data-id="${esc(id)}">${text}</button>`;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const minutesOf = s => Math.round(s / 60);
const artById = id => FightData.arts.find(a => a.id === id);
const sessionById = id => FightData.sessions.find(s => s.id === id);
const programmeById = id => FightData.programmes.find(p => p.id === id);

// A drill from the fight library, or an exercise from the main library (with its illustration)
function drillInfo(id) {
  if (id === 'rest') return { name: 'Rest', steps: ['Breathe and recover.'], cue: '', easy: '', media: false };
  const d = FightData.getDrill(id);
  if (d) return { name: d.n, type: d.t, eq: d.eq, level: d.lv, steps: d.s, cue: d.c, easy: d.e, hard: d.h, safety: d.w, media: false };
  const e = ex(id), c = e && ExerciseContent.get(id);
  if (e) return { name: e.name, type: e.body, eq: e.equipment, level: e.level, steps: c?.steps || [e.description], cue: c?.cue || '', easy: c?.easy || '', media: ExerciseMedia.has(id) };
  return { name: id, steps: [], cue: '', easy: '', media: false };
}

const sessionUnlocked = s => s.free || training.premium;
const weekUnlocked = (p, week) => p.freeWeeks.includes(week) || training.premium;

function lockTo(reason) {
  upgradeReason = reason;
  go('premium');
}

/* ---- Sound: synthesised bell and clapper (no audio files needed) ---- */
let audioCtx = null;
function tone(freq, start, length, volume = 0.35) {
  if (!fight.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + start;
    [1, 2.76, 5.4].forEach((mult, i) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.frequency.value = freq * mult;
      gain.gain.setValueAtTime(volume / (i + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + length);
    });
  } catch { /* audio unavailable */ }
}
const bell = (times = 1) => { for (let i = 0; i < times; i++) tone(830, i * 0.45, 1.4); };
const clap = () => { tone(1900, 0, 0.08, 0.3); tone(1900, 0.18, 0.08, 0.3); };
const chime = () => tone(660, 0, 0.8, 0.25);

function say(text) {
  if (!fight.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}

/* ---- Keep the screen awake while a session runs ---- */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* not supported or refused */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && fight.run?.running) keepAwake(true); });

/* ---- Runner ---- */
const fElapsed = () => fight.run.elapsed + (fight.run.running ? (performance.now() - fight.run.started) / 1000 : 0);

function startRun(title, phases, meta) {
  // Phones only allow sound that starts from a tap, so unlock audio now
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* audio unavailable */ }
  fight.run = { title, phases, meta, elapsed: 0, started: performance.now(), running: true, lastIndex: -1, warned: -1 };
  keepAwake(true);
  go('fight-run');
}

function announce(phase) {
  const info = drillInfo(phase.id);
  if (phase.kind === 'Round') {
    bell(1);
    say(`Round ${phase.round}. ${phase.focus || info.name}`);
  } else if (phase.kind === 'Rest') {
    bell(3);
    say(`Rest. ${phase.focus || ''}`);
  } else if (['Sprint', 'Run'].includes(phase.kind)) {
    bell(1);
    say(`${phase.kind === 'Sprint' ? 'Go' : 'Run'}. ${phase.focus || ''}`);
  } else if (['Recover', 'Walk'].includes(phase.kind)) {
    chime();
    say(phase.kind === 'Walk' ? 'Walk.' : `Recover. ${phase.focus || ''}`);
  } else if (phase.kind === 'Contract') {
    clap();
    say('Contract. Press gently.');
  } else if (phase.kind === 'Relax') {
    chime();
    say('Relax and ease deeper.');
  } else {
    chime();
    say(`${info.name}${phase.focus ? '. ' + phase.focus : ''}`);
  }
}

function paintRun() {
  if (state.page !== 'fight-run' || !fight.run) return;
  const run = fight.run, p = IntervalModel.position(run.phases, fElapsed());
  if (p.finished) {
    if (run.running) {
      run.elapsed = fElapsed();
      run.running = false;
      bell(3);
      say('Session complete. Great work.');
      keepAwake(false);
      finishRun(true);
    }
    return;
  }
  const phase = run.phases[p.index];
  if (run.lastIndex !== p.index) {
    if (run.running) announce(phase);
    run.lastIndex = p.index;
    run.warned = -1;
    paintPhase(phase, p.index);
  }
  if (run.running && ['Round', 'Sprint'].includes(phase.kind) && phase.seconds >= 30 && p.remaining === 10 && run.warned !== p.index) {
    run.warned = p.index;
    clap();
  }
  const clock = document.getElementById('fight-clock');
  if (clock) clock.textContent = mmss(p.remaining);
  const bar = document.getElementById('fight-bar');
  if (bar) bar.style.width = `${100 - (p.remaining / phase.seconds) * 100}%`;
  const total = run.phases.reduce((t, x) => t + x.seconds, 0);
  const left = document.getElementById('fight-left');
  if (left) left.textContent = `${mmss(Math.max(0, total - fElapsed()))} left`;
}

function paintPhase(phase, index) {
  const info = drillInfo(phase.id);
  const next = fight.run.phases[index + 1];
  const kindLabel = phase.kind === 'Round' ? `Round ${phase.round} of ${phase.of}` : phase.round && ['Sprint', 'Run'].includes(phase.kind) ? `${phase.kind} ${phase.round}` : phase.kind;
  const el = document.getElementById('fight-phase');
  if (!el) return;
  el.dataset.kind = phase.kind;
  el.innerHTML = `
    <span class="fight-kind">${esc(kindLabel)}</span>
    <h3>${esc(phase.kind === 'Rest' ? 'Rest' : info.name)}</h3>
    ${phase.focus ? `<p class="fight-focus">${esc(phase.focus)}</p>` : ''}`;
  document.getElementById('fight-next').textContent = next ? `Next: ${next.kind === 'Rest' ? 'rest' : drillInfo(next.id).name}${next.kind === 'Round' ? ` (round ${next.round})` : ''}` : 'Last one!';
  document.getElementById('fight-how').innerHTML = phase.id === 'rest' ? '' : drillMarkup(phase.id, false);
}

function finishRun(completed) {
  const run = fight.run;
  const done = run.phases.reduce((t, x) => t + x.seconds, 0);
  const secs = completed ? done : Math.min(done, Math.round(fElapsed()));
  // Rounds actually started before the session ended
  let start = 0, rounds = 0;
  for (const x of run.phases) { if (x.kind === 'Round' && start < secs) rounds++; start += x.seconds; }
  fight.done = { ...run.meta, title: run.title, minutes: Math.max(1, Math.round(secs / 60)), rounds, completed };
  fight.run = null;
  keepAwake(false);
  go('fight-done');
}

setInterval(() => { if (state.page === 'fight-run') paintRun(); }, 250);

/* ---- Markup ---- */
function drillMarkup(id, full = true) {
  const d = drillInfo(id);
  return `${d.media ? movementMedia(id) : ''}<div class="card">
    ${full ? '' : `<h3>How to do it</h3>`}
    <ol>${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${d.cue ? `<p class="fight-cue">${esc(d.cue)}</p>` : ''}
    ${d.easy ? `<details><summary>Make it easier</summary><p>${esc(d.easy)}</p></details>` : ''}
    ${d.hard ? `<details><summary>Make it harder</summary><p>${esc(d.hard)}</p></details>` : ''}
    ${d.safety ? `<p class="fight-safety">${icon('warning')} ${esc(d.safety)}</p>` : ''}
  </div>`;
}

const artImage = a => `assets/arts/${a.image}.webp`;
const lockBadge = unlocked => `<span class="badge">${unlocked ? 'FREE' : 'PREMIUM'}</span>`;

function sessionCard(s) {
  const unlocked = sessionUnlocked(s);
  return `<article class="fight-session-card">
    <div class="row"><span class="eyebrow">${esc(s.level)} · ${minutesOf(FightData.sessionSeconds(s))} min</span>${lockBadge(s.free)}</div>
    <h3>${esc(s.name)}</h3>
    <p class="small">${s.plan.length} rounds × ${mmss(s.work)} · ${mmss(s.rest)} rest · ${esc(s.eq)}</p>
    ${fbtn(unlocked ? 'View session' : 'Preview session', 'session', s.id, unlocked ? 'primary full' : 'full')}
  </article>`;
}

function hubMarkup() {
  return title('Fight training', 'Train like<br>a fighter.')
    + `<p>Round-based sessions for nine disciplines, a real splits programme and fighter roadwork. The timer rings the bell, warns you at 10 seconds and calls each round.</p>
    <div class="fight-arts">${FightData.arts.map(a => `
      <button class="fight-art" data-fight="art" data-id="${a.id}" style="background-image: linear-gradient(to top, rgba(8,8,11,.92) 15%, rgba(8,8,11,.15) 75%), url('${artImage(a)}')">
        <strong>${esc(a.name)}</strong>
        <span>${FightData.sessions.filter(s => s.art === a.id).length} sessions</span>
      </button>`).join('')}
    </div>
    <h3 class="feed-heading">Programmes</h3>
    ${FightData.programmes.map(p => `<article class="fight-session-card">
      <div class="row"><span class="eyebrow">${p.weeks} weeks · ${p.perWeek} sessions a week</span>${lockBadge(p.freeWeeks.length === p.weeks)}</div>
      <h3>${esc(p.name)}</h3>
      <p class="small">${esc(p.about)}</p>
      ${fbtn('Open programme', 'programme', p.id, 'full')}
    </article>`).join('')}
    ${fbtn(icon('search') + ' Drill library: every technique, step by step', 'drills', '', 'full')}
    <p class="draft-note">General training information, not individual coaching. Warm up first, work at your own level and stop if you feel pain, dizziness or feel unwell. Sparring and contact drills need a qualified coach.</p>`;
}

function artMarkup(a) {
  const list = FightData.sessions.filter(s => s.art === a.id);
  return `<div class="fight-hero" style="background-image: linear-gradient(to top, rgba(8,8,11,.95) 10%, rgba(8,8,11,.2) 80%), url('${artImage(a)}')">
      <span class="eyebrow">Fight training</span><h2 tabindex="-1">${esc(a.name)}</h2>
    </div>
    <p>${esc(a.about)}</p>
    <div class="card feature"><span class="eyebrow">Your training week</span><p class="small">${esc(a.week)}</p></div>
    <h3 class="feed-heading">Sessions</h3>
    ${list.map(sessionCard).join('')}
    ${fbtn(`${esc(a.name)} drills`, 'drills', a.id, 'full')}
    ${fbtn('All disciplines', 'page', 'fight', 'full')}`;
}

function sessionMarkup(s) {
  const unlocked = sessionUnlocked(s);
  const warm = FightData.warmups[s.warmup].reduce((t, [, x]) => t + x, 0);
  const cool = FightData.cooldowns[s.cooldown].reduce((t, [, x]) => t + x, 0);
  return title(`${artById(s.art).name} · ${s.level}`, esc(s.name))
    + `<p>${esc(s.about)}</p>
    <div class="session-breakdown"><span><b>${minutesOf(warm)} min</b>Warm-up</span><span><b>${s.plan.length} × ${mmss(s.work)}</b>Rounds</span><span><b>${minutesOf(cool)} min</b>Cool-down</span></div>
    <p class="small">${mmss(s.rest)} rest between rounds · ${minutesOf(FightData.sessionSeconds(s))} minutes in total · ${esc(s.eq)}</p>
    <h3>Round by round</h3>
    <ol class="fight-rounds">${s.plan.map(([id, focus]) => `<li><strong>${esc(drillInfo(id).name)}</strong><span class="small">${esc(focus)}</span>${fbtn('How to', 'drill', id, 'fight-howto')}</li>`).join('')}</ol>
    ${s.finisher ? `<div class="card"><h3>Finisher</h3><p class="small">${s.finisher.filter(([id]) => id !== 'rest').map(([id, sec]) => `${esc(drillInfo(id).name)} ${sec}s`).join(' · ')}</p></div>` : ''}
    ${timerOptions()}
    ${unlocked ? fbtn('Start session', 'start', s.id, 'primary full') : fbtn('Unlock with Premium', 'locked', s.id, 'primary full')}
    ${fbtn(`Back to ${artById(s.art).name}`, 'art', s.art, 'full')}`;
}

function timerOptions() {
  return `<div class="fight-options">
    <label class="check"><input type="checkbox" data-fight-pref="sound" ${fight.sound ? 'checked' : ''}> Bell and warning sounds</label>
    <label class="check"><input type="checkbox" data-fight-pref="voice" ${fight.voice ? 'checked' : ''}> Spoken round callouts</label>
  </div>`;
}

function programmeMarkup(p) {
  const week = Math.min(fight.week, p.weeks);
  const days = p.build(week);
  const unlocked = weekUnlocked(p, week);
  return title(`Programme · ${p.weeks} weeks`, esc(p.name))
    + `<p>${esc(p.about)}</p>
    <details><summary>How it works</summary><p>${esc(p.how)}</p></details>
    <div class="chips fight-weeks">${Array.from({ length: p.weeks }, (_, i) => `<button data-fight="week" data-id="${i + 1}" aria-pressed="${week === i + 1}">Week ${i + 1}</button>`).join('')}</div>
    ${days.map((d, i) => {
      const secs = d.phases.reduce((t, x) => t + x.seconds, 0);
      return `<article class="fight-session-card">
        <div class="row"><span class="eyebrow">${esc(d.day)} · ${minutesOf(secs)} min</span>${lockBadge(p.freeWeeks.includes(week))}</div>
        <h3>${esc(d.name)}</h3>
        <p class="small">${esc(d.focus)}</p>
        ${unlocked ? fbtn('Start', 'start-day', i, 'primary full') : fbtn('Unlock with Premium', 'locked-programme', p.id, 'full')}
      </article>`;
    }).join('')}
    ${timerOptions()}
    <p class="draft-note">${p.id === 'splits' ? 'Stretch to strong but comfortable tension, never sharp pain. Progress is gradual: weeks to months.' : 'Run on safe routes, carry water and adjust the effort to how you feel on the day.'}</p>
    ${fbtn('All fight training', 'page', 'fight', 'full')}`;
}

function drillsMarkup() {
  const filter = fight.artFilter;
  const entries = Object.entries(FightData.drills).filter(([, d]) => filter === 'all' || d.arts.includes(filter) || d.arts.includes('all'));
  const types = [...new Set(entries.map(([, d]) => d.t))];
  return title('Drill library', 'Every technique,<br>step by step.')
    + `<div class="chips">${[['all', 'All'], ...FightData.arts.map(a => [a.id, a.name])].map(([id, name]) => `<button data-fight="filter" data-id="${id}" aria-pressed="${filter === id}">${esc(name)}</button>`).join('')}</div>`
    + types.map(t => `<h3 class="feed-heading">${esc(t)}</h3>${entries.filter(([, d]) => d.t === t).map(([id, d]) => `
      <button class="fight-drill-row" data-fight="drill" data-id="${id}"><strong>${esc(d.n)}</strong><span class="small">${esc(d.lv)} · ${esc(d.eq)}</span></button>`).join('')}`).join('')
    + fbtn('Back', 'page', fight.art ? 'fight-art' : 'fight', 'full');
}

function drillPage(id) {
  const d = drillInfo(id);
  return title(d.type || 'Technique', esc(d.name))
    + `<div class="chips">${[d.level, d.eq].filter(Boolean).map(x => `<span class="badge">${esc(x)}</span>`).join('')}</div>`
    + drillMarkup(id)
    + fbtn('Back', 'back', '', 'full');
}

function runMarkup() {
  const run = fight.run;
  return `<div class="eyebrow">${esc(run.title)}</div>
    <div class="fight-runner">
      <div id="fight-phase" class="fight-phase"></div>
      <div id="fight-clock" class="fight-clock" role="timer" aria-live="off">0:00</div>
      <div class="fight-bar"><span id="fight-bar"></span></div>
      <p class="small"><span id="fight-next"></span> · <span id="fight-left"></span></p>
    </div>
    <div class="fight-controls">
      ${fbtn(run.running ? 'Pause' : 'Resume', 'pause', '', 'primary')}
      ${fbtn('Skip', 'skip', '', '')}
    </div>
    <div id="fight-how"></div>
    ${fbtn('End session', 'end', '', 'full')}
    <p class="small">Keep this screen open: the timer keeps the screen awake where your phone allows it.</p>`;
}

function doneMarkup() {
  const d = fight.done;
  return title(d.completed ? 'Session complete' : 'Session ended', d.completed ? 'Great work.' : 'Every round counts.')
    + `<div class="card feature"><div class="metric">${d.minutes}<span class="small"> min</span></div><strong>${esc(d.title)}</strong>${d.rounds ? `<p class="small">${d.rounds} rounds</p>` : ''}</div>
    <p>Add it to your training journal to keep yourself accountable and track your progress.</p>
    ${fbtn('Save to my journal', 'journal', '', 'primary full')}
    ${fbtn('Back to fight training', 'page', 'fight', 'full')}`;
}

/* ---- Screen wiring ---- */
const beforeFight = render;
render = function () {
  beforeFight();
  const page = state.page;
  if (page.startsWith('fight')) document.querySelector('#nav [data-go="fight"]')?.setAttribute('aria-current', 'page');
  let html = '';
  if (page === 'fight') html = hubMarkup();
  if (page === 'fight-art' && fight.art) html = artMarkup(artById(fight.art));
  if (page === 'fight-session' && fight.session) html = sessionMarkup(sessionById(fight.session));
  if (page === 'fight-programme' && fight.programme) html = programmeMarkup(programmeById(fight.programme));
  if (page === 'fight-drills') html = drillsMarkup();
  if (page === 'fight-drill' && fight.drill) html = drillPage(fight.drill);
  if (page === 'fight-run') html = fight.run ? runMarkup() : hubMarkup();
  if (page === 'fight-done' && fight.done) html = doneMarkup();
  if (html) screen.innerHTML = html;
  if (page === 'fight-run' && fight.run) {
    fight.run.lastIndex = -1;
    paintRun();
  }
  // Today: a way into fight training
  if (page === 'today' && state.mode !== 'fan' && !screen.querySelector('.fight-today')) {
    screen.insertAdjacentHTML('beforeend', `<div class="card fight-today"><span class="eyebrow">Fight training</span><h3>Boxing, Muay Thai, MMA and more</h3><p class="small">Round-based sessions with a bell timer, a splits programme and fighter roadwork.</p>${fbtn('Choose a discipline', 'page', 'fight', 'primary full')}</div>`);
  }
};

document.addEventListener('change', e => {
  const pref = e.target.dataset?.fightPref;
  if (pref) { fight[pref] = e.target.checked; saveFightPrefs(); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-fight]');
  if (!b) return;
  const a = b.dataset.fight, id = b.dataset.id;
  if (a === 'page') return go(id);
  if (a === 'art') { fight.art = id; return go('fight-art'); }
  if (a === 'session') { fight.session = id; return go('fight-session'); }
  if (a === 'programme') { fight.programme = id; fight.week = 1; return go('fight-programme'); }
  if (a === 'week') { fight.week = Number(id); return render(); }
  if (a === 'drills') { fight.artFilter = id || 'all'; fight.back = state.page; return go('fight-drills'); }
  if (a === 'filter') { fight.artFilter = id; return render(); }
  if (a === 'drill') { fight.drill = id; fight.back = state.page; return go('fight-drill'); }
  if (a === 'back') return go(fight.back || 'fight');
  if (a === 'locked') return lockTo('This session is part of Fight Hub Premium.');
  if (a === 'locked-programme') return lockTo('The full programme is part of Fight Hub Premium.');
  if (a === 'start') {
    const s = sessionById(id);
    if (!sessionUnlocked(s)) return lockTo('This session is part of Fight Hub Premium.');
    return startRun(s.name, FightData.buildSession(s), { kind: 'session', id: s.id, art: s.art, name: s.name });
  }
  if (a === 'start-day') {
    const p = programmeById(fight.programme), day = p.build(fight.week)[Number(id)];
    if (!weekUnlocked(p, fight.week)) return lockTo('The full programme is part of Fight Hub Premium.');
    return startRun(`${p.name} · week ${fight.week} · ${day.name}`, day.phases, { kind: 'programme', id: p.id, week: fight.week, name: `${p.name}: ${day.name}` });
  }
  if (a === 'pause' && fight.run) {
    const run = fight.run;
    if (run.running) { run.elapsed = fElapsed(); run.running = false; keepAwake(false); window.speechSynthesis?.cancel(); }
    else { run.started = performance.now(); run.running = true; keepAwake(true); }
    b.textContent = run.running ? 'Pause' : 'Resume';
    return;
  }
  if (a === 'skip' && fight.run) {
    const run = fight.run, p = IntervalModel.position(run.phases, fElapsed());
    if (p.finished) return;
    run.elapsed = run.phases.slice(0, p.index + 1).reduce((t, x) => t + x.seconds, 0) + 0.01;
    run.started = performance.now();
    return paintRun();
  }
  if (a === 'end' && fight.run) return finishRun(false);
  if (a === 'journal' && fight.done) {
    const d = fight.done;
    const type = d.id === 'roadwork' || d.id === 'run-walk' ? 'Run / roadwork' : d.id === 'splits' ? 'Flexibility' : 'Solo training';
    return openJournalEntry({ type, art: d.art || '', minutes: d.minutes, rounds: d.kind === 'session' ? d.rounds : '', did: d.name, source: 'app' });
  }
});
