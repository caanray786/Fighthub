// Refer a friend.
// - A member's invite link carries their member id: /app/?ref=<id without "user_">.
// - The friend (new to Premium) gets their first month free on the monthly plan.
// - The member earns a free month when the friend's first paid month goes
//   through: credit on their Stripe account (used by their next bill), or one
//   more month on a year pass. Fake accounts gain nothing: a free month is only
//   earned after real money is paid.
import { stripe } from './stripe.mjs';
import { getClerkUser, updateClerkMetadata, primaryEmail } from './clerk.mjs';

export const FRIEND_COUPON = 'fighthub-friend-month';
const MONTH_PENCE = 1999;

// The referring member's id, if this invite can be used by this member
export async function validReferrer(ref, member, user) {
  if (typeof ref !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(ref)) return null;
  const referrerId = `user_${ref}`;
  if (referrerId === member.id) return null;
  if (user.private_metadata?.stripe_subscription_id || user.private_metadata?.had_pass) return null; // new members only
  try { await getClerkUser(referrerId); } catch { return null; }
  return referrerId;
}

// The "first month free" coupon, created in Stripe the first time it is needed
export async function ensureFriendCoupon() {
  try {
    await stripe(`/coupons/${FRIEND_COUPON}`);
  } catch (err) {
    if (!/No such coupon/i.test(err.message)) throw err;
    await stripe('/coupons', { id: FRIEND_COUPON, percent_off: 100, duration: 'once', name: 'Friend invite: first month free' });
  }
  return FRIEND_COUPON;
}

// A friend started Premium with this member's invite
export async function recordFriendJoined(referrerId, friendId) {
  const user = await getClerkUser(referrerId);
  const friends = user.private_metadata?.referredFriends || [];
  if (friends.includes(friendId)) return;
  const stats = user.public_metadata?.referrals || { joined: 0, earned: 0 };
  await updateClerkMetadata(referrerId, {
    private_metadata: { referredFriends: [...friends, friendId].slice(-200) },
    public_metadata: { referrals: { ...stats, joined: (stats.joined || 0) + 1 } }
  });
}

// Called when a friend's subscription changes: rewards the referrer once, after the
// friend's first paid month. Returns what happened, for logs and tests.
export async function rewardReferrer(sub) {
  const referrerId = sub.metadata?.referrer;
  if (!referrerId || sub.metadata?.referral_rewarded || sub.status !== 'active' || !sub.latest_invoice) return 'skip';
  const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice.id;
  const invoice = await stripe(`/invoices/${encodeURIComponent(invoiceId)}`);
  if (invoice.status !== 'paid' || !(invoice.amount_paid > 0)) return 'not-yet';
  // Mark first, so a resent event can never pay twice
  await stripe(`/subscriptions/${sub.id}`, { metadata: { referral_rewarded: '1' } });

  let user;
  try { user = await getClerkUser(referrerId); } catch { return 'referrer-gone'; }
  const premium = user.public_metadata?.premium;
  const stats = user.public_metadata?.referrals || { joined: 0, earned: 0 };
  const earned = { referrals: { ...stats, earned: (stats.earned || 0) + 1 } };

  // Year pass: one more month on the end
  if (premium?.pass && premium.expires && new Date(premium.expires) > new Date()) {
    const expires = new Date(premium.expires);
    expires.setMonth(expires.getMonth() + 1);
    await updateClerkMetadata(referrerId, { public_metadata: { premium: { ...premium, expires: expires.toISOString() }, ...earned } });
    return 'pass-extended';
  }
  // Otherwise: a month's credit on their Stripe account (a customer is created if needed)
  let customer = user.private_metadata?.stripe_customer_id;
  if (!customer) {
    customer = (await stripe('/customers', { email: primaryEmail(user) || undefined, metadata: { clerk_user_id: referrerId } })).id;
  }
  await stripe(`/customers/${customer}/balance_transactions`, { amount: -MONTH_PENCE, currency: 'gbp', description: 'Fight Hub: a free month for inviting a friend' });
  await updateClerkMetadata(referrerId, { private_metadata: { stripe_customer_id: customer }, public_metadata: earned });
  return 'credited';
}
