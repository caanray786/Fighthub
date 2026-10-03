// Admin-only endpoints: the caller must be signed in to the admin portal
// (Supabase) and listed in public.admins. Supabase's own is_admin() function
// checks both, using the admin's sign-in token, so no extra secret is needed.
import { httpError } from './http.mjs';

// The public project address and publishable key (the same ones in js/config.js)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewfuhrlgdivwtdremkdv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_j9JDQxPwdCHhrw93Wn3j-Q_BKVpTCk1';

export async function requireAdmin(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw httpError(401, 'Please sign in to the admin portal.');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (res.status === 401) throw httpError(401, 'Your admin session has expired. Please sign in again.');
  const isAdmin = res.ok && (await res.json().catch(() => false)) === true;
  if (!isAdmin) throw httpError(403, 'Only administrators can see this.');
}
