import { createHash } from 'node:crypto';

export function shortHash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

export function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// Name key for matching fighters regardless of accents, case and punctuation
export function nameKey(name) {
  return slugify(name).replace(/-/g, '');
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ').trim();
}
