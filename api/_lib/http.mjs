// Shared helpers for the website's server functions (Vercel).
// Secrets come from Vercel's environment variables, never from code.

export const SITE = 'https://www.fighthub.world';
const ALLOWED_ORIGINS = ['https://www.fighthub.world', 'https://fighthub.world', 'https://fighthub-swart.vercel.app'];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
  });
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Runs a handler, turning thrown errors into JSON responses without leaking details
export async function handle(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!err.status || err.status >= 500) console.error(err);
    return json({ error: err.status ? err.message : 'Something went wrong. Please try again.' }, err.status || 500);
  }
}

// Where to send members back to after Stripe: the site they came from, if it is ours
export function returnOrigin(request) {
  const origin = request.headers.get('origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : SITE;
}

export const priceIds = () => ({ monthly: process.env.STRIPE_PRICE_MONTHLY || '', yearly: process.env.STRIPE_PRICE_YEARLY || '' });
export const trialDays = () => Math.max(0, parseInt(process.env.STRIPE_TRIAL_DAYS || '0', 10) || 0);
export const billingReady = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.CLERK_SECRET_KEY);

// Statuses that give Premium access (past_due keeps access while Stripe retries the card)
export const PREMIUM_STATUSES = ['active', 'trialing', 'past_due'];

// Premium right now? Year passes (one-off payments) also need an unexpired end date
export const hasPremium = p => !!p && PREMIUM_STATUSES.includes(p.status) && (!p.expires || new Date(p.expires) > new Date());

// A year pass can be renewed in its last 30 days (the new year is added on to the end)
export const passRenewable = p => !!p?.pass && (!p.expires || new Date(p.expires) - Date.now() < 30 * 86400000);
