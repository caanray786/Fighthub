// POST /api/billing-checkout { plan: 'monthly' | 'yearly' }
// Signed-in members only. Opens a Stripe Checkout page for the chosen plan.
// A recurring price becomes a subscription; a one-off price is a 12-month
// pass (no automatic renewal), so the owner chooses the model in Stripe.
import { json, handle, httpError, billingReady, priceIds, trialDays, returnOrigin, hasPremium, passRenewable } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, primaryEmail } from './_lib/clerk.mjs';
import { stripe } from './_lib/stripe.mjs';

export async function POST(request) {
  return handle(async () => {
    if (!billingReady()) throw httpError(503, 'Subscriptions are not switched on yet.');
    const member = await memberFromRequest(request);
    const { plan } = await request.json().catch(() => ({}));
    const priceId = priceIds()[plan];
    if (!priceId) throw httpError(400, 'Choose a plan.');

    const user = await getClerkUser(member.id);
    const current = user.public_metadata?.premium;
    if (hasPremium(current) && !passRenewable(current)) {
      throw httpError(409, current.pass ? 'Your year pass is active. You can renew it in its last 30 days.' : 'You already have Premium. Use Manage subscription to change your plan.');
    }

    const price = await stripe(`/prices/${encodeURIComponent(priceId)}`);
    const oneOff = price.type === 'one_time';
    const customer = user.private_metadata?.stripe_customer_id;
    const origin = returnOrigin(request);
    const trial = trialDays();
    const hadTrial = !!user.private_metadata?.stripe_subscription_id || !!user.private_metadata?.had_pass; // one free trial per member

    const session = await stripe('/checkout/sessions', {
      mode: oneOff ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/?checkout=success`,
      cancel_url: `${origin}/app/?checkout=cancelled`,
      client_reference_id: member.id,
      metadata: { clerk_user_id: member.id, plan, ...(oneOff ? { pass: 'year' } : {}) },
      ...(oneOff
        ? { invoice_creation: { enabled: 'true' }, ...(customer ? {} : { customer_creation: 'always' }) } // receipt + a customer record for invoices
        : { subscription_data: { metadata: { clerk_user_id: member.id }, ...(trial && !hadTrial ? { trial_period_days: trial } : {}) } }),
      allow_promotion_codes: 'true',
      ...(customer ? { customer } : { customer_email: primaryEmail(user) || undefined })
    });
    return json({ url: session.url });
  });
}
