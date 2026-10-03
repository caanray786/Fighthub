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

import { voiceOverrideAllowed, coachAgentSettings, agentLanguage, voiceProblem } from '../api/coach-session.mjs';

// Fakes the ElevenLabs agent settings: GET returns them, PATCH applies them
function fakeAgent(settings, { patchStatus = 200, conversation = {} } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ method, body: init.body && JSON.parse(init.body) });
    if (method === 'PATCH' && patchStatus === 200) settings = JSON.parse(init.body).platform_settings;
    return method === 'PATCH' ? new Response('{}', { status: patchStatus }) : new Response(JSON.stringify({ platform_settings: settings, conversation_config: conversation }));
  };
  return calls;
}

test('coach voice: switched on when off, keeping every other agent setting', async () => {
  const calls = fakeAgent({ auth: { enable_auth: true }, overrides: { conversation_config_override: { agent: { first_message: false } } } });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), true);
  const sent = calls.find(c => c.method === 'PATCH').body.platform_settings;
  assert.deepEqual(sent.auth, { enable_auth: true });
  assert.deepEqual(sent.overrides.conversation_config_override, { agent: { first_message: false, language: true }, tts: { voice_id: true } });
  globalThis.fetch = realFetch;
});

test('coach voice: already on means nothing is changed; if it cannot be switched on, the default voice is used', async () => {
  let calls = fakeAgent({ overrides: { conversation_config_override: { tts: { voice_id: true }, agent: { language: true } } } });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), true);
  assert.ok(!calls.some(c => c.method === 'PATCH'));
  calls = fakeAgent({}, { patchStatus: 403 });
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), false);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await voiceOverrideAllowed('k', 'a', { fresh: true }), false);
  globalThis.fetch = realFetch;
});

test('coach language: only languages the agent has been given are used', async () => {
  fakeAgent({}, { conversation: { agent: { language: 'en' }, language_presets: { es: {}, 'pt-br': {}, fr: {} } } });
  const info = await coachAgentSettings('k', 'a', { fresh: true });
  assert.deepEqual(info.languages, ['en', 'es', 'pt-br', 'fr']);
  assert.equal(agentLanguage(info, 'es'), 'es');
  assert.equal(agentLanguage(info, 'pt'), 'pt-br');
  assert.equal(agentLanguage(info, 'de'), '', 'German not added to the agent yet');
  assert.equal(agentLanguage(info, 'en'), '');
  assert.equal(agentLanguage({ ...info, language: false }, 'es'), '', 'override switched off');
  globalThis.fetch = realFetch;
});

test('coach voice: the reason a chosen voice cannot be used is reported', async () => {
  fakeAgent({ overrides: { conversation_config_override: { tts: { voice_id: true }, agent: { language: true } } } },
    { conversation: { language_presets: { fr: { overrides: { tts: { voice_id: 'frenchMan' } } }, es: { overrides: {} } } } });
  const info = await coachAgentSettings('k', 'a', { fresh: true });
  assert.deepEqual(info.languageVoices, { fr: 'frenchMan' });
  assert.equal(voiceProblem(info, 'woman', ''), '');
  assert.equal(voiceProblem(info, 'woman', 'es'), '');
  assert.equal(voiceProblem(info, 'woman', 'fr'), 'language-voice');
  assert.equal(voiceProblem(info, '', ''), 'not-set');
  assert.equal(voiceProblem({ ...info, voice: false }, 'woman', ''), 'override-off');
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

// ---- Checkout on accounts with Stripe Managed Payments on by default ----
import { createCheckoutSession } from '../api/_lib/stripe.mjs';

test('checkout retries with Managed Payments off when Stripe asks for product tax codes', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const bodies = [];
  globalThis.fetch = async (url, init = {}) => {
    bodies.push(String(init.body));
    return bodies.length === 1
      ? new Response(JSON.stringify({ error: { message: "Invalid line_items[0]: The product's tax code is missing. Product tax code is required for managed payments, which is enabled by default on your account." } }), { status: 400 })
      : new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test' }));
  };
  const session = await createCheckoutSession({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }] });
  assert.equal(session.url, 'https://checkout.stripe.com/c/pay/cs_test');
  assert.ok(!bodies[0].includes('managed_payments'));
  assert.ok(decodeURIComponent(bodies[1]).includes('managed_payments[enabled]=false'));
  // Any other refusal is passed on unchanged
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'No such price' } }), { status: 400 });
  await assert.rejects(createCheckoutSession({ mode: 'payment' }), /No such price/);
  globalThis.fetch = realFetch;
  delete process.env.STRIPE_SECRET_KEY;
});

// ---- Voice coach: ElevenLabs refusals are explained ----
import { getSignedUrl } from '../api/coach-session.mjs';

test('coach: a refused conversation passes on ElevenLabs\' reason', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }), { status: 401 });
  await assert.rejects(getSignedUrl('k', 'agent_x'), err => err.status === 502 && err.message === 'Voice service: Invalid API key');
  globalThis.fetch = async () => new Response(JSON.stringify({ signed_url: 'wss://example/conv' }));
  assert.equal(await getSignedUrl('k', 'agent_x'), 'wss://example/conv');
  globalThis.fetch = realFetch;
});

// ---- Pause instead of cancel ----
import { addMonths, pausePlan, saveSubscription } from '../api/_lib/stripe.mjs';

test('pause: months are added on calendar dates, keeping to the end of short months', () => {
  const t = iso => Math.floor(Date.parse(iso) / 1000);
  assert.equal(addMonths(t('2026-10-15T09:00:00Z'), 1), t('2026-11-15T09:00:00Z'));
  assert.equal(addMonths(t('2026-01-31T09:00:00Z'), 1), t('2026-02-28T09:00:00Z'));
  assert.equal(addMonths(t('2026-11-30T09:00:00Z'), 3), t('2027-02-28T09:00:00Z'));
  const plan = pausePlan({ current_period_end: t('2026-10-15T09:00:00Z') }, 2);
  assert.equal(plan.paidUntil, t('2026-10-15T09:00:00Z'));
  assert.equal(plan.resumesAt, t('2026-12-15T08:00:00Z')); // an hour before the renewal that ends the pause
});

test('pause: Premium stays on for the month paid for, then is off until it resumes', async () => {
  const day = 86400;
  const now = Math.floor(Date.now() / 1000);
  const sub = paidUntil => ({ id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: now + 40 * day,
    pause_collection: { behavior: 'void', resumes_at: now + 60 * day }, metadata: { paid_until: String(paidUntil) },
    items: { data: [{ price: { id: 'price_m' } }] } });
  let patches = fakeClerk({ public_metadata: {}, private_metadata: {} });
  await saveSubscription('user_1', sub(now + 10 * day));
  let p = patches[0].public_metadata.premium;
  assert.equal(p.status, 'paused');
  assert.ok(p.resumes);
  assert.equal(hasPremium(p), true); // still inside the paid month
  patches = fakeClerk({ public_metadata: {}, private_metadata: {} });
  await saveSubscription('user_1', sub(now - day));
  p = patches[0].public_metadata.premium;
  assert.equal(hasPremium(p), false); // paid month over, pause running
  // Resumed: Stripe clears the pause and Premium is active again
  patches = fakeClerk({ public_metadata: { premium: p }, private_metadata: {} });
  await saveSubscription('user_1', { ...sub(0), pause_collection: null, metadata: {} });
  p = patches[0].public_metadata.premium;
  assert.equal(p.status, 'active');
  assert.equal(p.paidUntil, null);
  assert.equal(hasPremium(p), true);
  globalThis.fetch = realFetch;
});

test('pause endpoint needs sign-in', async () => {
  const { POST } = await import('../api/billing-pause.mjs');
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.STRIPE_PRICE_MONTHLY = 'price_m'; process.env.CLERK_SECRET_KEY = 'sk_test_c';
  const res = await POST(new Request('https://x/api/billing-pause', { method: 'POST', body: '{"action":"pause","months":1}' }));
  assert.equal(res.status, 401);
  delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_PRICE_MONTHLY; delete process.env.CLERK_SECRET_KEY;
});

// ---- Training reminders ----
import { localParts, weekStart, isDue, reminderMessage, testMessage } from '../api/_lib/reminders.mjs';

test('reminders: local time follows the member\'s time zone, including summer time', () => {
  assert.deepEqual(localParts(new Date('2026-07-01T17:30:00Z'), 'Europe/London'), { weekday: 3, hour: 18, isoDate: '2026-07-01' });
  assert.deepEqual(localParts(new Date('2026-12-02T18:30:00Z'), 'Europe/London'), { weekday: 3, hour: 18, isoDate: '2026-12-02' });
  assert.equal(localParts(new Date('2026-07-01T23:30:00Z'), 'Asia/Dubai').isoDate, '2026-07-02');
  assert.equal(weekStart('2026-10-04'), '2026-09-28'); // Sunday belongs to the week starting Monday
});

test('reminders: due once on chosen days from the chosen hour, never twice a day', () => {
  const settings = { on: true, days: [3], hour: 18, tz: 'Europe/London' };
  const push = { subs: [{ endpoint: 'https://fcm.googleapis.com/x', keys: {} }] };
  const at = iso => new Date(iso);
  assert.ok(isDue(settings, push, at('2026-07-01T17:05:00Z')));            // Wed 18:05 BST
  assert.ok(isDue(settings, push, at('2026-07-01T19:05:00Z')));            // late timer, still today
  assert.equal(isDue(settings, push, at('2026-07-01T16:05:00Z')), null);   // too early
  assert.equal(isDue(settings, push, at('2026-07-02T17:05:00Z')), null);   // Thursday
  assert.equal(isDue(settings, { ...push, last: '2026-07-01' }, at('2026-07-01T18:05:00Z')), null); // already sent
  assert.equal(isDue({ ...settings, on: false }, push, at('2026-07-01T17:05:00Z')), null);
  assert.equal(isDue(settings, { subs: [] }, at('2026-07-01T17:05:00Z')), null);
});

test('reminders: messages use weekly progress when the app has sent it', () => {
  const parts = { weekday: 3, hour: 18, isoDate: '2026-07-01' };
  assert.match(reminderMessage('Sam', { week: { start: '2026-06-29', done: 1, goal: 3 } }, parts).body, /2 more sessions/);
  assert.equal(reminderMessage('Sam', { week: { start: '2026-06-29', done: 3, goal: 3 } }, parts).title, 'Weekly goal done');
  const general = reminderMessage('Sam', { week: { start: '2026-06-22', done: 3, goal: 3 } }, parts); // last week's numbers are ignored
  assert.ok(general.title && general.body && !/goal done/.test(general.title));
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(general)), 'no emojis');
});

test('reminders: written in the member’s app language, English otherwise', () => {
  const parts = { weekday: 3, hour: 18, isoDate: '2026-07-01' };
  assert.match(reminderMessage('Sam', { week: { start: '2026-06-29', done: 1, goal: 3 } }, parts, 'es').body, /Te faltan 2 sesiones/);
  assert.equal(reminderMessage('Sam', { week: { start: '2026-06-29', done: 3, goal: 3 } }, parts, 'de').title, 'Wochenziel geschafft');
  assert.equal(reminderMessage('Sam', { week: { start: '2026-06-29', done: 3, goal: 3 } }, parts, 'xx').title, 'Weekly goal done');
  assert.equal(testMessage({ days: [1, 3, 5], hour: 18 }).body, 'We’ll nudge you on Mon, Wed, Fri at 6pm.');
  const fr = testMessage({ days: [1, 3, 5], hour: 18, lang: 'fr' });
  assert.equal(fr.title, 'Rappels activés');
  assert.match(fr.body, /lun\.?, mer\.?, ven\.? à 18:00/);
});

test('reminders: an hourly run sends to due members only and records it', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  process.env.VAPID_PRIVATE_KEY = privateKey.export({ format: 'jwk' }).d;
  process.env.CLERK_SECRET_KEY = 'sk_test_c';
  const ua = (await import('node:crypto')).createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(now));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(now));
  const users = [
    { id: 'user_due', first_name: 'Sam', public_metadata: { reminders: { on: true, days: [day], hour, tz: 'Europe/London' } }, private_metadata: { push: { subs: [sub] } } },
    { id: 'user_other_day', public_metadata: { reminders: { on: true, days: [(day + 1) % 7], hour, tz: 'Europe/London' } }, private_metadata: { push: { subs: [sub] } } },
    { id: 'user_off', public_metadata: {}, private_metadata: {} }
  ];
  const pushed = [], patched = [];
  globalThis.fetch = async (url, init = {}) => {
    if (url.startsWith('https://api.clerk.com/v1/users?')) return new Response(JSON.stringify(users));
    if (url.startsWith('https://fcm.googleapis.com/')) { pushed.push(init.headers.Authorization.slice(0, 8)); return new Response('', { status: 201 }); }
    if (init.method === 'PATCH') { patched.push([url, JSON.parse(init.body)]); return new Response('{}'); }
    return new Response('{}', { status: 404 });
  };
  const { POST } = await import('../api/reminders-run.mjs');
  const out = await (await POST()).json();
  assert.deepEqual(out, { checked: 3, sent: 1, removed: 0 });
  assert.deepEqual(pushed, ['vapid t=']);
  assert.match(patched[0][0], /user_due/);
  assert.equal(patched[0][1].private_metadata.push.last.length, 10);
  globalThis.fetch = realFetch;
  delete process.env.VAPID_PRIVATE_KEY; delete process.env.CLERK_SECRET_KEY;
});

test('reminders settings: refused until set up, and for anyone not signed in', async () => {
  const { POST } = await import('../api/reminders.mjs');
  let res = await POST(new Request('https://x/api/reminders', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 503);
  process.env.VAPID_PRIVATE_KEY = 'x';
  res = await POST(new Request('https://x/api/reminders', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 401);
  delete process.env.VAPID_PRIVATE_KEY;
});

// ---- Coach memory ----
import { resolveMemory, memoryText } from '../api/_lib/coach-memory.mjs';

test('coach memory: finished chats become summaries, unfinished ones wait, others are dropped', async () => {
  const conversations = {
    conv_done_1: { agent_id: 'agent_x', status: 'done', metadata: { start_time_unix_secs: 1790000000 }, analysis: { transcript_summary: 'Worked on the switch kick; agreed two shadow rounds on Thursday.' } },
    conv_busy_2: { agent_id: 'agent_x', status: 'processing' },
    conv_other_3: { agent_id: 'agent_someone_else', status: 'done', analysis: { transcript_summary: 'Not ours' } }
  };
  globalThis.fetch = async url => {
    const id = url.split('/').pop();
    return conversations[id] ? new Response(JSON.stringify(conversations[id])) : new Response('{}', { status: 404 });
  };
  const old = [1, 2, 3].map(n => ({ at: `2026-09-0${n}T10:00:00.000Z`, text: `Older chat ${n}` }));
  const m = await resolveMemory('k', 'agent_x', { items: old, pending: ['conv_done_1', 'conv_busy_2', 'conv_other_3', 'conv_missing_4'] });
  assert.deepEqual(m.pending, ['conv_busy_2']);
  assert.equal(m.items.length, 3); // only the 3 most recent are kept
  assert.match(m.items[2].text, /switch kick/);
  assert.match(memoryText(m.items), /^[A-Z][a-z]{2} \d+ [A-Z][a-z]{2,3}: Older chat 2 \| /);
  assert.equal(memoryText([]), 'No previous conversations yet.');
  globalThis.fetch = realFetch;
});

test('coach memory endpoint needs sign-in', async () => {
  const { POST } = await import('../api/coach-memory.mjs');
  const res = await POST(new Request('https://x/api/coach-memory', { method: 'POST', body: '{"conversationId":"conv_abcdefgh"}' }));
  assert.equal(res.status, 401);
});

// ---- Refer a friend ----
import { validReferrer, rewardReferrer, ensureFriendCoupon } from '../api/_lib/referrals.mjs';

test('referrals: invites work for new members only, never your own', async () => {
  process.env.CLERK_SECRET_KEY = 'sk_test_c';
  globalThis.fetch = async url => url.includes('user_ghost000000') ? new Response('{}', { status: 404 }) : new Response(JSON.stringify({ id: 'user_x' }));
  const member = { id: 'user_friend00001' };
  const newUser = { private_metadata: {} };
  assert.equal(await validReferrer('inviter000001', member, newUser), 'user_inviter000001');
  assert.equal(await validReferrer('friend00001', member, newUser), null);            // own link
  assert.equal(await validReferrer('ghost000000', member, newUser), null);            // unknown member
  assert.equal(await validReferrer('bad id!', member, newUser), null);
  assert.equal(await validReferrer('inviter000001', member, { private_metadata: { stripe_subscription_id: 'sub_old' } }), null); // not new
  globalThis.fetch = realFetch;
});

function fakeStripeAndClerk({ invoice, referrer }) {
  const log = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    log.push(`${method} ${url.replace(/^https:\/\/api\.(stripe|clerk)\.com\/v1/, '')}${init.body && method !== 'GET' ? ' ' + init.body : ''}`);
    if (url.includes('/invoices/')) return new Response(JSON.stringify(invoice));
    if (url.includes('api.clerk.com') && method === 'GET') return new Response(JSON.stringify(referrer));
    if (url.endsWith('/customers') && method === 'POST') return new Response(JSON.stringify({ id: 'cus_new' }));
    return new Response('{}');
  };
  return log;
}

test('referrals: a free month only after the friend\'s first paid month, and only once', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.CLERK_SECRET_KEY = 'sk_test_c';
  const sub = { id: 'sub_f', status: 'active', latest_invoice: 'in_1', metadata: { referrer: 'user_inviter' } };
  // First month was free: nothing yet
  let log = fakeStripeAndClerk({ invoice: { status: 'paid', amount_paid: 0 }, referrer: {} });
  assert.equal(await rewardReferrer(sub), 'not-yet');
  // Paid month: a month's credit for a monthly member
  log = fakeStripeAndClerk({ invoice: { status: 'paid', amount_paid: 1999 }, referrer: { public_metadata: { premium: { status: 'active' } }, private_metadata: { stripe_customer_id: 'cus_inv' } } });
  assert.equal(await rewardReferrer(sub), 'credited');
  assert.ok(log.some(l => l.startsWith('POST /subscriptions/sub_f') && l.includes('referral_rewarded')));
  assert.ok(log.some(l => l.startsWith('POST /customers/cus_inv/balance_transactions') && l.includes('amount=-1999')));
  // Already rewarded: never twice
  assert.equal(await rewardReferrer({ ...sub, metadata: { ...sub.metadata, referral_rewarded: '1' } }), 'skip');
  globalThis.fetch = realFetch;
});

test('referrals: a year pass gets one more month instead', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.CLERK_SECRET_KEY = 'sk_test_c';
  const expires = new Date(Date.now() + 100 * 86400000);
  const log = fakeStripeAndClerk({ invoice: { status: 'paid', amount_paid: 1999 }, referrer: { public_metadata: { premium: { status: 'active', pass: true, expires: expires.toISOString() } }, private_metadata: {} } });
  assert.equal(await rewardReferrer({ id: 'sub_f', status: 'active', latest_invoice: 'in_2', metadata: { referrer: 'user_inviter' } }), 'pass-extended');
  const patch = JSON.parse(log.find(l => l.startsWith('PATCH')).replace(/^PATCH \S+ /, ''));
  const added = new Date(patch.public_metadata.premium.expires) - expires;
  assert.ok(added > 27 * 86400000 && added < 32 * 86400000);
  assert.equal(patch.public_metadata.referrals.earned, 1);
  globalThis.fetch = realFetch;
});

test('referrals: the first-month-free coupon is created when missing', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${url.replace('https://api.stripe.com/v1', '')}`);
    return (init.method || 'GET') === 'GET'
      ? new Response(JSON.stringify({ error: { message: "No such coupon: 'fighthub-friend-month'" } }), { status: 404 })
      : new Response('{}');
  };
  assert.equal(await ensureFriendCoupon(), 'fighthub-friend-month');
  assert.deepEqual(calls, ['GET /coupons/fighthub-friend-month', 'POST /coupons']);
  globalThis.fetch = realFetch;
  delete process.env.STRIPE_SECRET_KEY; delete process.env.CLERK_SECRET_KEY;
});

// ---- Coach voice check ----
import { GET as coachVoices } from '../api/coach-voices.mjs';

test('coach voices: names, genders and per-language voices are reported', async () => {
  process.env.ELEVENLABS_API_KEY = 'k'; process.env.ELEVENLABS_AGENT_ID = 'a';
  process.env.ELEVENLABS_VOICE_MALE = 'maleVoice0000000001A'; process.env.ELEVENLABS_VOICE_FEMALE = 'maleVoice0000000002B';
  const voices = { maleVoice0000000001A: { name: 'Brian', labels: { gender: 'male', accent: 'american' } }, maleVoice0000000002B: { name: 'Daniel', labels: { gender: 'male', accent: 'british' } }, defaultVoice00000003: { name: 'Eric', labels: { gender: 'male' } } };
  globalThis.fetch = async url => {
    if (url.includes('/convai/agents/')) return new Response(JSON.stringify({ conversation_config: { tts: { voice_id: 'defaultVoice00000003', model_id: 'eleven_flash_v2_5' }, language_presets: { fr: { overrides: { tts: { voice_id: 'missingVoice00000004' } } } } }, platform_settings: { overrides: { conversation_config_override: { tts: { voice_id: true } } } } }));
    const id = decodeURIComponent(url.split('/voices/')[1]);
    return voices[id] ? new Response(JSON.stringify(voices[id])) : new Response('{"detail":"not found"}', { status: 404 });
  };
  const body = await (await coachVoices()).json();
  assert.equal(body.female.name, 'Daniel');
  assert.equal(body.female.gender, 'male', 'a male voice set as the female one shows up');
  assert.equal(body.agentDefault.name, 'Eric');
  assert.match(body.languageVoices.fr.problem, /No voice/);
  assert.deepEqual(body.agentLanguages, ['en', 'fr']);
  assert.equal(body.appMayChooseVoice, true);
  globalThis.fetch = realFetch;
  for (const k of ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_VOICE_MALE', 'ELEVENLABS_VOICE_FEMALE']) delete process.env[k];
});

test('coach voice: a setting that is not a voice ID counts as not set', async () => {
  const { looksLikeVoiceId } = await import('../api/coach-session.mjs');
  assert.equal(looksLikeVoiceId('lUTamkMw7gOzZbFIwmq4'), true);
  assert.equal(looksLikeVoiceId('ELEVENLABS_VOICE_FEMALE'), false);
  assert.equal(looksLikeVoiceId(''), false);
  assert.equal(looksLikeVoiceId('voice id with spaces'), false);
});

// ---- Admin portal: members ----
import { GET as adminMembers, summarise, premiumLabel } from '../api/admin-members.mjs';
import { countryFrom, nextLocation } from '../api/member-seen.mjs';

function fakeServices({ admin = true, sessionsCountry = 'IE' } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body && JSON.parse(init.body) });
    if (url.includes('/rpc/is_admin')) {
      if (admin === 'expired') return new Response('{"message":"JWT expired"}', { status: 401 });
      return new Response(JSON.stringify(admin));
    }
    if (url.includes('/v1/users?')) return new Response(JSON.stringify(url.includes('offset=0') ? [
      { id: 'user_a', first_name: 'Sam', last_name: 'Lee', created_at: Date.now() - 2 * 86400000, last_active_at: Date.now(), primary_email_address_id: 'e1', email_addresses: [{ id: 'e1', email_address: 'sam@example.com' }], external_accounts: [{ provider: 'oauth_google' }], public_metadata: { premium: { status: 'active', plan: 'monthly' } }, private_metadata: { location: { country: 'GB', first: 'GB' }, referredFriends: ['user_b'] } },
      { id: 'user_b', first_name: 'Ana', created_at: Date.now() - 40 * 86400000, primary_email_address_id: 'e2', email_addresses: [{ id: 'e2', email_address: 'ana@example.com' }], public_metadata: {}, private_metadata: {} }
    ] : []));
    if (url.includes('/v1/sessions?')) return new Response(JSON.stringify(sessionsCountry ? [{ updated_at: 1, latest_activity: { country: sessionsCountry, city: 'Dublin' } }] : []));
    if (url.includes('/metadata')) return new Response('{}');
    return new Response('{}', { status: 404 });
  };
  return calls;
}
const adminRequest = (token = 'admin-token') => new Request('https://x/api/admin-members', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('admin members: only signed-in administrators get the list', async () => {
  fakeServices();
  assert.equal((await adminMembers(adminRequest(''))).status, 401);
  fakeServices({ admin: false });
  assert.equal((await adminMembers(adminRequest())).status, 403);
  fakeServices({ admin: 'expired' });
  assert.equal((await adminMembers(adminRequest())).status, 401);
  globalThis.fetch = realFetch;
});

test('admin members: who joined, from where, how, and who invited them', async () => {
  const calls = fakeServices();
  const res = await adminMembers(adminRequest());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { members, summary } = await res.json();
  const sam = members.find(m => m.id === 'user_a'), ana = members.find(m => m.id === 'user_b');
  assert.deepEqual([sam.name, sam.email, sam.country, sam.method, sam.plan, sam.premium], ['Sam Lee', 'sam@example.com', 'GB', 'Google', 'Monthly', true]);
  assert.deepEqual([ana.country, ana.method, ana.plan, ana.invitedBy], ['IE', 'Email', 'Free', 'Sam Lee']);
  // Ana's country came from her latest sign-in and is saved, without the city
  const saved = calls.find(c => c.url.includes('/users/user_b/metadata'));
  assert.equal(saved.body.private_metadata.location.country, 'IE');
  assert.ok(!JSON.stringify(saved.body).includes('Dublin'));
  assert.ok(!calls.some(c => c.url.includes('/sessions?user_id=user_a')), 'no lookup when the country is known');
  assert.deepEqual([summary.total, summary.last7, summary.last30, summary.premium], [2, 1, 1, 1]);
  assert.deepEqual(summary.countries, [{ code: 'GB', count: 1 }, { code: 'IE', count: 1 }]);
  assert.equal(summary.daily.length, 30);
  globalThis.fetch = realFetch;
});

test('member seen: the country from the connection, kept only when it changes', () => {
  const req = code => new Request('https://x/api/member-seen', { method: 'POST', headers: code ? { 'x-vercel-ip-country': code } : {} });
  assert.equal(countryFrom(req('gb')), 'GB');
  assert.equal(countryFrom(req('XX')), '');
  assert.equal(countryFrom(req('')), '');
  const now = new Date('2026-10-03T12:00:00Z');
  const first = nextLocation(null, 'GB', now);
  assert.deepEqual(first, { country: 'GB', at: now.toISOString(), first: 'GB', firstAt: now.toISOString(), source: 'app' });
  assert.equal(nextLocation(first, 'GB', now), null, 'same country: nothing to save');
  const moved = nextLocation(first, 'ES', now);
  assert.equal(moved.country, 'ES');
  assert.equal(moved.first, 'GB', 'the country they joined from is kept');
  assert.equal(premiumLabel({ status: 'trialing' }), 'Free trial');
  assert.equal(premiumLabel({ status: 'active', pass: true, expires: new Date(Date.now() + 864e5).toISOString() }), 'Year pass');
  assert.equal(summarise([]).total, 0);
});
