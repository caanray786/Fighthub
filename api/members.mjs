// /api/members: Fight Hub members, in one function (Vercel allows 12 per site).
//
// GET (admin portal, admins only): everyone who has signed up, for the Members
// page. Country: where the member's connection came from when they last opened
// the app (POST below). For members who have not opened it since that was
// added, the country Clerk saw at their latest sign-in is used once and saved.
//
// POST (a signed-in member, from the app at most once a day per phone): notes
// the country their connection comes from, using Vercel's x-vercel-ip-country
// header. Only the country is kept: no IP address, city or exact location.
import { json, handle, hasPremium } from './_lib/http.mjs';
import { requireAdmin } from './_lib/admin.mjs';
import { memberFromRequest, getClerkUser, listClerkUsers, listUserSessions, updateClerkMetadata, primaryEmail } from './_lib/clerk.mjs';

const DAY = 86400000;
const LOOKUPS_PER_REQUEST = 40; // sign-in lookups for members with no country yet

const iso = ms => (ms ? new Date(ms).toISOString() : null);

export function signInMethod(user) {
  const providers = (user.external_accounts || []).map(a => String(a.provider || a.object || ''));
  if (providers.some(p => p.includes('google'))) return 'Google';
  if (providers.some(p => p.includes('apple'))) return 'Apple';
  return 'Email';
}

export function premiumLabel(p) {
  if (!p?.status) return 'Free';
  if (p.status === 'paused') return 'Paused';
  if (!hasPremium(p)) return p.status === 'canceled' ? 'Cancelled' : 'Free';
  if (p.status === 'trialing') return 'Free trial';
  return p.pass ? 'Year pass' : 'Monthly';
}

export function toMember(user, invitedBy = '') {
  const loc = user.private_metadata?.location || {};
  const p = user.public_metadata?.premium;
  return {
    id: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    email: primaryEmail(user),
    joined: iso(user.created_at),
    lastActive: iso(user.last_active_at || user.last_sign_in_at),
    method: signInMethod(user),
    country: loc.country || '',
    firstCountry: loc.first || '',
    premium: hasPremium(p),
    plan: premiumLabel(p),
    invitedBy
  };
}

export function summarise(members, now = Date.now()) {
  const since = days => members.filter(m => m.joined && now - Date.parse(m.joined) < days * DAY).length;
  const countries = {};
  for (const m of members) if (m.country) countries[m.country] = (countries[m.country] || 0) + 1;
  const methods = {};
  for (const m of members) methods[m.method] = (methods[m.method] || 0) + 1;
  // Sign-ups on each of the last 30 days, oldest first
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now - (29 - i) * DAY).toISOString().slice(0, 10);
    return { day, count: members.filter(m => m.joined?.slice(0, 10) === day).length };
  });
  return {
    total: members.length,
    last7: since(7),
    last30: since(30),
    premium: members.filter(m => m.premium).length,
    countries: Object.entries(countries).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    noCountry: members.filter(m => !m.country).length,
    methods,
    daily
  };
}

// Country from the member's most recent sign-in, if Clerk recorded one
async function signInCountry(user) {
  const res = await listUserSessions(user.id).catch(() => null);
  const sessions = Array.isArray(res) ? res : res?.data || [];
  const latest = sessions
    .filter(s => s.latest_activity?.country)
    .sort((a, b) => (b.updated_at || b.last_active_at || 0) - (a.updated_at || a.last_active_at || 0))[0];
  const code = String(latest?.latest_activity?.country || '').toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

export async function GET(request) {
  return handle(async () => {
    await requireAdmin(request);
    const users = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await listClerkUsers(offset, 100);
      if (!Array.isArray(page) || !page.length) break;
      users.push(...page);
      if (page.length < 100) break;
    }

    // Members with no country yet: look up their latest sign-in (a few at a time) and keep it
    const missing = users.filter(u => !u.private_metadata?.location?.country).slice(0, LOOKUPS_PER_REQUEST);
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(missing.slice(i, i + 5).map(async u => {
        const country = await signInCountry(u);
        if (!country) return;
        const location = { country, first: country, at: new Date().toISOString(), firstAt: iso(u.created_at), source: 'sign-in' };
        u.private_metadata = { ...(u.private_metadata || {}), location };
        await updateClerkMetadata(u.id, { private_metadata: { location } }).catch(() => {});
      }));
    }

    // Who invited whom (from each inviter's list of friends who joined)
    const invitedBy = new Map();
    for (const u of users) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || primaryEmail(u);
      for (const friend of u.private_metadata?.referredFriends || []) invitedBy.set(friend, name);
    }

    const members = users.map(u => toMember(u, invitedBy.get(u.id) || ''));
    return json({ members, summary: summarise(members), updated: new Date().toISOString() }, 200, { 'Cache-Control': 'no-store' });
  });
}

// ---- The country a member connects from ----
export function countryFrom(request) {
  const code = (request.headers.get('x-vercel-ip-country') || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : '';
}

// { country: latest, first: the country they joined from, at, firstAt, source }
export function nextLocation(previous, country, now = new Date()) {
  const seen = previous || {};
  if (!country || (seen.country === country && seen.first && seen.source === 'app')) return null;
  const at = now.toISOString();
  return { country, at, first: seen.first || country, firstAt: seen.firstAt || at, source: 'app' };
}

export async function POST(request) {
  return handle(async () => {
    const member = await memberFromRequest(request);
    const country = countryFrom(request);
    if (!country) return json({ ok: true, country: '' });
    const user = await getClerkUser(member.id);
    const location = nextLocation(user.private_metadata?.location, country);
    if (location) await updateClerkMetadata(member.id, { private_metadata: { location } });
    return json({ ok: true, country });
  });
}
