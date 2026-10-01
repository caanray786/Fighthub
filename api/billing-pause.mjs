// POST /api/billing-pause { action: 'pause', months: 1-3 } or { action: 'resume' }
// "Pause instead of cancel" for monthly members: no charges while paused,
// Premium until the end of the month already paid for, and it restarts by
// itself. Resuming within the paid month costs nothing; resuming later
// charges for a new month from today.
import { json, handle, httpError, billingReady } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser } from './_lib/clerk.mjs';
import { stripe, saveSubscription, pausePlan } from './_lib/stripe.mjs';

export async function POST(request) {
  return handle(async () => {
    if (!billingReady()) throw httpError(503, 'Subscriptions are not switched on yet.');
    const member = await memberFromRequest(request);
    const { action, months } = await request.json().catch(() => ({}));
    const user = await getClerkUser(member.id);
    const subId = user.private_metadata?.stripe_subscription_id;
    if (!subId) throw httpError(404, 'Pausing is for monthly subscriptions.');
    const sub = await stripe(`/subscriptions/${encodeURIComponent(subId)}`);

    if (action === 'pause') {
      const n = Number(months);
      if (![1, 2, 3].includes(n)) throw httpError(400, 'Choose 1, 2 or 3 months.');
      if (sub.status !== 'active') throw httpError(409, 'Only an active subscription can be paused.');
      if (sub.pause_collection) throw httpError(409, 'Your subscription is already paused.');
      if (sub.cancel_at_period_end) throw httpError(409, 'Your subscription is already set to end. Use Manage subscription to keep it.');
      const plan = pausePlan(sub, n);
      const updated = await stripe(`/subscriptions/${sub.id}`, {
        pause_collection: { behavior: 'void', resumes_at: plan.resumesAt },
        metadata: { paid_until: plan.paidUntil }
      });
      await saveSubscription(member.id, updated);
      return json({ paused: true, paidUntil: new Date(plan.paidUntil * 1000).toISOString(), resumes: new Date(plan.resumesAt * 1000).toISOString() });
    }

    if (action === 'resume') {
      if (!sub.pause_collection) throw httpError(409, 'Your subscription is not paused.');
      const paidUntil = Number(sub.metadata?.paid_until) || 0;
      const stillPaid = paidUntil * 1000 > Date.now();
      // After the paid month, resuming starts a new month today (charged now)
      const updated = await stripe(`/subscriptions/${sub.id}`, {
        pause_collection: '',
        metadata: { paid_until: '' },
        ...(stillPaid ? {} : { billing_cycle_anchor: 'now', proration_behavior: 'none' })
      });
      await saveSubscription(member.id, updated);
      return json({ resumed: true, charged: !stillPaid });
    }

    throw httpError(400, 'Choose pause or resume.');
  });
}
