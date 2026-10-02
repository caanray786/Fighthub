/* Training reminders: phone notifications on the member's chosen days and time.
   - Turned on from Today (one tap) or the account page, where days and time
     can be changed. The website sends them (/api/reminders-run, hourly).
   - The app also tells the website this week's progress, so a reminder can
     say "2 of 3 this week" instead of a general nudge.
   - iPhone: notifications need Fight Hub added to the home screen (iOS 16.4+). */

const reminders = { busy: false, message: '', flash: '' };
const REMINDER_DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];
const REMINDER_HOURS = [6, 7, 8, 9, 12, 13, 17, 18, 19, 20, 21];
const reminderClock = h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const onIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installedApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const reminderSettings = () => window.Clerk?.user?.publicMetadata?.reminders || null;

// Default days: the member's weekly routine if they have one, otherwise Mon, Wed, Fri
function defaultReminderDays() {
  const days = typeof routine !== 'undefined' && routine.plan?.days;
  return Array.isArray(days) && days.length ? [...days] : [1, 3, 5];
}

function vapidKeyBytes() {
  const raw = atob(window.FIGHTHUB_CONFIG.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function pushSubscription(create) {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes() });
}

async function saveReminders(body) {
  const r = await billingCall('/api/reminders', { ...body, lang: i18n.lang }); // reminders are written in the app's language
  await window.Clerk?.user?.reload();
  return r;
}

async function turnOnReminders(days, hour) {
  if (!pushSupported()) throw new Error('This browser can’t show notifications.');
  if (onIphone() && !installedApp()) throw new Error('On iPhone, add Fight Hub to your home screen first, then open it from there to turn on reminders.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for fighthub.world in your phone’s settings, then try again.');
  const sub = await pushSubscription(true);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const r = await saveReminders({ on: true, days, hour, tz, subscription: sub.toJSON(), test: true, progress: weekProgress() });
  return r.test === 'sent' ? 'Reminders are on. You should see a test notification now.' : 'Reminders are on.';
}

async function turnOffReminders() {
  const sub = pushSupported() ? await pushSubscription(false).catch(() => null) : null;
  await saveReminders({ on: false, ...(sub ? { unsubscribe: sub.endpoint } : {}) });
  await sub?.unsubscribe().catch(() => {});
  return 'Reminders are off.';
}

/* ---- This week's progress, for smarter reminders ---- */
function weekProgress() {
  const days = trainingDays(), week = weekDays(0);
  return { weekStart: week[0], done: week.filter(d => days.has(d)).length, goal: retention.goal };
}

let progressTimer = null;
function syncReminderProgress() {
  if (!reminderSettings()?.on || !signedIn()) return;
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    const p = weekProgress(), key = `${p.weekStart}|${p.done}|${p.goal}`;
    let last = '';
    try { last = localStorage.getItem('fight-hub-reminder-progress') || ''; } catch { /* private mode */ }
    if (key === last) return;
    billingCall('/api/reminders', { progress: p, lang: i18n.lang })
      .then(() => { try { localStorage.setItem('fight-hub-reminder-progress', key); } catch { /* ignore */ } })
      .catch(() => { /* next save tries again */ });
  }, 3000);
}

const beforeReminderSave = saveJournal;
saveJournal = function (opts) {
  const result = beforeReminderSave(opts);
  syncReminderProgress();
  return result;
};

/* ---- Screens ---- */
function reminderCardMarkup() {
  const s = reminderSettings();
  const on = !!s?.on;
  const days = on ? s.days : defaultReminderDays();
  const hour = on ? s.hour : 18;
  const note = reminders.message ? `<p class="status" role="status">${esc(reminders.message)}</p>` : '';
  if (!pushSupported()) {
    return `<div class="card reminder-card" id="reminder-card"><h3>Training reminders</h3><p class="small">Notifications aren’t available here. ${onIphone() ? 'On iPhone, add Fight Hub to your home screen (iOS 16.4 or later) and open it from there.' : 'If this is a private or incognito window, open Fight Hub in a normal window or from your home screen. Otherwise, try Chrome, Edge, Firefox or Safari.'}</p></div>`;
  }
  return `<div class="card reminder-card" id="reminder-card"><h3>Training reminders</h3>
    <p class="small">${on ? `On: ${esc(days.map(d => REMINDER_DAYS.find(x => x[1] === d)[0]).join(', '))} at ${reminderClock(hour)}.` : 'A nudge on your training days, so you never miss a session.'}</p>
    ${note}
    <div class="reminder-days" role="group" aria-label="Reminder days">${REMINDER_DAYS.map(([name, d]) => `<button type="button" class="day-chip" data-reminder-day="${d}" aria-pressed="${days.includes(d)}">${name}</button>`).join('')}</div>
    <label class="field">Time<select id="reminder-hour">${REMINDER_HOURS.map(h => `<option value="${h}" ${h === hour ? 'selected' : ''}>${reminderClock(h)}</option>`).join('')}</select></label>
    ${on
      ? `<button class="full" data-reminder="save" ${reminders.busy ? 'disabled' : ''}>Save days and time</button><button class="full" data-reminder="off" ${reminders.busy ? 'disabled' : ''}>Turn reminders off</button>`
      : `<button class="primary full" data-reminder="on" ${reminders.busy ? 'disabled' : ''}>${icon('clock')} Turn on reminders</button>`}
    ${onIphone() && !installedApp() ? '<p class="small">On iPhone, reminders work once Fight Hub is on your home screen.</p>' : ''}
  </div>`;
}

const chosenReminderDays = () => [...document.querySelectorAll('[data-reminder-day][aria-pressed="true"]')].map(b => Number(b.dataset.reminderDay));
const chosenReminderHour = () => Number(document.getElementById('reminder-hour')?.value || 18);

const beforeReminders = render;
render = function () {
  beforeReminders();
  if (state.page === 'account' && signedIn() && !needsSignIn()) {
    const pictures = [...screen.querySelectorAll('.card h3')].find(h => h.textContent === 'Exercise pictures')?.closest('.card');
    pictures?.insertAdjacentHTML('beforebegin', reminderCardMarkup());
  }
  // Today: one tap to turn reminders on (until they are on, or the card is dismissed)
  let dismissed = false;
  try { dismissed = localStorage.getItem('fight-hub-reminder-prompt') === 'no'; } catch { /* ignore */ }
  if (state.page === 'today' && state.mode !== 'fan' && signedIn() && !reminderSettings()?.on && !dismissed && pushSupported() && !screen.querySelector('.reminder-today')) {
    screen.querySelector('.week-card')?.insertAdjacentHTML('beforebegin', `<div class="card reminder-today"><span class="eyebrow">Stay on track</span><h3>Never miss a training day</h3>
      <p class="small">${onIphone() && !installedApp() ? 'Add Fight Hub to your home screen, then turn on a reminder for your training days.' : 'Get a reminder on your training days. Change the days and time any time in your account.'}</p>
      <div class="row-buttons"><button class="primary" data-reminder="quick" ${reminders.busy ? 'disabled' : ''}>${icon('clock')} Remind me</button><button data-reminder="dismiss">Not now</button></div>
      ${reminders.message && state.page === 'today' ? `<p class="status" role="status">${esc(reminders.message)}</p>` : ''}</div>`);
  }
  // One-off confirmation after turning reminders on from Today
  if (state.page === 'today' && reminders.flash && !screen.querySelector('.reminder-today')) {
    screen.querySelector('.week-card')?.insertAdjacentHTML('beforebegin', `<div class="card reminder-today"><span class="eyebrow">Reminders</span><p class="small">${esc(reminders.flash)}</p></div>`);
    reminders.flash = '';
  }
  // Always findable: a reminders link at the foot of the week card on Today
  const week = state.page === 'today' && screen.querySelector('.week-card');
  if (week && signedIn() && !week.querySelector('.week-reminder')) {
    const s = reminderSettings();
    const label = s?.on ? `Reminders: ${s.days.map(d => REMINDER_DAYS.find(x => x[1] === d)[0]).join(', ')} at ${reminderClock(s.hour)}` : 'Set training reminders';
    week.insertAdjacentHTML('beforeend', `<button class="link-button week-reminder" data-reminder="open">${icon('clock')} ${esc(label)}</button>`);
  }
  if (state.page === 'today') syncReminderProgress();
};

document.addEventListener('click', async e => {
  const chip = e.target.closest('[data-reminder-day]');
  if (chip) { chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
  const b = e.target.closest('[data-reminder]');
  if (!b) return;
  const a = b.dataset.reminder;
  if (a === 'open') {
    go('account');
    setTimeout(() => document.getElementById('reminder-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    return;
  }
  if (a === 'dismiss') { try { localStorage.setItem('fight-hub-reminder-prompt', 'no'); } catch { /* ignore */ } return render(); }
  const days = a === 'quick' ? defaultReminderDays() : chosenReminderDays();
  const hour = a === 'quick' ? 18 : chosenReminderHour();
  if ((a === 'on' || a === 'save') && !days.length) { reminders.message = 'Choose at least one day.'; return render(); }
  reminders.busy = true;
  reminders.message = '';
  render();
  try {
    if (a === 'on' || a === 'quick') reminders.message = await turnOnReminders(days, hour);
    if (a === 'save') { await saveReminders({ days, hour, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); reminders.message = 'Saved.'; }
    if (a === 'off') reminders.message = await turnOffReminders();
    if (a === 'quick') { reminders.flash = reminders.message + ' Change the days or time in your account.'; reminders.message = ''; }
  } catch (err) {
    reminders.message = err.message || 'Reminders could not be changed. Please try again.';
  }
  reminders.busy = false;
  render();
});
