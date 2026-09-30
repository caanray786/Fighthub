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
  return p && PREMIUM_STATUSES.includes(p.status) ? p : null;
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
const longDate = iso => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

async function billingCall(path, body) {
  const token = await window.Clerk?.session?.getToken();
  if (!token) throw new Error('Please sign in first.');
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// After Stripe Checkout: wait for the webhook to switch Premium on
async function handleCheckoutReturn() {
  const params = new URLSearchParams(location.search);
  const result = params.get('checkout') || params.get('billing');
  if (!result || billing.returnHandled || !signedIn()) return;
  billing.returnHandled = true;
  history.replaceState(history.state, '', location.pathname); // tidy the address
  if (result === 'cancelled') { billing.message = 'Checkout cancelled. You have not been charged.'; return go('premium'); }
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
  'Every fight session in all 9 disciplines, with the round timer',
  'The full Splits and high kicks and Fighter roadwork programmes',
  'All 85 illustrated exercises and 17 home and gym sessions',
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
    <span class="plan-name">${p.interval === 'year' ? 'Yearly' : 'Monthly'}${saving > 0 ? `<span class="badge">SAVE ${saving}%</span>` : ''}</span>
    <strong>${money(p.amount, p.currency)}<small>/${p.interval === 'year' ? 'year' : 'month'}</small></strong>
    ${p.interval === 'year' ? `<span class="small">${money(perMonth, p.currency)} a month, billed yearly</span>` : '<span class="small">Billed monthly</span>'}
  </button>`;
}

function premiumMarkup() {
  const note = billing.message ? `<p class="status" role="status">${esc(billing.message)}</p>` : '';
  const mine = memberPremium();
  if (billing.live && mine) {
    const status = mine.status === 'trialing' ? `Free trial until ${longDate(mine.trialEnds)}`
      : mine.status === 'past_due' ? 'Payment problem: please update your card'
      : mine.cancelAtPeriodEnd ? `Ends on ${longDate(mine.renews)}` : `Renews on ${longDate(mine.renews)}`;
    return title('Fight Hub Premium', 'You’re<br>Premium.') + note
      + `<div class="card feature"><span class="badge">${mine.status === 'trialing' ? 'FREE TRIAL' : 'PREMIUM'}</span>
          <h3>${mine.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan</h3><p class="small">${esc(status)}</p>
          <button class="primary full" data-premium="portal">Manage subscription</button>
          <p class="small">Change plan, update your card, see invoices or cancel, on Stripe’s secure page.</p></div>
        <h3>Everything included</h3>${list(INCLUDED)}
        <button class="full" data-fight="page" data-id="fight">Go to fight training</button>`;
  }
  if (billing.live) {
    const sel = billing.plans.find(p => p.id === billing.selected) || billing.plans[0];
    const trial = billing.trialDays;
    const after = sel ? `${money(sel.amount, sel.currency)} a ${sel.interval === 'year' ? 'year' : 'month'}` : '';
    return title('Fight Hub Premium', 'Train like a fighter.<br>Every day.') + note
      + `<div class="plan-options">${billing.plans.map(planCard).join('')}</div>
        <button class="primary full" data-premium="checkout" ${billing.busy ? 'disabled' : ''}>${billing.busy ? 'Opening secure checkout…' : trial ? `Start ${trial}-day free trial` : 'Subscribe'}</button>
        <p class="small">${trial ? `Free for ${trial} days, then ${after}. Cancel before the trial ends and you won’t be charged.` : `${after}.`} Renews automatically; cancel any time in your account. Payments are handled securely by Stripe.</p>
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
};

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-premium]');
  if (!b) return;
  const a = b.dataset.premium;
  if (a === 'select') { billing.selected = b.dataset.id; return render(); }
  if (a === 'checkout' || a === 'portal') {
    billing.busy = true;
    billing.message = '';
    render();
    try {
      const { url } = await billingCall(a === 'checkout' ? '/api/billing-checkout' : '/api/billing-portal', a === 'checkout' ? { plan: billing.selected } : {});
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
