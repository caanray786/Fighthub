// Run: node --test tests/billing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { verifyStripeSignature } from '../api/_lib/stripe.mjs';
import { memberFromRequest } from '../api/_lib/clerk.mjs';
import { GET as plans } from '../api/billing-plans.mjs';
import { POST as checkout } from '../api/billing-checkout.mjs';
import { POST as webhook } from '../api/stripe-webhook.mjs';

const stripeHeader = (body, secret, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('Stripe signatures: genuine accepted, tampered, wrong secret and old ones refused', () => {
  const body = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(body, stripeHeader(body, 'whsec_a'), 'whsec_a'), true);
  assert.equal(verifyStripeSignature(body + ' ', stripeHeader(body, 'whsec_a'), 'whsec_a'), false);
  assert.equal(verifyStripeSignature(body, stripeHeader(body, 'whsec_b'), 'whsec_a'), false);
  assert.equal(verifyStripeSignature(body, stripeHeader(body, 'whsec_a', Math.floor(Date.now() / 1000) - 3600), 'whsec_a'), false);
  assert.equal(verifyStripeSignature(body, undefined, 'whsec_a'), false);
});

test('webhook refuses unsigned requests', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const res = await webhook(new Request('https://x/api/stripe-webhook', { method: 'POST', body: '{"type":"customer.subscription.updated"}' }));
  assert.equal(res.status, 400);
});

test('sign-in tokens: missing, forged and wrong-issuer tokens are refused', async () => {
  const req = auth => new Request('https://x/api', { headers: auth ? { authorization: auth } : {} });
  await assert.rejects(memberFromRequest(req()), { status: 401 });
  await assert.rejects(memberFromRequest(req('Bearer not.a.token')), { status: 401 });
  // Correctly shaped token signed by an attacker's own key, claiming our issuer
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  for (const iss of ['https://amused-anchovy-2720.clerk.accounts.dev', 'https://evil.example.com']) {
    const head = part({ alg: 'RS256', kid: 'forged', typ: 'JWT' }), body = part({ iss, sub: 'user_x', exp: now + 60 });
    const sig = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
    await assert.rejects(memberFromRequest(req(`Bearer ${head}.${body}.${sig}`)), { status: 401 });
  }
});

test('with no Stripe keys, plans report not live and checkout is refused', async () => {
  delete process.env.STRIPE_SECRET_KEY;
  const res = await plans();
  assert.deepEqual(await res.json(), { live: false });
  const out = await checkout(new Request('https://x/api/billing-checkout', { method: 'POST', body: '{"plan":"monthly"}' }));
  assert.equal(out.status, 503);
});

// ---- Year pass (one-off yearly payment) ----
import { saveYearPass } from '../api/_lib/stripe.mjs';
import { hasPremium, passRenewable } from '../api/_lib/http.mjs';

// Fakes Clerk's API: returns `user` for GET, records PATCH bodies
function fakeClerk(user) {
  const patches = [];
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method || 'GET') === 'PATCH') { patches.push(JSON.parse(init.body)); return new Response('{}'); }
    return new Response(JSON.stringify(user));
  };
  return patches;
}
const realFetch = globalThis.fetch;
const yearsFromNow = (d, years) => { const x = new Date(d); x.setFullYear(x.getFullYear() + years); return x; };

test('a new year pass gives 12 months of Premium', async () => {
  const patches = fakeClerk({ public_metadata: {}, private_metadata: {} });
  await saveYearPass('user_1', { id: 'cs_1', customer: 'cus_1' });
  const p = patches[0].public_metadata.premium;
  assert.equal(p.pass, true);
  assert.ok(Math.abs(new Date(p.expires) - yearsFromNow(Date.now(), 1)) < 60000);
  assert.equal(patches[0].private_metadata.last_pass_session, 'cs_1');
  globalThis.fetch = realFetch;
});

test('renewing early adds the new year onto the end, and a resent payment is ignored', async () => {
  const ends = new Date(Date.now() + 10 * 86400000).toISOString();
  let patches = fakeClerk({ public_metadata: { premium: { status: 'active', pass: true, expires: ends } }, private_metadata: { last_pass_session: 'cs_1' } });
  await saveYearPass('user_1', { id: 'cs_2', customer: 'cus_1' });
  assert.ok(Math.abs(new Date(patches[0].public_metadata.premium.expires) - yearsFromNow(ends, 1)) < 1000);
  patches = fakeClerk({ public_metadata: { premium: { status: 'active', pass: true, expires: ends } }, private_metadata: { last_pass_session: 'cs_2' } });
  await saveYearPass('user_1', { id: 'cs_2', customer: 'cus_1' });
  assert.equal(patches.length, 0);
  globalThis.fetch = realFetch;
});

test('Premium checks: expired passes end access; renewal opens in the last 30 days', () => {
  const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
  assert.equal(hasPremium({ status: 'active', pass: true, expires: inDays(100) }), true);
  assert.equal(hasPremium({ status: 'active', pass: true, expires: inDays(-1) }), false);
  assert.equal(hasPremium({ status: 'trialing' }), true);
  assert.equal(hasPremium({ status: 'canceled' }), false);
  assert.equal(passRenewable({ pass: true, expires: inDays(100) }), false);
  assert.equal(passRenewable({ pass: true, expires: inDays(20) }), true);
});
