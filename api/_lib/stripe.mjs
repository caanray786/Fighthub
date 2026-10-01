// Minimal Stripe client (no library needed) and webhook signature check.
// Uses STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET from Vercel.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { updateClerkMetadata, getClerkUser } from './clerk.mjs';
import { priceIds, hasPremium } from './http.mjs';

// Stripe expects nested form fields: line_items[0][price]=...
function formFields(value, prefix = '', out = new URLSearchParams()) {
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof v === 'object') formFields(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

export async function stripe(path, params, method = params ? 'POST' : 'GET') {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: params ? formFields(params) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    // Stripe explains what it refused; the member sees it, so problems can be reported and fixed
    const err = new Error(`Payment system: ${data.error?.message || `error ${res.status}`}`);
    err.status = 502;
    err.stripeStatus = res.status;
    throw err;
  }
  return data;
}

// Opens a Stripe Checkout page. Some Stripe accounts have "Managed Payments"
// (Stripe as the seller, needing product tax codes) switched on by default;
// FightHub takes its own payments, so it is switched off for this checkout.
// Accounts without the feature never see the extra setting.
export async function createCheckoutSession(params) {
  try {
    return await stripe('/checkout/sessions', params);
  } catch (err) {
    if (!/managed.payments/i.test(err.message)) throw err;
    return stripe('/checkout/sessions', { ...params, managed_payments: { enabled: 'false' } });
  }
}

// Stripe-Signature: t=timestamp,v1=signature — HMAC-SHA256 of "timestamp.body"
export function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const signatures = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some(sig => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// Copies a Stripe subscription onto the member's Clerk account, where the app reads it
export async function saveSubscription(clerkUserId, sub) {
  const user = await getClerkUser(clerkUserId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const current = user.public_metadata?.premium;
  const subActive = ['active', 'trialing', 'past_due'].includes(sub.status);
  // An old subscription ending must not cancel a year pass bought since
  if (current?.pass && hasPremium(current) && !subActive) {
    await updateClerkMetadata(clerkUserId, { private_metadata: { stripe_customer_id: customerId } });
    return;
  }
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  const periodEnd = sub.current_period_end || item?.current_period_end; // newer Stripe versions keep it on the item
  const iso = s => (s ? new Date(s * 1000).toISOString() : null);
  // Paused (no charges until resumes_at): Premium runs to the end of the month paid for
  const paused = subActive && sub.pause_collection;
  const paidUntil = paused ? (sub.metadata?.paid_until ? iso(Number(sub.metadata.paid_until)) : current?.paidUntil || iso(periodEnd)) : null;
  await updateClerkMetadata(clerkUserId, {
    public_metadata: {
      premium: {
        status: paused ? 'paused' : sub.status,
        paidUntil,
        resumes: paused ? iso(sub.pause_collection.resumes_at) : null,
        plan: priceId && priceId === priceIds().yearly ? 'yearly' : 'monthly',
        renews: iso(periodEnd),
        trialEnds: iso(sub.trial_end),
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        pass: false,
        expires: null,
        updated: new Date().toISOString()
      }
    },
    private_metadata: {
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id
    }
  });
}

// A one-off yearly payment: 12 months of Premium with no automatic renewal.
// Renewing early adds the new year onto the end of the current one.
export async function saveYearPass(clerkUserId, session) {
  const user = await getClerkUser(clerkUserId);
  if (user.private_metadata?.last_pass_session === session.id) return; // Stripe resent the same payment
  const current = user.public_metadata?.premium;
  const base = current?.pass && current.expires && new Date(current.expires) > new Date() ? new Date(current.expires) : new Date();
  const expires = new Date(base);
  expires.setFullYear(expires.getFullYear() + 1);
  await updateClerkMetadata(clerkUserId, {
    public_metadata: {
      premium: { status: 'active', plan: 'yearly', pass: true, expires: expires.toISOString(), renews: null, trialEnds: null, cancelAtPeriodEnd: false, updated: new Date().toISOString() }
    },
    private_metadata: {
      stripe_customer_id: (typeof session.customer === 'string' ? session.customer : session.customer?.id) || user.private_metadata?.stripe_customer_id,
      had_pass: true,
      last_pass_session: session.id
    }
  });
}

// A refunded year pass: that year comes off again (a pass renewed early
// keeps the rest). Premium ends if nothing is left. Safe if Stripe resends.
export async function refundYearPass(clerkUserId, sessionId) {
  const user = await getClerkUser(clerkUserId);
  const done = user.private_metadata?.refunded_passes || [];
  const current = user.public_metadata?.premium;
  if (done.includes(sessionId) || !current?.pass || !current.expires) return;
  const expires = new Date(current.expires);
  expires.setFullYear(expires.getFullYear() - 1);
  const ended = expires <= new Date();
  await updateClerkMetadata(clerkUserId, {
    public_metadata: { premium: { ...current, status: ended ? 'canceled' : current.status, expires: expires.toISOString(), updated: new Date().toISOString() } },
    private_metadata: { refunded_passes: [...done, sessionId].slice(-20) }
  });
}

// Closing an account: end every running subscription straight away, so a
// member who deletes their account is never charged again. Returns how many.
const RUNNING = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];
export async function cancelSubscriptions(customerId) {
  const { data = [] } = await stripe(`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`);
  const running = data.filter(s => RUNNING.includes(s.status));
  for (const s of running) await stripe(`/subscriptions/${s.id}`, null, 'DELETE');
  return running.length;
}

// ---- Pause instead of cancel ----
// Adds whole months to a Stripe time (seconds), keeping to the end of shorter months
export function addMonths(seconds, months) {
  const d = new Date(seconds * 1000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return Math.floor(d.getTime() / 1000);
}

// The pause starts when the paid month ends. Collection resumes an hour before the
// renewal that ends the pause, so that renewal is charged as normal.
export function pausePlan(sub, months) {
  const periodEnd = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
  return { paidUntil: periodEnd, resumesAt: addMonths(periodEnd, months) - 3600 };
}
