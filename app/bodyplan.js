/* Weight loss and muscle building:
   - "Weight and waist": weekly weigh-ins with a trend, kept on this phone only.
   - "Eat to train": general healthy-eating basics (NHS-style), no diets or plans.
   - Today: a plan card for members whose goal is losing weight or building muscle. */

const BODY_KEY = 'fight-hub-body-v1';
const body = { message: '' };

function bodyData() {
  try {
    const d = JSON.parse(localStorage.getItem(BODY_KEY) || '{}');
    return { units: d.units === 'st' ? 'st' : 'kg', entries: Array.isArray(d.entries) ? d.entries : [] };
  } catch { return { units: 'kg', entries: [] }; }
}
function saveBody(d) {
  try { localStorage.setItem(BODY_KEY, JSON.stringify(d)); return true; } catch { return false; }
}
const memberGoal = () => account.profile?.goal || '';

function bodyChart(entries, units) {
  const pts = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  if (pts.length < 2) return '';
  const w = 320, h = 120, pad = 14;
  const min = Math.min(...pts.map(p => p.kg)), max = Math.max(...pts.map(p => p.kg));
  const span = Math.max(max - min, 1);
  const xy = pts.map((p, i) => [pad + (i * (w - 2 * pad)) / (pts.length - 1), h - pad - ((p.kg - min) / span) * (h - 2 * pad)]);
  const short = d => dayFrom(d).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
  return `<svg class="body-chart" viewBox="0 0 ${w} ${h + 18}" role="img" aria-label="Weight from ${BodyModel.weight(pts[0].kg, units)} to ${BodyModel.weight(pts[pts.length - 1].kg, units)}">
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#f14b55" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#f14b55"/>`).join('')}
    <text x="${pad}" y="${h + 14}" class="body-chart-label">${short(pts[0].date)}</text>
    <text x="${w - pad}" y="${h + 14}" text-anchor="end" class="body-chart-label">${short(pts[pts.length - 1].date)}</text>
  </svg>`;
}

function bodyMarkup() {
  const d = bodyData(), u = d.units;
  const list = [...d.entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = list[0], first = list[list.length - 1];
  const trend = BodyModel.weeklyTrend(d.entries);
  const summary = latest
    ? `<div class="card feature"><span class="eyebrow">Latest · ${esc(dayFrom(latest.date).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long' }))}</span>
        <h3>${BodyModel.weight(latest.kg, u)}${latest.waistCm ? ` · waist ${BodyModel.waist(latest.waistCm, u)}` : ''}</h3>
        ${list.length > 1 ? `<p class="small">${BodyModel.change(latest.kg - first.kg, u)} since ${esc(dayFrom(first.date).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }))}${trend !== null ? ` · about ${BodyModel.change(trend, u)} a week lately` : ''}</p>` : ''}
        <p class="small">${esc(BodyModel.paceNote(trend, memberGoal()))}</p>
        ${bodyChart(d.entries, u)}</div>`
    : '<div class="card feature"><h3>Start with today’s weigh-in</h3><p class="small">Weigh yourself once a week, on the same day and at the same time (for example, Monday morning). Your trend matters, not day-to-day ups and downs.</p></div>';
  const weightFields = u === 'st'
    ? `<div class="field-row"><label class="field">Stone<input type="number" id="body-st" inputmode="numeric" min="4" max="45" step="1"></label><label class="field">Pounds<input type="number" id="body-lb" inputmode="decimal" min="0" max="13.9" step="0.5"></label></div>`
    : '<label class="field">Weight (kg)<input type="number" id="body-kg" inputmode="decimal" min="30" max="300" step="0.1"></label>';
  return title('Weight and waist', 'Your<br>weigh-ins.')
    + (body.message ? `<p class="status" role="status">${esc(body.message)}</p>` : '')
    + summary
    + `<div class="card journal-form"><h3>Add a weigh-in</h3>
        <label class="field">Date<input type="date" id="body-date" value="${isoDay(new Date())}" max="${isoDay(new Date())}"></label>
        ${weightFields}
        <label class="field">Waist (${u === 'st' ? 'inches' : 'cm'}, optional)<input type="number" id="body-waist" inputmode="decimal" step="0.5"></label>
        <button class="primary full" data-body="save">${icon('save')} Save weigh-in</button>
        <label class="field">Units<select id="body-units"><option value="kg" ${u === 'kg' ? 'selected' : ''}>Kilograms and centimetres</option><option value="st" ${u === 'st' ? 'selected' : ''}>Stone, pounds and inches</option></select></label>
      </div>`
    + (list.length ? `<h3>Your weigh-ins</h3><div class="body-list">${list.slice(0, 20).map(e => `<div class="body-row"><span>${esc(dayFrom(e.date).toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric', month: 'short' }))}</span><strong>${BodyModel.weight(e.kg, u)}</strong><span class="small">${e.waistCm ? BodyModel.waist(e.waistCm, u) : ''}</span><button class="link-button" data-body="delete" data-id="${esc(e.id)}" aria-label="Delete this weigh-in">${icon('x')}</button></div>`).join('')}</div>` : '')
    + `<div class="row-buttons"><button data-go="nutrition">${icon('heart')} Eat to train</button><button data-plan="fat-loss">Fat loss programme</button></div>
      <p class="draft-note">Your weigh-ins stay on this phone only; they are not sent to Fight Hub. If you have, or have had, an eating disorder, or you have a medical condition, talk to your GP before trying to change your weight.</p>`;
}

function nutritionMarkup() {
  const card = (h, items) => `<div class="card"><h3>${h}</h3><ul class="plain-list">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  return title('Eat to train', 'Food that fuels<br>your training.')
    + '<p>Simple, general guidance for most healthy adults. No diets, no meal plans: just habits that work.</p>'
    + card('Build every plate the same way', [
      'Half the plate vegetables or salad, with fruit through the day.',
      'A palm-sized portion of protein at every meal: fish, eggs, chicken, beans, lentils, tofu or Greek yoghurt.',
      'Wholegrain carbs to fuel training: oats, rice, potatoes, wholemeal bread or pasta.',
      'A little healthy fat: olive oil, nuts or seeds.'])
    + card('Drink enough', [
      'The NHS suggests 6 to 8 glasses of fluid a day, more when you train or it’s hot.',
      'Water, milk and sugar-free drinks all count. Pale-straw urine is a good sign.'])
    + card('Losing weight', [
      'Eat a little less than you burn, every day, rather than starving yourself. About 0.5 to 1 kg a week is the safe pace the NHS recommends.',
      'Keep protein at every meal so you keep your muscle.',
      'Cut back on sugary drinks, alcohol and snack foods first.',
      `Not sure where to start? Use the <a href="${SITE_URL}/training.html#calories" target="_blank" rel="noopener">calorie calculator</a> on our website.`])
    + card('Building muscle', [
      'Eat a little more than you burn, with protein at every meal.',
      'Train progressively: add a rep or a little weight when it gets easier.',
      'Sleep 7 to 9 hours. It’s when your body recovers and builds.'])
    + card('Around training', [
      'Have a meal 2 to 3 hours before, or a light snack about an hour before.',
      'Afterwards, a meal with protein and carbs helps you recover.'])
    + `<div class="row-buttons"><button data-go="body">${icon('chart')} Track your weight</button><button data-plan="fat-loss">Fat loss programme</button></div>
      <button class="full" data-plan="muscle">Build muscle routine</button>
      <p class="draft-note">No crash diets, sauna suits or sweating weight off: fighters’ weight cuts need specialist supervision. We don’t cover supplements or personal diet plans. If you have a medical condition, are pregnant, or have (or have had) an eating disorder, speak to your GP or a registered dietitian.</p>`;
}

// Today: a plan card for weight-loss and muscle goals
function goalPlanMarkup(goal) {
  if (goal === 'Lose weight') {
    return `<div class="card goal-plan"><span class="eyebrow">Your plan</span><h3>Lose weight the fighter’s way</h3>
      <p class="small">Fight Fit fat loss: three sessions a week and a daily step target, with a weekly weigh-in to see your trend.</p>
      <button class="primary full" data-plan="fat-loss">Open the programme</button>
      <div class="row-buttons"><button data-go="body">${icon('chart')} Weigh-ins</button><button data-go="nutrition">${icon('heart')} Eat to train</button></div></div>`;
  }
  if (goal === 'Build strength and muscle') {
    return `<div class="card goal-plan"><span class="eyebrow">Your plan</span><h3>Build muscle</h3>
      <p class="small">A Build muscle routine: upper body, lower body and full body, three days a week, in the gym or at home.</p>
      <button class="primary full" data-plan="muscle">Set up the routine</button>
      <div class="row-buttons"><button data-go="body">${icon('chart')} Weigh-ins</button><button data-go="nutrition">${icon('heart')} Eat to train</button></div></div>`;
  }
  return '';
}

const beforeBodyPlan = render;
render = function () {
  beforeBodyPlan();
  if (needsSignIn()) return;
  if (state.page === 'body') screen.innerHTML = bodyMarkup();
  if (state.page === 'nutrition') screen.innerHTML = nutritionMarkup();
  if (state.page === 'today' && state.mode !== 'fan' && !screen.querySelector('.goal-plan')) {
    const plan = goalPlanMarkup(memberGoal());
    if (plan) screen.querySelector('.week-card')?.insertAdjacentHTML('afterend', plan);
  }
  if (state.page === 'journal' && !screen.querySelector('.journal-body')) {
    (screen.querySelector('.journal-achievements') || screen.querySelector('.journal-chart'))?.insertAdjacentHTML('afterend', `<button class="full journal-body" data-go="body">${icon('chart')} Weight and waist</button>`);
  }
  if (state.page === 'training' && !screen.querySelector('.train-nutrition')) {
    screen.insertAdjacentHTML('beforeend', `<button class="full train-nutrition" data-go="nutrition">${icon('heart')} Eat to train: food basics</button>`);
  }
};

document.addEventListener('change', e => {
  if (e.target.id !== 'body-units') return;
  const d = bodyData();
  d.units = e.target.value === 'st' ? 'st' : 'kg';
  saveBody(d);
  body.message = '';
  render();
});

document.addEventListener('click', e => {
  const plan = e.target.closest('[data-plan]');
  if (plan) {
    if (plan.dataset.plan === 'fat-loss') { fight.programme = 'fat-loss'; fight.week = 1; return go('fight-programme'); }
    if (plan.dataset.plan === 'muscle') { routine.draft.split = 'muscle'; return go('setup'); }
  }
  const b = e.target.closest('[data-body]');
  if (!b) return;
  const d = bodyData();
  if (b.dataset.body === 'delete') {
    d.entries = d.entries.filter(x => x.id !== b.dataset.id);
    saveBody(d);
    body.message = 'Weigh-in deleted.';
    return render();
  }
  const val = id => document.getElementById(id)?.value ?? '';
  const kg = BodyModel.toKg(d.units, { kg: val('body-kg'), st: val('body-st'), lb: val('body-lb') });
  const waistRaw = val('body-waist');
  const waistCm = waistRaw === '' ? null : BodyModel.toCm(d.units, waistRaw);
  const date = val('body-date') || isoDay(new Date());
  if (!BodyModel.validKg(kg)) { body.message = 'Enter your weight first.'; return render(); }
  if (waistCm !== null && !BodyModel.validCm(waistCm)) { body.message = 'That waist measurement doesn’t look right.'; return render(); }
  // One weigh-in per day: a second one replaces the first
  d.entries = [...d.entries.filter(x => x.date !== date), { id: Date.now().toString(36), date, kg: Math.round(kg * 100) / 100, waistCm: waistCm === null ? null : Math.round(waistCm * 10) / 10 }];
  body.message = saveBody(d) ? 'Saved.' : 'This phone has no room to save it.';
  render();
});
