// Club directory: copies combat sports clubs from OpenStreetMap into the gyms
// table, one region at a time, so visitors search our own fast database
// instead of the (often overloaded) public OpenStreetMap servers.
// Data © OpenStreetMap contributors, ODbL: credited on the clubs page.

import { config } from '../config.js';
import { log } from '../log.js';
import { upsert, getState, setState, getWhere } from '../supabase.js';

const US_STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');

// ISO codes: countries use ISO3166-1, US states ISO3166-2. Biggest audiences first.
export const REGIONS = [
  'GB', 'IE',
  ...US_STATES.map(s => `US-${s}`),
  'CA', 'AU', 'NZ',
  'NL', 'BE', 'DE', 'FR', 'ES', 'PT', 'IT', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'HR', 'RO', 'HU',
  'TH', 'PH', 'JP', 'KR', 'SG', 'MY', 'AE', 'ZA', 'BR', 'MX', 'AR'
];

const REFRESH_DAYS = 30;
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const SPORT_TAGS = 'boxing|mixed_martial_arts|mma|muay_thai|martial_arts|kickboxing|judo|karate|taekwondo|brazilian_jiu-jitsu|jiu-jitsu|jiu_jitsu|bjj|wrestling|sambo|krav_maga|kung_fu|wushu|aikido|capoeira|savate|kendo';
const NAME_WORDS = 'boxing|box club|mma|jiu|jitsu|muay|karate|judo|taekwondo|kickbox|martial|dojo|fight|combat|grappl|wrestl|krav|sambo|kampfsport|boxe|lucha';

// OpenStreetMap sport tags and name keywords -> FightHub styles
const STYLE_RULES = [
  ['Boxing', /\bboxing\b|box(ing)? ?club|\bboxe\b/],
  ['MMA', /mixed_martial_arts|\bmma\b/],
  ['Muay Thai', /muay[ _]?thai/],
  ['Kickboxing', /kick ?box/],
  ['BJJ', /jiu[-_ ]?jitsu|\bbjj\b/],
  ['Wrestling', /wrestl/],
  ['Judo', /\bjudo\b/],
  ['Karate', /karate/],
  ['Taekwondo', /taekwondo|tae kwon do/],
  ['Sambo', /sambo/],
  ['Krav Maga', /krav/],
  ['Kung Fu', /kung[_ ]?fu|wushu/],
  ['Aikido', /aikido/],
  ['Capoeira', /capoeira/]
];

function stylesOf(tags) {
  const text = `${tags.sport || ''} ${tags.name || ''}`.toLowerCase();
  const styles = STYLE_RULES.filter(([, rx]) => rx.test(text)).map(([s]) => s);
  return styles.length ? styles : ['Martial Arts'];
}

function toGym(el, region) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!t.name || lat === undefined || lng === undefined) return null;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  return {
    id: `osm-${el.type[0]}${el.id}`,
    name: t.name.slice(0, 120),
    styles: stylesOf(t),
    address: street,
    city: t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:suburb'] || '',
    state: t['addr:state'] || '',
    zip: t['addr:postcode'] || '',
    country: region.split('-')[0],
    region,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    phone: t.phone || t['contact:phone'] || '',
    email: t.email || t['contact:email'] || '',
    website: t.website || t['contact:website'] || t.url || '',
    openingHours: t.opening_hours || '',
    description: '',
    image: '',
    source: 'OpenStreetMap',
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    lastSeen: new Date().toISOString().slice(0, 10)
  };
}

async function fetchRegion(region) {
  const areaTag = region.includes('-') ? 'ISO3166-2' : 'ISO3166-1';
  const query = `[out:json][timeout:180];
area["${areaTag}"="${region}"]->.a;
(
  nwr["sport"~"${SPORT_TAGS}"](area.a);
  nwr["amenity"="dojo"](area.a);
  nwr["leisure"~"fitness_centre|sports_centre|sports_hall"]["name"~"${NAME_WORDS}",i](area.a);
);
out center tags;`;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const server = SERVERS[attempt % SERVERS.length];
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'User-Agent': config.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(190000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.remark && /error|timed out/i.test(data.remark)) throw new Error(data.remark.slice(0, 100));
      return data.elements || [];
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 15000 * (attempt + 1))); // servers are often busy: back off
    }
  }
  throw lastError;
}

export async function runClubs(state) {
  if (config.maxClubRegionsPerRun <= 0) return;
  const progress = (await getState('club-import').catch(() => null)) || { done: {}, failed: {} };
  const age = region => progress.done[region] ? (Date.now() - new Date(progress.done[region]).getTime()) / 86400000 : Infinity;

  // A region that failed 3 times in a row waits a week before trying again
  const resting = r => {
    const f = progress.failed[r];
    return f && f.count >= 3 && (Date.now() - new Date(f.at).getTime()) < 7 * 86400000;
  };
  // Never-imported regions first (in priority order), then the stalest
  const due = REGIONS.filter(r => age(r) > REFRESH_DAYS && !resting(r)).sort((a, b) => {
    const [aa, ab] = [age(a), age(b)];
    if (aa === Infinity && ab === Infinity) return REGIONS.indexOf(a) - REGIONS.indexOf(b);
    return ab - aa;
  });
  log(`CLUBS: ${REGIONS.length - due.length} of ${REGIONS.length} regions up to date`);

  let imported = 0;
  for (const region of due.slice(0, config.maxClubRegionsPerRun)) {
    if (Date.now() - state.startedAt > config.maxRunMinutes * 60000) break;
    try {
      const elements = await fetchRegion(region);
      const seen = new Set();
      // Keep anything added on FightHub (featured flag, description, photo,
      // owner claim) when refreshing a club from OpenStreetMap
      const existing = new Map((await getWhere('gyms', 'region', region)).map(g => [g.id, g]));
      const KEEP = ['featured', 'description', 'image', 'imageCredit', 'claimedBy', 'styles'];
      const gyms = elements.map(el => toGym(el, region)).filter(g => g && !seen.has(g.id) && seen.add(g.id))
        .map(g => {
          const old = existing.get(g.id);
          if (!old) return g;
          const kept = Object.fromEntries(KEEP.filter(k => old.editedOnFightHub && old[k] !== undefined && old[k] !== '').map(k => [k, old[k]]));
          return { ...g, ...kept, editedOnFightHub: old.editedOnFightHub, createdAt: old.createdAt };
        });
      for (let i = 0; i < gyms.length; i += 500) {
        await upsert('gyms', gyms.slice(i, i + 500));
      }
      progress.done[region] = new Date().toISOString();
      delete progress.failed[region];
      imported += gyms.length;
      log(`  + ${region}: ${gyms.length} clubs`);
    } catch (err) {
      progress.failed[region] = { count: (progress.failed[region]?.count || 0) + 1, at: new Date().toISOString() };
      log(`  ! ${region}: ${err.message}`);
    }
  }
  await setState('club-import', progress).catch(err => log(`  (could not save progress: ${err.message})`));
  state.summary.clubsImported = imported;
}

