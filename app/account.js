/* Member accounts: sign-in with Clerk (Apple, Google, or email and password),
   the member profile (used by the voice coach: name, gender, coach voice,
   discipline, goal, level) and keeping the training journal safe in the
   member's account.

   The app opens on the sign-in page. Members who have signed in on this
   phone before can still open it with no signal (at the gym); everything
   they do offline syncs when they are back online. */

const account = { status: 'idle', profile: null, profileLoaded: false, editing: false, message: '', sync: { last: null, error: '', busy: false }, mounted: null };

const GOALS = ['Get fitter', 'Build strength and muscle', 'Improve conditioning', 'Prepare to compete', 'Learn self-defence', 'Flexibility and kicks'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const memberKey = 'fight-hub-member-v1';
const ageKey = 'fight-hub-age-ok';

const clerk = () => window.Clerk;
// Where Clerk returns members after Google/Apple sign-in, sign-up and sign-out: this app
const appUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
const signedIn = () => !!(clerk() && clerk().isSignedIn && clerk().user);

const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const store = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage unavailable */ } };

// Signed in on this phone before? Then the app opens even without a connection.
const rememberedMember = () => !!stored(memberKey);

function needsSignIn() {
  if (signedIn() || account.status === 'off') return false;
  if (account.status === 'ready') return true;          // Clerk has answered: not signed in
  return !rememberedMember();                           // still loading, or offline
}

/* ---- Loading Clerk (the app itself never waits for it) ---- */
function clerkFrontendApi(key) {
  try { return atob(key.split('_')[2]).replace(/\$$/, ''); } catch { return ''; }
}

function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load sign-in'));
    document.head.appendChild(s);
  });
}

async function startAccounts() {
  const key = window.FIGHTHUB_CONFIG?.clerkPublishableKey;
  const fapi = key && clerkFrontendApi(key);
  if (!fapi) { account.status = 'off'; return render(); }
  if (!navigator.onLine) { account.status = 'offline'; return render(); }
  account.status = 'loading';
  try {
    if (!clerk()) {
      await loadScript(`https://${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(`https://${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': key });
    }
    await clerk().load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      // Sign-in and sign-up both happen inside the app (not on Clerk's own pages)
      signInUrl: appUrl(),
      signUpUrl: appUrl(),
      signInForceRedirectUrl: appUrl(),
      signUpForceRedirectUrl: appUrl(),
      signInFallbackRedirectUrl: appUrl(),
      signUpFallbackRedirectUrl: appUrl(),
      afterSignOutUrl: appUrl(),
      appearance: {
        variables: {
          colorPrimary: '#c52a3b',
          colorPrimaryForeground: '#ffffff',
          colorBackground: '#1c1c24',
          colorForeground: '#f5f5f7',
          colorMutedForeground: '#b8b8c4',
          colorInput: '#26262f',
          colorInputForeground: '#f5f5f7',
          colorBorder: '#ffffff',   // Clerk softens this itself; a light base keeps outlines visible on dark
          colorNeutral: '#ffffff',
          colorShadow: '#000000',
          borderRadius: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
      }
    });
    account.status = 'ready';
    let lastUser = clerk().user?.id || null;
    clerk().addListener(({ user }) => {
      const id = user?.id || null;
      if (id === lastUser) return;
      lastUser = id;
      onAccountChange();
    });
    onAccountChange();
  } catch {
    account.status = 'error';
    render();
  }
}

async function onAccountChange() {
  account.profile = null;
  account.profileLoaded = false;
  account.editing = false;
  paintAccountButton();
  if (!signedIn()) {
    store(memberKey, null);
    return go('welcome');
  }
  store(memberKey, clerk().user.id);
  state.onboarded = true;
  saveApp();
  await loadProfile();
  syncJournal();
  if (!account.profile && account.profileLoaded && !account.message) {
    // New member: the profile comes first, so the coach knows who they are
    account.editing = true;
    return go('account');
  }
  if (state.page === 'welcome') return go('today');
  render();
}

// 401/403 means the database does not yet accept this sign-in (setup step), not a connection problem
const accountError = (err, what) => [401, 403].includes(err?.status)
  ? `${what} Your sign-in is not connected to the Fight Hub database yet.`
  : `${what} Check your connection and try again.`;

/* ---- Database (Supabase, locked to the member by the Clerk token) ---- */
async function memberApi(path, { method = 'GET', body, prefer } = {}) {
  const cfg = window.FIGHTHUB_CONFIG;
  const token = await clerk().session?.getToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) { const err = new Error(`Account service ${res.status}`); err.status = res.status; throw err; }
  return res.status === 204 || method !== 'GET' ? null : res.json();
}

async function loadProfile() {
  try {
    const rows = await memberApi('member_profiles?select=*');
    account.profile = rows[0] || null;
    account.message = '';
  } catch (err) {
    account.message = accountError(err, 'Your profile could not be loaded.');
  }
  account.profileLoaded = true;
}

async function saveProfile(p) {
  await memberApi('member_profiles?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: [{ user_id: clerk().user.id, ...p }]
  });
  account.profile = { ...(account.profile || {}), user_id: clerk().user.id, ...p };
}

/* ---- Journal sync: merge by entry, newest change wins, deletions travel ---- */
async function syncJournal() {
  if (!signedIn() || account.sync.busy) return;
  account.sync.busy = true;
  try {
    const remote = await memberApi('journal_entries?select=id,doc,deleted');
    const local = new Map(journal.entries.map(e => [e.id, e]));
    const tomb = new Set(journal.tombstones || []);
    for (const r of remote) {
      if (r.deleted) { local.delete(r.id); tomb.delete(r.id); continue; }
      if (tomb.has(r.id)) continue;
      const mine = local.get(r.id);
      if (!mine || (r.doc.updated || 0) > (mine.updated || 0)) local.set(r.id, r.doc);
    }
    const remoteById = new Map(remote.map(r => [r.id, r]));
    const push = [];
    for (const e of local.values()) {
      const r = remoteById.get(e.id);
      if (!r || (!r.deleted && (e.updated || 0) > (r.doc.updated || 0))) push.push({ user_id: clerk().user.id, id: e.id, doc: e, deleted: false });
    }
    for (const id of tomb) push.push({ user_id: clerk().user.id, id, doc: {}, deleted: true });
    if (push.length) {
      await memberApi('journal_entries?on_conflict=user_id,id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: push });
    }
    journal.entries = [...local.values()];
    journal.tombstones = [];
    saveJournal({ skipSync: true });
    account.sync = { last: new Date(), error: '', busy: false };
  } catch {
    account.sync = { ...account.sync, error: 'Journal will sync when you are back online.', busy: false };
  }
  if (['journal', 'account'].includes(state.page)) render();
}
window.syncJournal = syncJournal;

async function deleteAccount() {
  // Member data first (while the sign-in is still valid), then the sign-in itself
  await memberApi('journal_entries?user_id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await memberApi('member_profiles?user_id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await clerk().user.delete();
  journal.entries = [];
  journal.tombstones = [];
  saveJournal({ skipSync: true });
  account.profile = null;
}

/* ---- Screens ---- */
function paintAccountButton() {
  const b = document.getElementById('account-button');
  if (!b) return;
  const u = signedIn() ? clerk().user : null;
  b.innerHTML = u?.imageUrl && u.hasImage ? `<img src="${esc(u.imageUrl)}" alt="">` : icon('user');
  b.setAttribute('aria-label', u ? 'Your account' : 'Sign in');
}

// The opening screen: who Fight Hub is for, then sign in or create an account
function welcomeMarkup() {
  const intro = title('Welcome to Fight Hub', 'Train like a fighter.<br>Follow the fight world.')
    + '<p>Fight training for nine martial arts, weekly routines, 85 illustrated exercises, HIIT, a splits programme and your training journal, with the latest fight news.</p>';
  if (['idle', 'loading'].includes(account.status)) return intro + '<p class="small" role="status">Loading sign-in…</p>';
  if (['offline', 'error'].includes(account.status)) {
    return intro + `<div class="card"><h3>You’re offline</h3><p class="small">Connect to the internet to sign in for the first time. After that, Fight Hub also works without a connection.</p><button class="full" data-account="retry">Try again</button></div>`;
  }
  const ageOk = stored(ageKey) === '1';
  return intro
    + `<label class="check"><input type="checkbox" id="age-ok" ${ageOk ? 'checked' : ''}> I am 18 or over</label>`
    + (ageOk
      ? '<div id="clerk-sign-in" class="clerk-mount"></div>'
      : '<p class="small">Fight Hub is for adults. Confirm you are 18 or over to sign in or create your account.</p>')
    + '<p class="small">Check each exercise is suitable for you before starting, and stop if you feel pain or unwell.</p>';
}

const opt = (values, selected) => values.map(([v, label]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');

function profileForm() {
  const p = account.profile || {};
  const u = clerk().user;
  const gender = p.gender || '';
  return title(p.user_id ? 'Your profile' : 'Welcome to Fight Hub', p.user_id ? 'Edit your<br>profile.' : 'Tell us about<br>you.')
    + `<p class="small">Your coach uses this to tailor training and motivation to you.</p>
    <form id="profile-form" class="journal-form">
      <label class="field">Your name<input type="text" name="display_name" maxlength="60" required value="${esc(p.display_name || u.firstName || '')}"></label>
      <label class="field">Gender<select name="gender" required>${opt([['', 'Choose'], ['male', 'Male'], ['female', 'Female'], ['unspecified', 'Prefer not to say']], gender)}</select></label>
      <label class="field">Coach voice<select name="coach_voice" required>${opt([['', 'Choose'], ['male', 'Male voice'], ['female', 'Female voice']], p.coach_voice || (gender === 'unspecified' ? '' : gender))}</select></label>
      <label class="field">Main discipline<select name="discipline">${opt([['', 'General fitness'], ...FightData.arts.map(a => [a.id, a.name])], p.discipline || '')}</select></label>
      <label class="field">Main goal<select name="goal">${opt(GOALS.map(g => [g, g]), p.goal || GOALS[0])}</select></label>
      <label class="field">Experience<select name="level">${opt(LEVELS.map(l => [l, l]), p.level || 'Beginner')}</select></label>
      <button type="submit" class="primary full">${p.user_id ? 'Save profile' : 'Save and start training'}</button>
    </form>
    ${p.user_id ? '<button class="full" data-account="cancel">Cancel</button>' : ''}`;
}

function accountMarkup() {
  if (!signedIn()) {
    // Offline member who signed in before: training works, the account page waits for a connection
    return title('Your account', 'Back online<br>soon.')
      + '<p>You can keep training: everything you do is saved on this phone and syncs to your account when you are back online.</p><button class="full" data-account="retry">Try again</button>';
  }
  if (account.editing || (account.profileLoaded && !account.profile && !account.message)) return profileForm();
  const u = clerk().user, p = account.profile || {};
  const art = FightData.arts.find(a => a.id === p.discipline);
  return title('Your account', esc(p.display_name || u.firstName || 'Welcome back'))
    + (account.message ? `<p class="status" role="status">${esc(account.message)}</p>` : '')
    + `<div class="card feature">
        <span class="eyebrow">${esc(u.primaryEmailAddress?.emailAddress || '')}</span>
        <h3>${esc(art ? art.name : 'General fitness')} · ${esc(p.level || 'Beginner')}</h3>
        <p class="small">${esc(p.goal || '')}${p.coach_voice ? ` · ${p.coach_voice === 'male' ? 'Male' : 'Female'} coach voice` : ''}</p>
        <button class="full" data-account="edit">Edit profile</button>
      </div>
      <div class="card">
        <h3>Training journal</h3>
        <p class="small">${account.sync.error ? esc(account.sync.error) : account.sync.last ? `Saved to your account · ${account.sync.last.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Saving to your account…'}</p>
        <button class="full" data-account="sync">Sync now</button>
      </div>
      <button class="full" data-account="manage">Sign-in and security</button>
      <button class="full" data-account="signout">Sign out</button>
      <button class="full account-danger" data-account="delete">Delete my account</button>
      <p class="small">Deleting removes your profile, your journal in your account and your sign-in. It cannot be undone.</p>`;
}

function mountSignIn() {
  const el = document.getElementById('clerk-sign-in');
  if (!el || account.status !== 'ready' || !clerk() || signedIn()) return;
  clerk().mountSignIn(el, { forceRedirectUrl: appUrl(), signUpForceRedirectUrl: appUrl(), withSignUp: true });
  account.mounted = el;
}

function unmountSignIn() {
  if (account.mounted) {
    try { clerk().unmountSignIn(account.mounted); } catch { /* already gone */ }
    account.mounted = null;
  }
}

const beforeAccount = render;
render = function () {
  unmountSignIn();
  if (needsSignIn()) state.page = 'welcome';       // nothing opens until the member has signed in
  beforeAccount();
  if (state.page === 'welcome' && needsSignIn()) screen.innerHTML = welcomeMarkup();
  if (state.page === 'account') screen.innerHTML = accountMarkup();
  mountSignIn();
  paintAccountButton();
};

document.addEventListener('submit', async e => {
  if (e.target.id !== 'profile-form') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const p = {
    display_name: String(f.get('display_name') || '').trim().slice(0, 60),
    gender: f.get('gender'),
    coach_voice: f.get('coach_voice'),
    discipline: f.get('discipline') || null,
    goal: f.get('goal'),
    level: f.get('level')
  };
  const isNew = !account.profile?.user_id;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await saveProfile(p);
    account.editing = false;
    account.message = '';
    if (isNew) { state.mode = 'train'; saveApp(); return go('today'); }
    render();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = isNew ? 'Save and start training' : 'Save profile';
    btn.insertAdjacentHTML('afterend', `<p class="status" role="status">${esc(accountError(err, 'Could not save.'))}</p>`);
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'age-ok') { store(ageKey, e.target.checked ? '1' : null); return render(); }
  // Coach voice follows gender unless the member has chosen otherwise
  if (e.target.name !== 'gender' || !e.target.closest('#profile-form')) return;
  const voice = e.target.form.elements.coach_voice;
  if (['male', 'female'].includes(e.target.value) && !voice.dataset.touched) voice.value = e.target.value;
});
document.addEventListener('input', e => { if (e.target.name === 'coach_voice') e.target.dataset.touched = '1'; });

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-account]');
  if (!b) return;
  const a = b.dataset.account;
  if (a === 'retry') { account.status = 'idle'; render(); return startAccounts(); }
  if (a === 'edit') { account.editing = true; return render(); }
  if (a === 'cancel') { account.editing = false; return render(); }
  if (a === 'sync') { b.textContent = 'Syncing…'; return syncJournal(); }
  if (a === 'manage') return clerk().openUserProfile();
  if (a === 'signout') return clerk().signOut(); // the sign-in listener returns to the welcome screen
  if (a === 'delete') {
    if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = 'Tap again to permanently delete'; return; }
    b.disabled = true;
    b.textContent = 'Deleting…';
    try { await deleteAccount(); }
    catch { b.disabled = false; b.textContent = 'Could not delete. Try again.'; }
  }
});

window.addEventListener('online', () => { if (['offline', 'error'].includes(account.status)) startAccounts(); else syncJournal(); });
startAccounts();
