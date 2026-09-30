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

export async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: params ? formFields(params) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data.error?.message || 'error'}`);
  return data;
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
  await updateClerkMetadata(clerkUserId, {
    public_metadata: {
      premium: {
        status: sub.status,
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
