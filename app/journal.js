/* Training journal: log any session (gym, class, pads, sparring, runs...),
   with effort, energy and notes, plus weekly totals, a streak and an
   8-week chart. Stored on this device until accounts sync it. */

const journalKey = 'fight-hub-journal-v1';
const JOURNAL_TYPES = ['Solo training', 'Gym session', 'Class', 'Pads / bag', 'Sparring', 'Run / roadwork', 'Strength', 'Flexibility', 'Rest / recovery', 'Other'];
const ENERGY = ['', 'Drained', 'Low', 'OK', 'Good', 'Great'];
const RPE = ['', 'Very easy', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Maximal'];
// tombstones: ids deleted on this device, still to be removed from the member's account
const journal = { entries: [], tombstones: [], editing: null, message: '' };

try {
  const saved = JSON.parse(localStorage.getItem(journalKey) || 'null');
  if (saved?.version === 1 && Array.isArray(saved.entries)) {
    journal.entries = saved.entries;
    journal.tombstones = Array.isArray(saved.tombstones) ? saved.tombstones : [];
  }
} catch { journal.message = 'Your journal could not be loaded on this device.'; }

function saveJournal({ skipSync = false } = {}) {
  try { localStorage.setItem(journalKey, JSON.stringify({ version: 1, entries: journal.entries, tombstones: journal.tombstones })); }
  catch { journal.message = 'Changes could not be saved on this device.'; }
  if (!skipSync) window.syncJournal?.();
}

const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayFrom = s => new Date(s + 'T12:00:00');
function weekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return isoDay(d);
}

function journalStats() {
  const today = new Date(), thisWeek = weekStart(today);
  const inWeek = journal.entries.filter(e => e.type !== 'Rest / recovery' && weekStart(dayFrom(e.date)) === thisWeek);
  // Streak: consecutive days with an entry, ending today or yesterday
  const days = new Set(journal.entries.map(e => e.date));
  let streak = 0;
  const d = new Date(today);
  if (!days.has(isoDay(d))) d.setDate(d.getDate() - 1);
  while (days.has(isoDay(d))) { streak++; d.setDate(d.getDate() - 1); }
  // Minutes per week for the last 8 weeks
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const w = new Date(today); w.setDate(w.getDate() - i * 7);
    const key = weekStart(w);
    weeks.push({ key, minutes: journal.entries.filter(e => weekStart(dayFrom(e.date)) === key).reduce((t, e) => t + (Number(e.minutes) || 0), 0) });
  }
  return { sessions: inWeek.length, minutes: inWeek.reduce((t, e) => t + (Number(e.minutes) || 0), 0), streak, weeks };
}

function openJournalEntry(prefill = {}) {
  journal.editing = { id: '', date: isoDay(new Date()), type: 'Gym session', art: '', minutes: '', rounds: '', rpe: 6, energy: 3, did: '', notes: '', ...prefill };
  go('journal-entry');
}

function journalMarkup() {
  const s = journalStats();
  const max = Math.max(60, ...s.weeks.map(w => w.minutes));
  const sorted = [...journal.entries].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  return title('Training journal', 'Every session<br>counts.')
    + (journal.message ? `<p class="status" role="status">${esc(journal.message)}</p>` : '')
    + `<div class="journal-stats">
        <div><b>${s.sessions}</b><span>sessions this week</span></div>
        <div><b>${s.minutes}</b><span>minutes this week</span></div>
        <div><b>${s.streak}</b><span>day streak</span></div>
      </div>
      <div class="journal-chart" aria-label="Minutes trained per week, last 8 weeks">
        ${s.weeks.map((w, i) => `<div class="journal-bar"><span style="height:${Math.round((w.minutes / max) * 100)}%"></span><small>${i === 7 ? 'This' : dayFrom(w.key).getDate()}</small></div>`).join('')}
      </div>
      <button class="primary full" data-journal="new">${icon('plus')} Log a session</button>
      ${sorted.length ? sorted.map(e => `
        <button class="journal-entry" data-journal="edit" data-id="${esc(e.id)}">
          <span class="eyebrow">${esc(dayFrom(e.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(e.type)}${e.art ? ' · ' + esc((FightData.arts.find(a => a.id === e.art) || {}).name || e.art) : ''}</span>
          <strong>${esc(e.did || e.type)}</strong>
          <span class="small">${[e.minutes && `${e.minutes} min`, e.rounds && `${e.rounds} rounds`, e.rpe && `Effort ${e.rpe}/10`, e.energy && `Energy: ${ENERGY[e.energy]}`].filter(Boolean).join(' · ')}</span>
          ${e.notes ? `<span class="journal-note">${esc(e.notes)}</span>` : ''}
        </button>`).join('') : `<div class="card"><h3>Your first entry</h3><p class="small">Log every session: at the gym, in class, on the pads, sparring or out running. Note what you worked on and what to fix next time. It is the best way to stay accountable and see your progress.</p></div>`}
      ${training.history.length ? `<button class="full" data-go="progress">App session history (${training.history.length})</button>` : ''}
      ${typeof signedIn === 'function' && signedIn()
        ? `<p class="small">Saved to your account${account.sync.error ? `: ${esc(account.sync.error)}` : ''}.</p>`
        : `<p class="small">Saved on this phone. <button class="link-button" data-go="account">Sign in</button> to keep it safe on every phone.</p>`}`;
}

function entryMarkup() {
  const e = journal.editing;
  const opts = (values, selected) => values.map(([v, label]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');
  return title(e.id ? 'Edit entry' : 'New entry', 'Log your<br>session.')
    + `<form id="journal-form" class="journal-form">
      <label class="field">Date<input type="date" name="date" value="${esc(e.date)}" max="${isoDay(new Date())}" required></label>
      <label class="field">What kind of session?<select name="type">${opts(JOURNAL_TYPES.map(t => [t, t]), e.type)}</select></label>
      <label class="field">Discipline (optional)<select name="art">${opts([['', 'None / general fitness'], ...FightData.arts.map(a => [a.id, a.name])], e.art)}</select></label>
      <div class="filter-grid">
        <label class="field">Minutes<input type="number" name="minutes" min="0" max="600" inputmode="numeric" value="${esc(e.minutes)}"></label>
        <label class="field">Rounds (optional)<input type="number" name="rounds" min="0" max="100" inputmode="numeric" value="${esc(e.rounds)}"></label>
      </div>
      <label class="field">How hard was it? <output id="rpe-label">${e.rpe}/10 · ${RPE[e.rpe]}</output><input type="range" name="rpe" min="1" max="10" value="${esc(e.rpe)}"></label>
      <label class="field">Energy<select name="energy">${opts(ENERGY.slice(1).map((l, i) => [i + 1, l]), e.energy)}</select></label>
      <label class="field">What did you work on?<textarea name="did" rows="3" maxlength="600" placeholder="e.g. Pads with coach: 5 rounds of jab-cross-kick. Sparring 3 x 3 minutes.">${esc(e.did)}</textarea></label>
      <label class="field">Notes for next time<textarea name="notes" rows="3" maxlength="600" placeholder="What went well? What will you work on next time?">${esc(e.notes)}</textarea></label>
      <button type="submit" class="primary full">${e.id ? 'Save changes' : 'Save entry'}</button>
    </form>
    ${e.id ? `<button class="full" data-journal="delete" data-id="${esc(e.id)}">Delete this entry</button>` : ''}
    <button class="full" data-journal="cancel">Cancel</button>
    <p class="small">Avoid recording medical details. If something hurts, speak to a qualified professional.</p>`;
}

const beforeJournal = render;
render = function () {
  beforeJournal();
  if (state.page === 'journal') screen.innerHTML = journalMarkup();
  if (state.page === 'journal-entry') screen.innerHTML = journal.editing ? entryMarkup() : journalMarkup();
  if (state.page.startsWith('journal')) document.querySelector('#nav [data-go="journal"]')?.setAttribute('aria-current', 'page');
};

document.addEventListener('input', e => {
  if (e.target.name === 'rpe' && e.target.closest('#journal-form')) {
    document.getElementById('rpe-label').textContent = `${e.target.value}/10 · ${RPE[e.target.value]}`;
  }
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'journal-form') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const entry = {
    ...journal.editing,
    date: f.get('date') || isoDay(new Date()),
    type: f.get('type'),
    art: f.get('art'),
    minutes: f.get('minutes') ? Number(f.get('minutes')) : '',
    rounds: f.get('rounds') ? Number(f.get('rounds')) : '',
    rpe: Number(f.get('rpe')),
    energy: Number(f.get('energy')),
    did: String(f.get('did') || '').trim(),
    notes: String(f.get('notes') || '').trim()
  };
  entry.updated = Date.now(); // newest change wins when syncing between phones
  if (!entry.id) { entry.id = Date.now() + '-' + Math.random().toString(36).slice(2, 7); entry.created = Date.now(); journal.entries.push(entry); }
  else journal.entries = journal.entries.map(x => x.id === entry.id ? entry : x);
  journal.editing = null;
  journal.message = '';
  saveJournal();
  go('journal');
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-journal]');
  if (!b) return;
  const a = b.dataset.journal, id = b.dataset.id;
  if (a === 'new') return openJournalEntry();
  if (a === 'edit') { journal.editing = { ...journal.entries.find(x => x.id === id) }; return go('journal-entry'); }
  if (a === 'cancel') { journal.editing = null; return go('journal'); }
  if (a === 'delete') {
    if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = 'Tap again to delete'; return; }
    journal.entries = journal.entries.filter(x => x.id !== id);
    journal.tombstones = [...new Set([...journal.tombstones, id])];
    journal.editing = null;
    saveJournal();
    return go('journal');
  }
});
