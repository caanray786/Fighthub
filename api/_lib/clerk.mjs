// Checks who is calling (their Clerk sign-in token) and reads or updates their
// Clerk account. Uses CLERK_SECRET_KEY from Vercel for the account updates.
import { createPublicKey, verify } from 'node:crypto';
import { httpError } from './http.mjs';

// Test instance now; the live instance on fighthub.world once it is switched on
const ISSUERS = (process.env.CLERK_ISSUERS || 'https://amused-anchovy-2720.clerk.accounts.dev,https://clerk.fighthub.world')
  .split(',').map(s => s.trim()).filter(Boolean);
const PARTIES = ['https://www.fighthub.world', 'https://fighthub.world', 'https://fighthub-swart.vercel.app'];

const keyCache = new Map(); // issuer -> { keys, at }

async function signingKeys(issuer) {
  const cached = keyCache.get(issuer);
  if (cached && Date.now() - cached.at < 3600_000) return cached.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`Clerk keys ${res.status}`);
  const keys = (await res.json()).keys || [];
  keyCache.set(issuer, { keys, at: Date.now() });
  return keys;
}

const decodePart = part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

// Returns { id } for a valid signed-in member, or throws 401
export async function memberFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 3) throw httpError(401, 'Please sign in first.');
  let header, payload;
  try { header = decodePart(parts[0]); payload = decodePart(parts[1]); } catch { throw httpError(401, 'Please sign in again.'); }
  const now = Date.now() / 1000;
  if (header.alg !== 'RS256' || !ISSUERS.includes(payload.iss)) throw httpError(401, 'Please sign in again.');
  if (!payload.exp || payload.exp < now - 10 || (payload.nbf && payload.nbf > now + 10)) throw httpError(401, 'Your sign-in has expired. Please try again.');
  if (payload.azp && !PARTIES.includes(payload.azp)) throw httpError(401, 'Please sign in again.');
  const jwk = (await signingKeys(payload.iss)).find(k => k.kid === header.kid);
  if (!jwk) throw httpError(401, 'Please sign in again.');
  const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok || !payload.sub) throw httpError(401, 'Please sign in again.');
  return { id: payload.sub };
}

async function clerkApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = new Error(`Clerk ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status; // 404: the member has deleted their account
    throw err;
  }
  return res.json();
}

export const getClerkUser = id => clerkApi(`/users/${encodeURIComponent(id)}`);

// One page of members, newest first (for scheduled jobs such as reminders)
export const listClerkUsers = (offset = 0, limit = 100) => clerkApi(`/users?limit=${limit}&offset=${offset}&order_by=-created_at`);

// A member's recent sign-ins; each has latest_activity with the country Clerk saw
export const listUserSessions = id => clerkApi(`/sessions?user_id=${encodeURIComponent(id)}&limit=10`);

// Merges into the member's Clerk metadata (public: readable by the app; private: server only)
export const updateClerkMetadata = (id, metadata) =>
  clerkApi(`/users/${encodeURIComponent(id)}/metadata`, { method: 'PATCH', body: metadata });

export function primaryEmail(user) {
  const primary = (user.email_addresses || []).find(e => e.id === user.primary_email_address_id);
  return primary?.email_address || user.email_addresses?.[0]?.email_address || '';
}
