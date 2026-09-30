// GET /api/billing-plans — the Premium plans and prices, read live from Stripe,
// so prices are changed in the Stripe dashboard, not in code.
import { json, handle, billingReady, priceIds, trialDays } from './_lib/http.mjs';
import { stripe } from './_lib/stripe.mjs';

export async function GET() {
  return handle(async () => {
    if (!billingReady()) return json({ live: false });
    const ids = priceIds();
    const plans = [];
    for (const [id, priceId] of Object.entries(ids)) {
      if (!priceId) continue;
      const price = await stripe(`/prices/${encodeURIComponent(priceId)}`);
      if (!price.active) continue;
      // oneOff: a single payment for 12 months (no automatic renewal)
      plans.push({ id, amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval || (id === 'yearly' ? 'year' : 'month'), oneOff: price.type === 'one_time' });
    }
    return json({ live: plans.length > 0, trialDays: trialDays(), plans }, 200, { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' });
  });
}
