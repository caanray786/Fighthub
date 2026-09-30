// POST /api/account-close — called by the app just before a member deletes
// their account. Cancels any running subscription straight away so they are
// never charged again (a year pass has nothing to cancel).
import { json, handle } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser } from './_lib/clerk.mjs';
import { cancelSubscriptions } from './_lib/stripe.mjs';

export async function POST(request) {
  return handle(async () => {
    const member = await memberFromRequest(request);
    if (!process.env.STRIPE_SECRET_KEY) return json({ cancelled: 0 });
    const user = await getClerkUser(member.id);
    const customer = user.private_metadata?.stripe_customer_id;
    return json({ cancelled: customer ? await cancelSubscriptions(customer) : 0 });
  });
}
