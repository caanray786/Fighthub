// POST /api/stripe-webhook — Stripe tells us when a subscription starts,
// renews, changes or ends. Each change is copied to the member's Clerk
// account, which switches Premium on or off in the app.
import { json } from './_lib/http.mjs';
import { stripe, verifyStripeSignature, saveSubscription } from './_lib/stripe.mjs';

export async function POST(request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return json({ error: 'Invalid signature' }, 400);
  }
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const member = obj.client_reference_id || obj.metadata?.clerk_user_id;
      if (member) await saveSubscription(member, await stripe(`/subscriptions/${obj.subscription}`));
    } else if (event.type.startsWith('customer.subscription.')) {
      const member = obj.metadata?.clerk_user_id;
      if (member) await saveSubscription(member, obj);
    }
  } catch (err) {
    console.error(`Webhook ${event.type} failed:`, err);
    return json({ error: 'Update failed' }, 500); // Stripe retries
  }
  return json({ received: true });
}
