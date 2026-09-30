// POST /api/billing-checkout { plan: 'monthly' | 'yearly' }
// Signed-in members only. Opens a Stripe Checkout page for the chosen plan.
import { json, handle, httpError, billingReady, priceIds, trialDays, returnOrigin, PREMIUM_STATUSES } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, primaryEmail } from './_lib/clerk.mjs';
import { stripe } from './_lib/stripe.mjs';

export async function POST(request) {
  return handle(async () => {
    if (!billingReady()) throw httpError(503, 'Subscriptions are not switched on yet.');
    const member = await memberFromRequest(request);
    const { plan } = await request.json().catch(() => ({}));
    const price = priceIds()[plan];
    if (!price) throw httpError(400, 'Choose a plan.');

    const user = await getClerkUser(member.id);
    const current = user.public_metadata?.premium;
    if (current && PREMIUM_STATUSES.includes(current.status)) throw httpError(409, 'You already have Premium. Use Manage subscription to change your plan.');

    const customer = user.private_metadata?.stripe_customer_id;
    const origin = returnOrigin(request);
    const trial = trialDays();
    // One free trial per member: none if they have subscribed before
    const hadTrial = !!user.private_metadata?.stripe_subscription_id;

    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/app/?checkout=success`,
      cancel_url: `${origin}/app/?checkout=cancelled`,
      client_reference_id: member.id,
      metadata: { clerk_user_id: member.id },
      subscription_data: {
        metadata: { clerk_user_id: member.id },
        ...(trial && !hadTrial ? { trial_period_days: trial } : {})
      },
      allow_promotion_codes: 'true',
      ...(customer ? { customer } : { customer_email: primaryEmail(user) || undefined })
    });
    return json({ url: session.url });
  });
}
