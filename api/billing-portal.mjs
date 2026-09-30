// POST /api/billing-portal — signed-in members manage their subscription
// (change plan, update card, see invoices, cancel) on Stripe's secure page.
import { json, handle, httpError, billingReady, returnOrigin } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser } from './_lib/clerk.mjs';
import { stripe } from './_lib/stripe.mjs';

export async function POST(request) {
  return handle(async () => {
    if (!billingReady()) throw httpError(503, 'Subscriptions are not switched on yet.');
    const member = await memberFromRequest(request);
    const user = await getClerkUser(member.id);
    const customer = user.private_metadata?.stripe_customer_id;
    if (!customer) throw httpError(404, 'You do not have a subscription yet.');
    const session = await stripe('/billing_portal/sessions', { customer, return_url: `${returnOrigin(request)}/app/?billing=updated` });
    return json({ url: session.url });
  });
}
