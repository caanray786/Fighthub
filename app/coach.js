/* Voice coach (Premium): a spoken conversation with Fight Hub's AI coach.
   ElevenLabs does the voice; the coach's "brain" runs on OpenRouter, set up
   in the ElevenLabs agent. The website starts each private session
   (/api/coach-session) and counts it against the monthly allowance.
   The coach is told who the member is, their week, recent journal entries
   and this month's challenge, so it can motivate and keep them accountable. */

const coach = { state: 'idle', conversation: null, transcript: [], message: '', remaining: null, limit: null, loading: null };
const COACH_SDK = 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.26.0/dist/lib.iife.js';

// The voice library is large (about 1 MB), so it loads only when needed
function loadCoachSdk() {
  if (window.ElevenLabsClient) return Promise.resolve(window.ElevenLabsClient);
  coach.loading = coach.loading || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = COACH_SDK;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.ElevenLabsClient);
    s.onerror = () => { coach.loading = null; reject(new Error('The coach could not load. Check your connection.')); };
    document.head.appendChild(s);
  });
  return coach.loading;
}

/* ---- What the coach knows about this member ---- */
function journalLine(e) {
  const art = FightData.arts.find(a => a.id === e.art)?.name;
  const day = dayFrom(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return [day + ': ' + e.type, art, e.minutes && `${e.minutes} min`, e.rounds && `${e.rounds} rounds`, e.rpe && `effort ${e.rpe}/10`, e.did, e.notes && `notes: ${e.notes}`]
    .filter(Boolean).join(', ');
}

function coachContext() {
  const p = account.profile || {};
  const u = window.Clerk?.user;
  const days = trainingDays(), week = weekDays(0), today = isoDay(new Date());
  const done = week.filter(d => days.has(d)).length, streak = goalStreak(days);
  const c = monthChallenge();
  const recent = [...journal.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(journalLine).join('; ');
  const opening = days.has(today) ? 'Good to see you got a session in today. How did it feel?'
    : done >= retention.goal ? 'You’ve already hit your weekly goal. Want to plan a bonus session, or talk recovery?'
    : `You’re ${done} of ${retention.goal} training days into your week. What’s the plan for today?`;
  return {
    name: p.display_name || u?.firstName || 'champ',
    discipline: FightData.arts.find(a => a.id === p.discipline)?.name || 'General fitness',
    goal: p.goal || 'Get fitter',
    level: p.level || 'Beginner',
    week_summary: `${done} of ${retention.goal} training days done this week${streak > 1 ? `; ${streak}-week goal streak` : ''}`,
    recent_journal: (recent || 'Nothing logged yet').slice(0, 1200),
    challenge: `${c.month}: ${c.name}, ${c.done} of ${c.target} done, ${c.daysLeft} days left`,
    today: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    opening
  };
}

/* ---- Start and stop ---- */
async function startCoach() {
  if (coach.state !== 'idle') return;
  coach.state = 'connecting';
  coach.message = '';
  coach.transcript = [];
  render();
  try {
    // Ask for the microphone first, so a refusal gets a clear message
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach(t => t.stop());
    const [sdk, session] = await Promise.all([
      loadCoachSdk(),
      billingCall('/api/coach-session', { voice: account.profile?.coach_voice || 'male' })
    ]);
    coach.remaining = session.remaining;
    coach.limit = session.limit;
    coach.conversation = await sdk.Conversation.startSession({
      signedUrl: session.signedUrl,
      dynamicVariables: coachContext(),
      ...(session.voiceId ? { overrides: { tts: { voiceId: session.voiceId } } } : {}),
      onConnect: () => { coach.state = 'listening'; paintCoach(); },
      onModeChange: ({ mode }) => { coach.state = mode === 'speaking' ? 'speaking' : 'listening'; paintCoach(); },
      onMessage: ({ message, source }) => { if (message) { coach.transcript.push({ who: source === 'ai' ? 'coach' : 'you', text: message }); paintCoach(); } },
      onDisconnect: () => { coach.conversation = null; coach.state = 'idle'; render(); },
      onError: msg => { coach.message = typeof msg === 'string' ? msg : 'The coach had a problem. Please try again.'; paintCoach(); }
    });
  } catch (err) {
    coach.conversation = null;
    coach.state = 'idle';
    coach.message = err?.name === 'NotAllowedError'
      ? 'The coach needs your microphone. Allow it in your browser settings, then try again.'
      : err?.message || 'The coach could not start. Please try again.';
    render();
  }
}

async function stopCoach() {
  try { await coach.conversation?.endSession(); } catch { /* already ended */ }
  coach.conversation = null;
  coach.state = 'idle';
}

/* ---- Screen ---- */
const COACH_STATUS = { idle: 'Tap to talk to your coach', connecting: 'Connecting…', listening: 'Listening: go ahead and talk', speaking: 'Your coach is speaking' };

function coachMarkup() {
  const premium = billing.live ? !!memberPremium() : training.premium;
  if (!premium) {
    return title('Your coach', 'A coach in<br>your pocket.')
      + `<div class="card feature"><span class="badge">PREMIUM</span><h3>Talk it through with your AI coach</h3>
          <p class="small">Your coach knows your discipline, your goal and what you’ve logged this week. Ask about technique, plan your next session, and stay accountable.</p>
          <button class="primary full" data-go="premium">Go Premium</button></div>`;
  }
  const usage = window.Clerk?.user?.publicMetadata?.coachUsage;
  const month = new Date().toISOString().slice(0, 7);
  const limit = coach.limit || usage?.limit;
  const remaining = coach.remaining ?? (usage && limit ? (usage.month === month ? limit - usage.sessions : limit) : null);
  const voice = account.profile?.coach_voice === 'female' ? 'Female' : 'Male';
  const active = coach.state !== 'idle';
  return title('Your coach', 'Talk it<br>through.')
    + `<div class="coach-stage" data-state="${coach.state}">
        <button class="coach-orb" data-coach="${active ? 'stop' : 'start'}" aria-label="${active ? 'End the conversation' : 'Talk to your coach'}">${icon(active ? 'x' : 'mic')}</button>
        <p class="coach-status" id="coach-status" role="status">${COACH_STATUS[coach.state]}</p>
        ${active ? '<button class="full" data-coach="stop">End conversation</button>' : ''}
      </div>
      ${coach.message ? `<p class="status" role="status">${esc(coach.message)}</p>` : ''}
      <div class="coach-transcript" id="coach-transcript">${transcriptMarkup()}</div>
      <p class="small">${remaining !== null && remaining !== undefined ? `${remaining} of ${limit} coach sessions left this month · ` : ''}up to 10 minutes each · ${voice} voice (change it in your profile).</p>
      <details><summary>What can I ask?</summary><ul>
        <li>“What should I train today?”</li><li>“How do I throw a better switch kick?”</li>
        <li>“I missed two sessions this week. Help me get back on track.”</li><li>“How do I recover after hard sparring?”</li></ul></details>
      <p class="draft-note">Your coach is an AI. It gives general training guidance, not medical advice. Your name, goal and recent journal are shared with the coach during the conversation.</p>`;
}

function transcriptMarkup() {
  return coach.transcript.slice(-12).map(m => `<p class="coach-line ${m.who}"><strong>${m.who === 'coach' ? 'Coach' : 'You'}</strong>${esc(m.text)}</p>`).join('');
}

// Update just the live parts while talking (no full redraw)
function paintCoach() {
  const stage = document.querySelector('.coach-stage');
  if (!stage) return;
  stage.dataset.state = coach.state;
  const status = document.getElementById('coach-status');
  if (status) status.textContent = COACH_STATUS[coach.state];
  const t = document.getElementById('coach-transcript');
  if (t) { t.innerHTML = transcriptMarkup(); t.lastElementChild?.scrollIntoView({ block: 'nearest' }); }
  if (coach.message && !stage.nextElementSibling?.classList?.contains('status')) stage.insertAdjacentHTML('afterend', `<p class="status" role="status">${esc(coach.message)}</p>`);
}

const beforeCoach = render;
render = function () {
  // Leaving the coach screen ends the conversation, so minutes are never used by accident
  if (state.page !== 'coach' && coach.conversation) stopCoach();
  beforeCoach();
  if (state.page === 'coach' && !needsSignIn()) screen.innerHTML = coachMarkup();
  // Today: coach prompt and fight news (Explore now lives here)
  if (state.page === 'today' && state.mode !== 'fan' && !screen.querySelector('.coach-today')) {
    const next = feed.events?.[0];
    screen.querySelector('.week-card')?.insertAdjacentHTML('afterend', `<div class="card coach-today"><span class="eyebrow">Your coach</span><h3>Talk through today’s training</h3><button class="full" data-go="coach">${icon('mic')} Talk to your coach</button></div>`);
    screen.insertAdjacentHTML('beforeend', `<div class="card news-today"><span class="eyebrow">Fight news</span><h3>${next ? esc(next.name) : 'The latest from the fight world'}</h3><p class="small">${next ? `Next fight night · ${esc(niceDate(next.date))}` : 'News, fighters and the next fight night.'}</p><button class="full" data-go="explore">Open fight news</button></div>`);
    loadFeed();
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-coach]');
  if (!b) return;
  if (b.dataset.coach === 'start') startCoach();
  if (b.dataset.coach === 'stop') stopCoach().then(render);
});
