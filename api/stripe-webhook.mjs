// POST /api/stripe-webhook — Stripe tells us when a subscription starts,
// renews, changes or ends, and when a year pass is refunded. Each change is copied to the member's Clerk
// account, which switches Premium on or off in the app.
import { json } from './_lib/http.mjs';
import { stripe, verifyStripeSignature, saveSubscription, saveYearPass, refundYearPass } from './_lib/stripe.mjs';

export async function POST(request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return json({ error: 'Invalid signature' }, 400);
  }
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' && obj.mode === 'payment' && obj.metadata?.pass === 'year') {
      const member = obj.client_reference_id || obj.metadata?.clerk_user_id;
      if (member && obj.payment_status === 'paid') await saveYearPass(member, obj);
    } else if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const member = obj.client_reference_id || obj.metadata?.clerk_user_id;
      if (member) await saveSubscription(member, await stripe(`/subscriptions/${obj.subscription}`));
    } else if (event.type === 'charge.refunded' && obj.refunded && obj.payment_intent) {
      // A fully refunded year pass (monthly refunds are made by cancelling the subscription)
      const { data = [] } = await stripe(`/checkout/sessions?payment_intent=${encodeURIComponent(obj.payment_intent)}`);
      const session = data.find(s => s.metadata?.pass === 'year');
      const member = session && (session.client_reference_id || session.metadata?.clerk_user_id);
      if (member) await refundYearPass(member, session.id);
    } else if (event.type.startsWith('customer.subscription.')) {
      const member = obj.metadata?.clerk_user_id;
      if (member) await saveSubscription(member, obj);
    }
  } catch (err) {
    // The member deleted their account: nothing left to update, so Stripe should stop retrying
    if (err.status === 404) return json({ received: true, note: 'member no longer exists' });
    console.error(`Webhook ${event.type} failed:`, err);
    return json({ error: 'Update failed' }, 500); // Stripe retries
  }
  return json({ received: true });
}
