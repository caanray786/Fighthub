// Web Push (phone and browser notifications) without a library.
// - Messages are encrypted for each device (RFC 8291, "aes128gcm").
// - Each request is signed with Fight Hub's VAPID key (RFC 8292), so push
//   services know who is sending. VAPID_PRIVATE_KEY lives in Vercel only.
import { createECDH, createCipheriv, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto';

// Public half of the VAPID key (also in the app's config.js); it is safe to share
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEkxGGoDTa0zdT57y19JIO3oC4QwSITWiMARadiyWeujrLPelOKc5dt9LZJz8Bf4pLOZrJ3HbJ4nCOlJK39oPWI';
const SUBJECT = 'mailto:support@fighthub.world';

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(s, 'base64url');

// Only real push services: subscriptions are member-supplied addresses
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
export const isPushEndpoint = url => typeof url === 'string' && url.length < 1000 && PUSH_HOSTS.test(url);

// Encrypts one message for one device. Returns the request body.
export function encryptPayload(text, p256dh, auth, { salt = randomBytes(16), serverKeys = null } = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('Invalid push subscription keys');
  const ecdh = serverKeys || createECDH('prime256v1');
  if (!serverKeys) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // One record: the message, then the 0x02 "last record" delimiter
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

// "vapid t=<signed token>, k=<public key>" for one push service
export function vapidAuthorization(endpoint, privateKey = process.env.VAPID_PRIVATE_KEY, publicKey = VAPID_PUBLIC_KEY) {
  if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
  const pub = fromB64u(publicKey);
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const part = o => b64u(JSON.stringify(o));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(signature)}, k=${publicKey}`;
}

// Sends one notification. Returns 'sent', 'gone' (remove the subscription) or 'failed'.
export async function sendPush(subscription, message, { ttl = 6 * 3600 } = {}) {
  const { endpoint, keys } = subscription;
  if (!isPushEndpoint(endpoint)) return 'gone';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthorization(endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: 'normal'
      },
      body: encryptPayload(JSON.stringify(message), keys.p256dh, keys.auth)
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) { console.warn(`Push ${res.status}: ${(await res.text()).slice(0, 200)}`); return 'failed'; }
    return 'sent';
  } catch (err) {
    console.warn(`Push failed: ${err.message}`);
    return 'failed';
  }
}
