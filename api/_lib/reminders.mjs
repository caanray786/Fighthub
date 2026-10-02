// Training reminders: who is due a reminder right now, and what it says.
// Settings (public metadata, shown in the app): { on, days: [0-6, Sunday = 0], hour, tz, lang }
// Private metadata: { subs: [push subscriptions], last: 'YYYY-MM-DD', week: { start, done, goal } }

export const DEFAULT_REMINDERS = { on: false, days: [1, 3, 5], hour: 18, tz: 'Europe/London' };
export const validTimeZone = tz => {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64; } catch { return false; }
};

// The member's local weekday (Sunday = 0), hour and date
export function localParts(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { weekday, hour: Number(parts.hour), isoDate: `${parts.year}-${parts.month}-${parts.day}` };
}

// Monday of the week containing an ISO date
export function weekStart(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Due once on each chosen day, from the chosen hour (allowing two hours for a late timer)
export function isDue(settings, push, now = new Date()) {
  if (!settings?.on || !push?.subs?.length) return null;
  const parts = localParts(now, validTimeZone(settings.tz) ? settings.tz : DEFAULT_REMINDERS.tz);
  const days = Array.isArray(settings.days) ? settings.days : DEFAULT_REMINDERS.days;
  const hour = Number.isInteger(settings.hour) ? settings.hour : DEFAULT_REMINDERS.hour;
  if (!days.includes(parts.weekday) || parts.hour < hour || parts.hour > hour + 2 || push.last === parts.isoDate) return null;
  return parts;
}

// What reminders say, in the member's app language
export const REMINDER_LANGUAGES = { en: 'en-GB', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE' };
const TEXT = {
  en: {
    champ: 'champ',
    general: [
      ['Time to train', n => `${n}, your session’s waiting. Even 20 minutes keeps the habit going.`],
      ['Gloves on', n => `It’s a training day, ${n}. Your routine is ready when you are.`],
      ['Your corner’s ready', () => 'Get a session in today, then log it in your journal.'],
      ['Show up today', n => `Consistency beats intensity, ${n}. One good session today.`]
    ],
    goalDone: ['Weekly goal done', (n, goal) => `You’ve hit ${goal} sessions this week, ${n}. Fancy a bonus round or some mobility today?`],
    progress: [(done, goal) => `${done} of ${goal} this week`, left => `${left} more ${left === 1 ? 'session' : 'sessions'} to hit your weekly goal. Today’s a good day for one.`],
    test: ['Reminders are on', (days, time) => `We’ll nudge you on ${days} at ${time}.`]
  },
  es: {
    champ: 'crack',
    general: [
      ['Hora de entrenar', n => `${n}, tu sesión te espera. Incluso 20 minutos mantienen el hábito.`],
      ['Guantes puestos', n => `Hoy toca entrenar, ${n}. Tu rutina está lista cuando tú lo estés.`],
      ['Tu esquina está lista', () => 'Haz una sesión hoy y luego regístrala en tu diario.'],
      ['Preséntate hoy', n => `La constancia gana a la intensidad, ${n}. Una buena sesión hoy.`]
    ],
    goalDone: ['Objetivo semanal cumplido', (n, goal) => `Has hecho ${goal} sesiones esta semana, ${n}. ¿Te apetece una ronda extra o algo de movilidad hoy?`],
    progress: [(done, goal) => `${done} de ${goal} esta semana`, left => `${left === 1 ? 'Te falta 1 sesión' : `Te faltan ${left} sesiones`} para tu objetivo semanal. Hoy es un buen día para una.`],
    test: ['Recordatorios activados', (days, time) => `Te avisaremos los ${days} a las ${time}.`]
  },
  pt: {
    champ: 'atleta',
    general: [
      ['Hora de treinar', n => `${n}, seu treino está esperando. Até 20 minutos mantêm o hábito.`],
      ['Luvas nas mãos', n => `Hoje é dia de treino, ${n}. Sua rotina está pronta quando você estiver.`],
      ['Seu córner está pronto', () => 'Faça um treino hoje e depois registre no seu diário.'],
      ['Apareça hoje', n => `Constância vence intensidade, ${n}. Um bom treino hoje.`]
    ],
    goalDone: ['Meta semanal cumprida', (n, goal) => `Você fez ${goal} treinos nesta semana, ${n}. Que tal um round extra ou um pouco de mobilidade hoje?`],
    progress: [(done, goal) => `${done} de ${goal} nesta semana`, left => `${left === 1 ? 'Falta 1 treino' : `Faltam ${left} treinos`} para sua meta semanal. Hoje é um bom dia para um.`],
    test: ['Lembretes ativados', (days, time) => `Vamos te lembrar às ${time} nestes dias: ${days}.`]
  },
  fr: {
    champ: 'champion',
    general: [
      ['C’est l’heure de s’entraîner', n => `${n}, ta séance t’attend. Même 20 minutes suffisent pour garder l’habitude.`],
      ['Mets les gants', n => `C’est jour d’entraînement, ${n}. Ta routine est prête quand tu l’es.`],
      ['Ton coin est prêt', () => 'Fais une séance aujourd’hui, puis note-la dans ton journal.'],
      ['Sois là aujourd’hui', n => `La régularité bat l’intensité, ${n}. Une bonne séance aujourd’hui.`]
    ],
    goalDone: ['Objectif de la semaine atteint', (n, goal) => `Tu as fait ${goal} séances cette semaine, ${n}. Un round bonus ou un peu de mobilité aujourd’hui ?`],
    progress: [(done, goal) => `${done} sur ${goal} cette semaine`, left => `Encore ${left} ${left === 1 ? 'séance' : 'séances'} pour atteindre ton objectif de la semaine. Aujourd’hui, c’est le bon jour.`],
    test: ['Rappels activés', (days, time) => `On te fera signe le ${days} à ${time}.`]
  },
  de: {
    champ: 'Champ',
    general: [
      ['Zeit zu trainieren', n => `${n}, deine Einheit wartet. Schon 20 Minuten halten die Gewohnheit am Leben.`],
      ['Handschuhe an', n => `Heute ist Trainingstag, ${n}. Deine Routine ist bereit, wenn du es bist.`],
      ['Deine Ecke ist bereit', () => 'Mach heute eine Einheit und trag sie dann in dein Tagebuch ein.'],
      ['Heute zählt', n => `Beständigkeit schlägt Intensität, ${n}. Heute eine gute Einheit.`]
    ],
    goalDone: ['Wochenziel geschafft', (n, goal) => `Du hast diese Woche ${goal} Einheiten geschafft, ${n}. Lust auf eine Bonusrunde oder etwas Mobilität heute?`],
    progress: [(done, goal) => `${done} von ${goal} diese Woche`, left => `Noch ${left} ${left === 1 ? 'Einheit' : 'Einheiten'} bis zu deinem Wochenziel. Heute ist ein guter Tag dafür.`],
    test: ['Erinnerungen sind an', (days, time) => `Wir erinnern dich jeweils ${days} um ${time} Uhr.`]
  }
};
const textFor = lang => TEXT[lang] || TEXT.en;

export function reminderMessage(name, push, parts, lang = 'en') {
  const t = textFor(lang);
  const n = (name || '').trim() || t.champ;
  const week = push?.week;
  const base = { url: '/app/', tag: 'training-reminder' };
  if (week && week.start === weekStart(parts.isoDate) && week.goal > 0) {
    if (week.done >= week.goal) return { ...base, title: t.goalDone[0], body: t.goalDone[1](n, week.goal) };
    return { ...base, title: t.progress[0](week.done, week.goal), body: t.progress[1](week.goal - week.done) };
  }
  const dayOfYear = Math.floor((Date.parse(parts.isoDate) - Date.parse(parts.isoDate.slice(0, 4) + '-01-01')) / 86400000);
  const [title, body] = t.general[dayOfYear % t.general.length];
  return { ...base, title, body: body(n) };
}

// "Reminders are on": the chosen days and time, e.g. "Mon, Wed, Fri at 6pm"
export function testMessage(settings) {
  const lang = TEXT[settings.lang] ? settings.lang : 'en';
  // 4 January 2026 was a Sunday, so day d falls on the (4 + d)th
  const dayName = d => lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
    : new Intl.DateTimeFormat(REMINDER_LANGUAGES[lang], { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 0, 4 + d));
  const h = settings.hour;
  const time = lang === 'en' ? `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}` : `${String(h).padStart(2, '0')}:00`;
  const [title, body] = textFor(lang).test;
  return { title, body: body(settings.days.map(dayName).join(', '), time), url: '/app/', tag: 'training-reminder' };
}
