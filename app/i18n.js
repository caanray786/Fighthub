/* Languages. The app is written in English; other languages are applied to the
   screen as it is drawn, from one dictionary per language:
   assets/lang/<code>.json  { "English text": "Translated text", "Set {0} of {1}": "…" }
   - {0}, {1}… stand for parts that change (numbers, names); each part is
     translated too when the dictionary knows it.
   - Anything inside translate="no" (names, journal notes, coach chats) is left alone.
   - Text the dictionary doesn't know stays in English.
   Run tools/extract-strings.cjs after changing app text to list new text. */

const LANGUAGES = [
  ['en', 'English', 'en-GB'],
  ['es', 'Español', 'es-ES'],
  ['pt', 'Português (Brasil)', 'pt-BR'],
  ['fr', 'Français', 'fr-FR'],
  ['de', 'Deutsch', 'de-DE']
];
const LANG_KEY = 'fight-hub-lang';
const I18N_VERSION = (typeof document !== 'undefined' && document.currentScript?.src.match(/v=(\d+)/) || [])[1] || '1';

const i18n = (() => {
  const codes = LANGUAGES.map(l => l[0]);
  let saved = '';
  try { saved = localStorage.getItem(LANG_KEY) || ''; } catch { /* private mode */ }
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const fromPhone = (nav.languages || [nav.language || 'en']).map(l => String(l).slice(0, 2).toLowerCase()).find(l => codes.includes(l));
  const lang = codes.includes(saved) ? saved : fromPhone || 'en';
  return { lang, dict: null, exact: new Map(), index: new Map(), loose: [], cache: new Map(), loaded: lang === 'en' };
})();

const appLocale = () => (LANGUAGES.find(l => l[0] === i18n.lang) || LANGUAGES[0])[2];
const languageName = code => (LANGUAGES.find(l => l[0] === code) || LANGUAGES[0])[1];
// Monday to Sunday as single letters in the app language (1 January 2024 was a Monday)
const weekdayLetters = () => [1, 2, 3, 4, 5, 6, 7].map(d => new Intl.DateTimeFormat(appLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(Date.UTC(2024, 0, d)));

function setLanguage(code) {
  try { localStorage.setItem(LANG_KEY, code); } catch { /* ignore */ }
  location.reload();
}

/* ---- Looking text up ---- */
const normalise = s => s.replace(/\s+/g, ' ').trim();
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function prepareDictionary(dict) {
  for (const [en, out] of Object.entries(dict)) {
    if (!out || typeof out !== 'string') continue;
    if (!/\{\d+\}/.test(en)) { i18n.exact.set(en, out); continue; }
    // A template: "Set {0}, sprint {1} of 6." becomes a pattern
    const parts = en.split(/(\{\d+\})/);
    const order = [];
    const re = new RegExp('^' + parts.map(p => { const m = p.match(/^\{(\d+)\}$/); if (m) { order.push(Number(m[1])); return '(.+?)'; } return escapeRe(p); }).join('') + '$', 's');
    const entry = { re, order, out, fixed: en.replace(/{d+}/g, '').length };
    const lead = parts[0], tail = parts[parts.length - 1];
    const key = lead.length >= 3 ? 'p:' + lead.slice(0, 3).toLowerCase() : tail.length >= 3 ? 's:' + tail.slice(-3).toLowerCase() : null;
    if (key) { if (!i18n.index.has(key)) i18n.index.set(key, []); i18n.index.get(key).push(entry); } else i18n.loose.push(entry);
  }
  // The most specific pattern first: "Week {0} run" before "Week {0}"
  for (const list of [...i18n.index.values(), i18n.loose]) list.sort((a, b) => b.fixed - a.fixed);
}

function tr(text) {
  if (i18n.lang === 'en' || !i18n.dict || !text) return text;
  const key = normalise(text);
  if (!key || !/[A-Za-z]/.test(key)) return text;
  if (i18n.cache.has(key)) return keepSpaces(text, i18n.cache.get(key));
  let out = i18n.exact.get(key);
  if (out === undefined) {
    const candidates = [...(i18n.index.get('p:' + key.slice(0, 3).toLowerCase()) || []), ...(i18n.index.get('s:' + key.slice(-3).toLowerCase()) || []), ...i18n.loose];
    for (const c of candidates) {
      const m = key.match(c.re);
      if (!m) continue;
      const values = [];
      c.order.forEach((n, i) => { values[n] = m[i + 1]; });
      out = c.out.replace(/\{(\d+)\}/g, (_, n) => { const v = values[Number(n)] ?? ''; return /[A-Za-z]/.test(v) && v !== key ? normalise(tr(v)) : v; });
      break;
    }
  }
  // Pieces joined in code: "Monthly plan · Renews on…", or several sentences in one
  if (out === undefined) out = joined(key, ' · ') ?? joined(key, /(?<=[.!?])\s+(?=[A-Z0-9“"(])/) ?? key;
  if (i18n.cache.size > 5000) i18n.cache.clear();
  i18n.cache.set(key, out);
  return keepSpaces(text, out);
}
function joined(key, sep) {
  const parts = key.split(sep);
  if (parts.length < 2) return undefined;
  const outs = parts.map(p => tr(p));
  if (outs.every((o, i) => o === parts[i])) return undefined;
  return outs.join(typeof sep === 'string' ? sep : ' ');
}

// Keep the spaces around a piece of text, so words don't run together
function keepSpaces(original, out) {
  const lead = original.match(/^\s*/)[0], trail = original.match(/\s*$/)[0];
  return lead + out + trail;
}

/* ---- Translating the screen ---- */
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const shownText = new WeakMap();   // text node -> what we put there
const sourceText = new WeakMap();  // text node -> the English it came from
const sourceAttrs = new WeakMap(); // element -> { attr: English }

const skip = el => !el || el.closest?.('[translate="no"], script, style, textarea, .cl-rootBox, .cl-component');

function translateText(node) {
  if (skip(node.parentElement)) return;
  const now = node.nodeValue;
  if (shownText.get(node) === now) return;   // our own change
  sourceText.set(node, now);
  const out = tr(now);
  shownText.set(node, out);
  if (out !== now) node.nodeValue = out;
}

function translateAttrs(el) {
  if (skip(el)) return;
  let src = sourceAttrs.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const now = el.getAttribute(a);
    if (!src) { src = {}; sourceAttrs.set(el, src); }
    if (src[a] && tr(src[a]) === now) continue; // already ours
    src[a] = now;
    const out = tr(now);
    if (out !== now) el.setAttribute(a, out);
  }
}

function translateTree(root) {
  if (i18n.lang === 'en' || !i18n.dict || !root) return;
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1 || skip(root)) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeType === 3 ? translateText(n) : translateAttrs(n);
}

function startTranslating() {
  translateTree(document.body);
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') translateText(r.target);
      else if (r.type === 'attributes') translateAttrs(r.target);
      else r.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/* ---- Loading the language ---- */
if (typeof document !== 'undefined') document.documentElement.lang = appLocale();
if (typeof document !== 'undefined' && i18n.lang !== 'en') {
  // Hide the screen briefly so English doesn't flash before the dictionary arrives
  document.documentElement.classList.add('i18n-wait');
  const reveal = () => document.documentElement.classList.remove('i18n-wait');
  setTimeout(reveal, 2500);
  fetch(`assets/lang/${i18n.lang}.json?v=${I18N_VERSION}`)
    .then(r => (r.ok ? r.json() : null))
    .then(dict => {
      if (dict) { i18n.dict = dict; prepareDictionary(dict); }
      i18n.loaded = true;
      const go = () => { startTranslating(); reveal(); };
      document.body ? go() : document.addEventListener('DOMContentLoaded', go);
    })
    .catch(() => { i18n.loaded = true; reveal(); });
}

if (typeof module !== 'undefined') module.exports = { tr, prepareDictionary, i18n, normalise };
