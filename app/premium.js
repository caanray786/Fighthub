/* Premium membership with Stripe.
   - Plans and prices come live from Stripe via the website (/api/billing-plans),
     so prices are set in the Stripe dashboard.
   - Subscribing opens Stripe Checkout; "Manage subscription" opens Stripe's
     customer portal (change plan, card, invoices, cancel).
   - Stripe tells the website about every change, which saves it on the
     member's Clerk account; the app reads it from there to switch Premium on.
   Until Stripe is switched on, Premium stays free to try (early access). */

const billing = { live: null, plans: [], trialDays: 0, selected: 'yearly', busy: false, message: '', returnHandled: false };
const PREMIUM_STATUSES = ['active', 'trialing', 'past_due'];
const apiUrl = path => (location.protocol.startsWith('http') ? '' : SITE_URL) + path;

function memberPremium() {
  const p = window.Clerk?.user?.publicMetadata?.premium;
  if (!p) return null;
  // A paused subscription keeps Premium until the end of the month already paid for
  if (p.status === 'paused') return p.paidUntil && new Date(p.paidUntil) > new Date() ? p : null;
  // Year passes (one-off payments) also need an unexpired end date
  return PREMIUM_STATUSES.includes(p.status) && (!p.expires || new Date(p.expires) > new Date()) ? p : null;
}

// "Thinking of cancelling?": a break keeps members who would otherwise leave
function pauseOffer(mine) {
  return `<details class="card pause-offer"><summary><strong>Thinking of cancelling?</strong><span class="small">Take a break instead</span></summary>
    <p class="small">Pause for up to 3 months. You keep Premium until ${esc(longDate(mine.renews))}, nothing is charged while you’re away, and your journal, goals and streaks are kept. It restarts by itself, or you can come back any time.</p>
    <label class="field">Pause for<select id="pause-months">${[1, 2, 3].map(n => `<option value="${n}">${n} ${n === 1 ? 'month' : 'months'}</option>`).join('')}</select></label>
    <button class="primary full" data-premium="pause" ${billing.busy ? 'disabled' : ''}>Pause my subscription</button>
    <button class="full" data-premium="portal">No thanks, cancel instead</button>
  </details>`;
}

function pausedMarkup(sub, note) {
  const stillPaid = sub.paidUntil && new Date(sub.paidUntil) > new Date();
  const monthly = billing.plans.find(p => p.id === 'monthly');
  const price = !stillPaid && monthly ? ` (${money(monthly.amount, monthly.currency)} today)` : '';
  return title('Fight Hub Premium', 'Taking a<br>break.') + note
    + `<div class="card feature"><span class="badge">PAUSED</span>
        <h3>Paused until ${esc(longDate(sub.resumes))}</h3>
        <p class="small">${stillPaid ? `You keep Premium until ${esc(longDate(sub.paidUntil))}. ` : ''}Nothing is charged while you’re paused, and it restarts by itself on ${esc(longDate(sub.resumes))}. Your journal, goals and streaks are all kept.</p>
        <button class="primary full" data-premium="resume" ${billing.busy ? 'disabled' : ''}>Resume now${price}</button>
        <button class="full" data-premium="portal">Manage subscription</button></div>
      <h3>Waiting for you when you’re back</h3>${list(INCLUDED)}`;
}

// With Stripe live, Premium is whatever the member's subscription says
function applyPremium() {
  window.billingLive = !!billing.live;
  if (billing.live) training.premium = !!memberPremium();
}

async function loadPlans() {
  try {
    const res = await fetch(apiUrl('/api/billing-plans'));
    const data = res.ok ? await res.json() : { live: false };
    billing.live = !!data.live;
    billing.plans = data.plans || [];
    billing.trialDays = data.trialDays || 0;
    if (!billing.plans.some(p => p.id === billing.selected)) billing.selected = billing.plans[0]?.id || 'monthly';
  } catch {
    billing.live = false;
  }
  applyPremium();
  if (state.page === 'premium') render();
}

const money = (amount, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: amount % 100 ? 2 : 0 }).format(amount / 100);
const daysUntil = iso => Math.ceil((new Date(iso) - Date.now()) / 86400000);
const longDate = iso => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

async function billingCall(path, body) {
  const token = await window.Clerk?.session?.getToken();
  if (!token) throw new Error('Please sign in first.');
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/* ---- Refer a friend ----
   An invite link (/app/?ref=...) is remembered on this phone until the friend
   subscribes. The website decides if it applies (new members, monthly plan). */
const REF_KEY = 'fight-hub-ref';
(() => {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9]{10,40}$/.test(ref)) { try { localStorage.setItem(REF_KEY, ref); } catch { /* private mode */ } }
})();

function inviteRef() {
  let ref = '';
  try { ref = localStorage.getItem(REF_KEY) || ''; } catch { /* ignore */ }
  const own = window.Clerk?.user?.id?.replace(/^user_/, '');
  return ref && ref !== own ? ref : '';
}

const inviteLink = () => (window.Clerk?.user?.id ? `${SITE_URL}/app/?ref=${window.Clerk.user.id.replace(/^user_/, '')}` : '');

function inviteMarkup() {
  if (!billing.live || !inviteLink()) return '';
  const r = window.Clerk?.user?.publicMetadata?.referrals || {};
  return `<div class="card invite-card"><span class="eyebrow">Invite a friend</span><h3>Give a friend a free month</h3>
    <p class="small">Your friend gets their first month of monthly Premium free. When they pay for their first month, you get a month free too.</p>
    ${r.joined || r.earned ? `<p class="small">Friends joined: ${r.joined || 0} · Free months earned: ${r.earned || 0}</p>` : ''}
    <div class="row-buttons"><button class="primary" data-premium="invite">${icon('share')} Share invite</button><button data-premium="copy-invite">${icon('link')} Copy link</button></div></div>`;
}

// After Stripe Checkout: wait for the webhook to switch Premium on
async function handleCheckoutReturn() {
  const params = new URLSearchParams(location.search);
  const result = params.get('checkout') || params.get('billing');
  if (!result || billing.returnHandled || !signedIn()) return;
  billing.returnHandled = true;
  history.replaceState(history.state, '', location.pathname); // tidy the address
  if (result === 'cancelled') { billing.message = 'Checkout cancelled. You have not been charged.'; return go('premium'); }
  if (result === 'success') { try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ } }
  billing.message = result === 'success' ? 'Payment received. Switching on Premium…' : 'Updating your membership…';
  go('premium');
  for (let i = 0; i < 15; i++) {
    await window.Clerk.user.reload();
    applyPremium();
    if (result !== 'success' || memberPremium()) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  billing.message = result === 'success'
    ? (memberPremium() ? 'Welcome to Premium. Everything is unlocked.' : 'Payment received. Premium will switch on in a moment; reopen the app if it has not.')
    : 'Your membership is up to date.';
  render();
}

const INCLUDED = [
  'Every fight session in all 10 disciplines, including self-defence, with the round timer',
  'The full Splits and high kicks and Fighter roadwork programmes',
  'All 100+ illustrated exercises and 17 home and gym sessions',
  'HIIT: 25, 30 and 40 minutes at three levels',
  'Dated weekly routines and the custom session builder'
];
const FREE = [
  'One fight session for every discipline',
  '12 beginner exercises and 3 starter workouts',
  'The run-walk starter and week 1 of every programme',
  'Your training journal, goals, challenges and achievements',
  'Live fight news and the next fight night'
];
const list = items => `<ul class="check-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;

function planCard(p) {
  const monthly = billing.plans.find(x => x.id === 'monthly');
  const perMonth = p.interval === 'year' ? Math.round(p.amount / 12) : p.amount;
  const saving = p.interval === 'year' && monthly ? Math.round((1 - p.amount / (monthly.amount * 12)) * 100) : 0;
  return `<button type="button" class="plan-option" data-premium="select" data-id="${p.id}" aria-pressed="${billing.selected === p.id}">
    <span class="plan-name">${p.oneOff ? '12 months' : p.interval === 'year' ? 'Yearly' : 'Monthly'}${saving > 0 ? `<span class="badge">SAVE ${saving}%</span>` : ''}</span>
    <strong>${money(p.amount, p.currency)}<small>${p.oneOff ? ' one payment' : `/${p.interval === 'year' ? 'year' : 'month'}`}</small></strong>
    ${p.oneOff ? `<span class="small">${money(perMonth, p.currency)} a month · no automatic renewal</span>` : p.interval === 'year' ? `<span class="small">${money(perMonth, p.currency)} a month, billed yearly</span>` : '<span class="small">Billed monthly · cancel any time</span>'}
  </button>`;
}

function premiumMarkup() {
  const note = billing.message ? `<p class="status" role="status">${esc(billing.message)}</p>` : '';
  const mine = memberPremium();
  const sub = window.Clerk?.user?.publicMetadata?.premium;
  if (billing.live && sub?.status === 'paused') return pausedMarkup(sub, note);
  if (billing.live && mine) {
    if (mine.pass) {
      const left = daysUntil(mine.expires);
      return title('Fight Hub Premium', 'You’re<br>Premium.') + note
        + `<div class="card feature"><span class="badge">YEAR PASS</span>
            <h3>Premium until ${esc(longDate(mine.expires))}</h3>
            <p class="small">${left <= 30 ? `Ends in ${left} ${left === 1 ? 'day' : 'days'}. Renew now and the new year is added on to the end.` : 'One payment, no automatic renewal. We’ll remind you before it ends.'}</p>
            ${left <= 30 ? `<button class="primary full" data-premium="renew" ${billing.busy ? 'disabled' : ''}>Renew for another year</button>` : ''}
            <button class="full" data-premium="portal">Payments and receipts</button></div>
          <h3>Everything included</h3>${list(INCLUDED)}
          <button class="full" data-fight="page" data-id="fight">Go to fight training</button>`;
    }
    const status = mine.status === 'trialing' ? `Free trial until ${longDate(mine.trialEnds)}`
      : mine.status === 'past_due' ? 'Payment problem: please update your card'
      : mine.cancelAtPeriodEnd ? `Ends on ${longDate(mine.renews)}` : `Renews on ${longDate(mine.renews)}`;
    return title('Fight Hub Premium', 'You’re<br>Premium.') + note
      + `<div class="card feature"><span class="badge">${mine.status === 'trialing' ? 'FREE TRIAL' : 'PREMIUM'}</span>
          <h3>${mine.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan</h3><p class="small">${esc(status)}</p>
          <button class="primary full" data-premium="portal">Manage subscription</button>
          <p class="small">Change plan, update your card, see invoices or cancel, on Stripe’s secure page.</p></div>
        ${mine.status === 'active' && !mine.cancelAtPeriodEnd && mine.plan !== 'yearly' ? pauseOffer(mine) : ''}
        ${inviteMarkup()}
        <h3>Everything included</h3>${list(INCLUDED)}
        <button class="full" data-fight="page" data-id="fight">Go to fight training</button>`;
  }
  if (billing.live) {
    const sel = billing.plans.find(p => p.id === billing.selected) || billing.plans[0];
    const trial = billing.trialDays;
    const after = sel ? `${money(sel.amount, sel.currency)} a ${sel.interval === 'year' ? 'year' : 'month'}` : '';
    return title('Fight Hub Premium', 'Train like a fighter.<br>Every day.') + note
      + (inviteRef() ? `<div class="card invite-note"><span class="eyebrow">Friend invite</span><p class="small">${sel?.id === 'monthly' ? 'Your friend’s invite gives you your <strong>first month free</strong> on the monthly plan (for new members). You can cancel before it ends.' : 'Your friend’s invite gives you a free first month if you choose the monthly plan.'}</p></div>` : '')
      + `<div class="plan-options">${billing.plans.map(planCard).join('')}</div>
        <button class="primary full" data-premium="checkout" ${billing.busy ? 'disabled' : ''}>${billing.busy ? 'Opening secure checkout…'   : sel?.oneOff ? 'Get 12 months of Premium' : inviteRef() ? 'Start my free month' : trial ? `Start ${trial}-day free trial` : 'Subscribe'}</button>
        <p class="small">${sel?.oneOff ? `One payment of ${money(sel.amount, sel.currency)} for 12 months of Premium. It does not renew automatically; we’ll remind you before it ends.` : `${trial ? `Free for ${trial} days, then ${after}. Cancel before the trial ends and you won’t be charged.` : `${after}.`} Renews automatically; cancel any time in your account.`} Payments are handled securely by Stripe.</p>
        <p class="small">By continuing you agree to our ${legalLink('terms', 'Terms')}. Changed your mind? Cancel within 14 days of your first payment for a full refund: see ${legalLink('cancellation', 'Cancellations and refunds')}.</p>
        <h3>Premium includes</h3>${list(INCLUDED)}
        <details><summary>What’s free</summary>${list(FREE)}</details>`;
  }
  if (billing.live === null) return title('Fight Hub Premium', 'One moment…') + '<p class="small" role="status">Loading plans…</p>';
  // Before Stripe is switched on: early access
  return title('Fight Hub Premium', 'Train like a fighter.<br>Every day.') + note
    + `<div class="card feature"><span class="badge">EARLY ACCESS${training.premium ? ' · ON' : ''}</span>
        <h3>Premium is free to try</h3><p class="small">Subscriptions open soon. Until then, switch Premium on at no charge; no payment details are taken.</p>
        <button class="primary full" data-training="toggle-premium">${training.premium ? 'Return to the free plan' : 'Try Premium free'}</button></div>
      <h3>Premium includes</h3>${list(INCLUDED)}
      <details><summary>What’s free</summary>${list(FREE)}</details>`;
}

const beforePremium = render;
render = function () {
  applyPremium();
  beforePremium();
  if (state.page === 'premium' && !needsSignIn()) screen.innerHTML = premiumMarkup();
  // Header pill: shows membership at a glance
  const pill = document.querySelector('.premium-pill');
  if (pill) { const on = billing.live ? !!memberPremium() : training.premium; pill.textContent = on ? 'Premium' : 'Go Premium'; pill.classList.toggle('is-member', on); }
  if (signedIn() && billing.live !== null) handleCheckoutReturn();
  if (state.page === 'account' && signedIn() && !screen.querySelector('.invite-card')) {
    const journalCard = [...screen.querySelectorAll('.card h3')].find(h => h.textContent === 'Training journal')?.closest('.card');
    journalCard?.insertAdjacentHTML('beforebegin', inviteMarkup());
  }
  // Reminder on Today in the last 30 days of a year pass
  const pass = billing.live && memberPremium();
  if (state.page === 'today' && pass?.pass && daysUntil(pass.expires) <= 30 && !screen.querySelector('.renew-card')) {
    const left = daysUntil(pass.expires);
    screen.querySelector('h2')?.insertAdjacentHTML('afterend', `<div class="card renew-card"><span class="eyebrow">Your Premium year</span><h3>Ends in ${left} ${left === 1 ? 'day' : 'days'}</h3><p class="small">Renew to keep every programme, your goals and your streaks going. The new year is added on to the end.</p><button class="primary full" data-go="premium">Renew Premium</button></div>`);
  }
};

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-premium]');
  if (!b) return;
  const a = b.dataset.premium;
  if (a === 'select') { billing.selected = b.dataset.id; return render(); }
  if (a === 'invite' || a === 'copy-invite') {
    const url = inviteLink();
    const text = 'Train with me on Fight Hub. My invite gets you your first month of Premium free:';
    try {
      if (a === 'invite' && navigator.share) await navigator.share({ title: 'Fight Hub', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); b.textContent = 'Link copied'; }
    } catch { /* cancelled */ }
    return;
  }
  if (a === 'pause' || a === 'resume') {
    const months = Number(document.getElementById('pause-months')?.value || 1);
    billing.busy = true;
    billing.message = '';
    render();
    try {
      const r = await billingCall('/api/billing-pause', a === 'pause' ? { action: 'pause', months } : { action: 'resume' });
      await window.Clerk?.user?.reload();
      applyPremium();
      billing.message = a === 'pause'
        ? `Paused. You keep Premium until ${longDate(r.paidUntil)}, and it restarts on ${longDate(r.resumes)}.`
        : r.charged ? 'Welcome back. Your new month starts today.' : 'Welcome back. Your subscription is running again.';
    } catch (err) {
      billing.message = err.message;
    }
    billing.busy = false;
    return render();
  }
  if (a === 'renew') billing.selected = 'yearly';
  if (a === 'checkout' || a === 'portal' || a === 'renew') {
    billing.busy = true;
    billing.message = '';
    render();
    try {
      const pay = a === 'checkout' || a === 'renew';
      const { url } = await billingCall(pay ? '/api/billing-checkout' : '/api/billing-portal', pay ? { plan: billing.selected, ref: inviteRef() || undefined } : {});
      location.href = url;
    } catch (err) {
      billing.busy = false;
      billing.message = err.message;
      render();
    }
  }
});

loadPlans();

// Coming back from Stripe with the back button: make the buttons usable again
window.addEventListener('pageshow', e => { if (e.persisted && billing.busy) { billing.busy = false; render(); } });
