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

// ---- Voice coach sessions ----
import { POST as coachSession } from '../api/coach-session.mjs';

test('coach sessions: refused until set up, and for anyone not signed in', async () => {
  delete process.env.ELEVENLABS_API_KEY;
  let res = await coachSession(new Request('https://x/api/coach-session', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 503);
  process.env.ELEVENLABS_API_KEY = 'test';
  process.env.ELEVENLABS_AGENT_ID = 'agent_test';
  res = await coachSession(new Request('https://x/api/coach-session', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 401);
  delete process.env.ELEVENLABS_API_KEY;
});

import { voiceOverrideAllowed } from '../api/coach-session.mjs';

// Fakes the ElevenLabs agent settings: GET returns them, PATCH applies them
function fakeAgent(settings, { patchStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ method, body: init.body && JSON.parse(init.body) });
    if (method === 'PATCH' && patchStatus === 200) settings = JSON.parse(init.body).platform_settings;
    return method === 'PATCH' ? new Response('{}', { status: patchStatus }) : new Response(JSON.stringify({ platform_settings: settings }));
  };
  return calls;
}

test('coach voice: switched on when off, keeping every other agent setting', async () => {
  const calls = fakeAgent({ auth: { enable_auth: true }, overrides: { conversation_config_override: { agent: { first_message: false } } } });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), true);
  const sent = calls.find(c => c.method === 'PATCH').body.platform_settings;
  assert.deepEqual(sent.auth, { enable_auth: true });
  assert.deepEqual(sent.overrides.conversation_config_override, { agent: { first_message: false }, tts: { voice_id: true } });
  globalThis.fetch = realFetch;
});

test('coach voice: already on means nothing is changed; if it cannot be switched on, the default voice is used', async () => {
  let calls = fakeAgent({ overrides: { conversation_config_override: { tts: { voice_id: true } } } });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), true);
  assert.ok(!calls.some(c => c.method === 'PATCH'));
  calls = fakeAgent({}, { patchStatus: 403 });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), false);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), false);
  globalThis.fetch = realFetch;
});

// ---- Deleting an account ----
import { cancelSubscriptions } from '../api/_lib/stripe.mjs';
import { POST as accountClose } from '../api/account-close.mjs';

test('closing an account cancels every running subscription and nothing else', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${url.replace('https://api.stripe.com/v1', '')}`);
    if ((init.method || 'GET') === 'GET') return new Response(JSON.stringify({ data: [
      { id: 'sub_live', status: 'active' }, { id: 'sub_late', status: 'past_due' }, { id: 'sub_old', status: 'canceled' }
    ] }));
    return new Response('{}');
  };
  assert.equal(await cancelSubscriptions('cus_1'), 2);
  assert.deepEqual(calls.slice(1), ['DELETE /subscriptions/sub_live', 'DELETE /subscriptions/sub_late']);
  globalThis.fetch = realFetch;
});

test('closing an account needs the member to be signed in', async () => {
  const res = await accountClose(new Request('https://x/api/account-close', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 401);
});

test('webhook: a deleted member does not make Stripe retry forever', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  globalThis.fetch = async () => new Response('{"errors":[{"code":"resource_not_found"}]}', { status: 404 });
  const body = JSON.stringify({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', customer: 'cus_1', metadata: { clerk_user_id: 'user_gone' } } } });
  const res = await webhook(new Request('https://x/api/stripe-webhook', { method: 'POST', body, headers: { 'stripe-signature': stripeHeader(body, 'whsec_test') } }));
  assert.equal(res.status, 200);
  globalThis.fetch = realFetch;
});

// ---- Refunds ----
import { refundYearPass } from '../api/_lib/stripe.mjs';

test('a refunded year pass takes that year off, ending Premium if nothing is left, once only', async () => {
  const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
  let patches = fakeClerk({ public_metadata: { premium: { status: 'active', pass: true, expires: inDays(360) } }, private_metadata: {} });
  await refundYearPass('user_1', 'cs_9');
  let p = patches[0].public_metadata.premium;
  assert.equal(p.status, 'canceled');
  assert.ok(new Date(p.expires) < new Date());
  assert.deepEqual(patches[0].private_metadata.refunded_passes, ['cs_9']);
  // Renewed early (two years stacked): refunding the renewal leaves the first year
  patches = fakeClerk({ public_metadata: { premium: { status: 'active', pass: true, expires: inDays(380) } }, private_metadata: {} });
  await refundYearPass('user_1', 'cs_10');
  p = patches[0].public_metadata.premium;
  assert.equal(p.status, 'active');
  assert.ok(new Date(p.expires) > new Date());
  // Stripe resending the same refund changes nothing
  patches = fakeClerk({ public_metadata: { premium: p }, private_metadata: { refunded_passes: ['cs_10'] } });
  await refundYearPass('user_1', 'cs_10');
  assert.equal(patches.length, 0);
  globalThis.fetch = realFetch;
});
