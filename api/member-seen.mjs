// POST /api/member-seen: a signed-in member has opened the app (at most once a
// day per phone). Notes the country their connection comes from, using Vercel's
// x-vercel-ip-country header, on their Clerk account for the admin portal's
// Members page. Only the country is kept: no IP address, city or exact location.
import { json, handle } from './_lib/http.mjs';
import { memberFromRequest, getClerkUser, updateClerkMetadata } from './_lib/clerk.mjs';

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
