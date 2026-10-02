/* Weight and waist: units, display and the weekly trend. The weigh-ins
   themselves stay on the member's phone (body weight is health information). */
const BodyModel = (() => {
  const KG_PER_LB = 0.45359237;
  const CM_PER_IN = 2.54;

  // Units: 'kg' (kilograms and centimetres) or 'st' (stone, pounds and inches)
  const toKg = (units, { kg, st, lb }) => (units === 'st' ? ((Number(st) || 0) * 14 + (Number(lb) || 0)) * KG_PER_LB : Number(kg));
  const toCm = (units, waist) => (units === 'st' ? Number(waist) * CM_PER_IN : Number(waist));
  const validKg = kg => Number.isFinite(kg) && kg >= 30 && kg <= 300;
  const validCm = cm => Number.isFinite(cm) && cm >= 40 && cm <= 250;

  function weight(kg, units) {
    if (units === 'st') { const lb = Math.round(kg / KG_PER_LB); return `${Math.floor(lb / 14)} st ${lb % 14} lb`; }
    return `${(Math.round(kg * 10) / 10).toFixed(1)} kg`;
  }
  function change(kg, units) {
    const sign = kg > 0.05 ? '+' : kg < -0.05 ? '−' : '';
    return sign + (units === 'st' ? `${Math.abs(Math.round(kg / KG_PER_LB))} lb` : `${Math.abs(kg).toFixed(1)} kg`);
  }
  const waist = (cm, units) => (units === 'st' ? `${(cm / CM_PER_IN).toFixed(1)} in` : `${Math.round(cm)} cm`);

  // Kilograms per week over the last five weeks (straight-line fit), or null
  function weeklyTrend(entries, today = new Date()) {
    const day = d => Date.parse(d + 'T12:00:00Z') / 86400000;
    const now = day(today.toISOString().slice(0, 10));
    const recent = entries.filter(e => now - day(e.date) <= 35).sort((a, b) => a.date.localeCompare(b.date));
    if (recent.length < 2 || day(recent[recent.length - 1].date) - day(recent[0].date) < 7) return null;
    const xs = recent.map(e => day(e.date)), ys = recent.map(e => e.kg);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const slope = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0) / xs.reduce((t, x) => t + (x - mx) ** 2, 0);
    return slope * 7;
  }

  // A plain-English note on the pace, for the member's goal
  function paceNote(kgPerWeek, goal) {
    if (kgPerWeek === null) return 'Weigh in once a week, on the same day and at the same time, to see your trend.';
    if (goal === 'Lose weight') {
      if (kgPerWeek < -1) return 'You’re losing faster than the 0.5 to 1 kg a week that’s recommended. Make sure you’re eating enough to train well.';
      if (kgPerWeek <= -0.4) return 'A healthy, steady pace. Keep going.';
      if (kgPerWeek < 0.1) return 'Slow or steady for now. Check your daily steps and portions, and give it a few more weeks.';
      return 'Trending up. Look at portions, sugary drinks and snacks, and keep your sessions going.';
    }
    if (goal === 'Build strength and muscle') {
      if (kgPerWeek > 0.5) return 'Gaining fairly fast. A slower gain, about a quarter to half a kilo a week, keeps it mostly muscle.';
      if (kgPerWeek >= 0.1) return 'A steady gain: good for building muscle alongside your training.';
      return 'Holding steady. To build muscle, eat a little more and keep adding weight to your lifts.';
    }
    if (Math.abs(kgPerWeek) < 0.1) return 'Your weight is steady.';
    const kg = Math.abs(kgPerWeek).toFixed(1);
    return kgPerWeek < 0 ? `Your weight is coming down by about ${kg} kg a week.` : `Your weight is going up by about ${kg} kg a week.`;
  }

  return { toKg, toCm, validKg, validCm, weight, change, waist, weeklyTrend, paceNote };
})();
if (typeof module !== 'undefined') module.exports = BodyModel;
