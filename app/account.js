/* Member accounts: sign-in with Clerk, the member profile (used by the voice
   coach: name, gender, coach voice, discipline, goal, level), and keeping the
   training journal safe in the member's account. The app still works fully
   without signing in; everything then stays on the device. */

const account = { status: 'idle', profile: null, profileLoaded: false, editing: false, message: '', sync: { last: null, error: '', busy: false }, mounted: null };

const GOALS = ['Get fitter', 'Build strength and muscle', 'Improve conditioning', 'Prepare to compete', 'Learn self-defence', 'Flexibility and kicks'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const clerk = () => window.Clerk;
const signedIn = () => !!(clerk() && clerk().isSignedIn && clerk().user);

/* ---- Loading Clerk (only when online; the app never waits for it) ---- */
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
  if (!fapi) { account.status = 'off'; return; }
  if (!navigator.onLine) { account.status = 'offline'; return; }
  account.status = 'loading';
  try {
    await loadScript(`https://${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await loadScript(`https://${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': key });
    await clerk().load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      appearance: {
        variables: {
          colorPrimary: '#c52a3b',
          colorPrimaryForeground: '#ffffff',
          colorBackground: '#1c1c24',
          colorForeground: '#f5f5f7',
          colorMutedForeground: '#b8b8c4',
          colorInput: '#26262f',
          colorInputForeground: '#f5f5f7',
          colorBorder: '#3a3a45',
          colorNeutral: '#f5f5f7',
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
    if (state.page === 'account') render();
  }
}

async function onAccountChange() {
  account.profile = null;
  account.profileLoaded = false;
  account.editing = false;
  paintAccountButton();
  if (signedIn()) {
    await loadProfile();
    syncJournal();
    // New members go straight to their profile so the coach knows who they are
    if (!account.profile) { account.editing = true; if (state.page !== 'account') go('account'); }
  }
  if (state.page === 'account') render();
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
      const mine = local.get(r.id);
      if (tomb.has(r.id)) continue;
      if (!mine || (r.doc.updated || 0) > (mine.updated || 0)) local.set(r.id, r.doc);
    }
    const remoteById = new Map(remote.map(r => [r.id, r]));
    const push = [];
    for (const e of local.values()) {
      const r = remoteById.get(e.id);
      if (!r || r.deleted === false && (e.updated || 0) > (r.doc.updated || 0)) push.push({ user_id: clerk().user.id, id: e.id, doc: e, deleted: false });
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
      <button type="submit" class="primary full">Save profile</button>
    </form>
    ${p.user_id ? '<button class="full" data-account="cancel">Cancel</button>' : ''}`;
}

function accountMarkup() {
  if (['idle', 'loading'].includes(account.status)) return title('Your account', 'One moment…') + '<p class="small" role="status">Connecting to sign-in…</p>';
  if (account.status === 'offline' || account.status === 'error') {
    return title('Your account', 'Sign in needs<br>a connection.')
      + '<p>You can keep training: everything you do is saved on this phone. Sign in when you are back online to keep it safe in your account.</p><button class="full" data-account="retry">Try again</button>';
  }
  if (account.status === 'off') return title('Your account', 'Coming soon.') + '<p>Accounts are being set up.</p>';
  if (!signedIn()) {
    return title('Your account', 'Train anywhere.<br>Keep everything.')
      + `<ul class="check-list account-benefits">
          <li>Your journal and history kept safe, on every phone</li>
          <li>Your personal voice coach (coming soon)</li>
          <li>Premium membership (coming soon)</li>
        </ul>
        <div id="clerk-sign-in" class="clerk-mount"></div>
        <p class="small">By continuing you agree to use Fight Hub for your own training. You can delete your account at any time.</p>`;
  }
  if (account.editing || (account.profileLoaded && !account.profile)) return profileForm();
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
  if (!el || !signedInReady()) return;
  const here = location.href.split('#')[0];
  clerk().mountSignIn(el, { fallbackRedirectUrl: here, signUpFallbackRedirectUrl: here, withSignUp: true });
  account.mounted = el;
}
const signedInReady = () => account.status === 'ready' && clerk() && !signedIn();

function unmountSignIn() {
  if (account.mounted) {
    try { clerk().unmountSignIn(account.mounted); } catch { /* already gone */ }
    account.mounted = null;
  }
}

const beforeAccount = render;
render = function () {
  unmountSignIn();
  beforeAccount();
  if (state.page === 'account') {
    screen.innerHTML = accountMarkup();
    mountSignIn();
  }
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
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await saveProfile(p);
    account.editing = false;
    account.message = '';
    render();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Save profile';
    btn.insertAdjacentHTML('afterend', `<p class="status" role="status">${esc(accountError(err, 'Could not save.'))}</p>`);
  }
});

// Coach voice follows gender unless the member has chosen otherwise
document.addEventListener('change', e => {
  if (e.target.name !== 'gender' || !e.target.closest('#profile-form')) return;
  const voice = e.target.form.elements.coach_voice;
  if (['male', 'female'].includes(e.target.value) && !voice.dataset.touched) voice.value = e.target.value;
});
document.addEventListener('input', e => { if (e.target.name === 'coach_voice') e.target.dataset.touched = '1'; });

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-account]');
  if (!b) return;
  const a = b.dataset.account;
  if (a === 'retry') { account.status = 'idle'; render(); await startAccounts(); return render(); }
  if (a === 'edit') { account.editing = true; return render(); }
  if (a === 'cancel') { account.editing = false; return render(); }
  if (a === 'sync') { b.textContent = 'Syncing…'; return syncJournal(); }
  if (a === 'manage') return clerk().openUserProfile();
  if (a === 'signout') { await clerk().signOut(); return go('account'); }
  if (a === 'delete') {
    if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = 'Tap again to permanently delete'; return; }
    b.disabled = true;
    b.textContent = 'Deleting…';
    try { await deleteAccount(); go('account'); }
    catch { b.disabled = false; b.textContent = 'Could not delete. Try again.'; }
  }
});

window.addEventListener('online', () => { if (['offline', 'error'].includes(account.status)) startAccounts(); else syncJournal(); });
startAccounts();
