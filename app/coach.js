/* Voice coach (Premium): a spoken conversation with Fight Hub's AI coach.
   ElevenLabs does the voice; the coach's "brain" runs on OpenRouter, set up
   in the ElevenLabs agent. The website starts each private session
   (/api/coach-session) and counts it against the monthly allowance.
   The coach is told who the member is, their week, recent journal entries
   and this month's challenge, so it can motivate and keep them accountable. */

// The member's app language, in words the coach's AI understands
const COACH_LANGUAGES = { en: 'English', es: 'Spanish', pt: 'Brazilian Portuguese', fr: 'French', de: 'German' };
const coach = { state: 'idle', conversation: null, transcript: [], message: '', remaining: null, limit: null, loading: null, maxMinutes: 10, endsAt: 0, clock: null, warned: false };
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

/* ---- Time limit ----
   Each conversation lasts up to maxMinutes (set by the website). In the last
   minute the coach is asked to wrap up; at zero the conversation ends, so
   minutes (and costs) never run on. */
const clockText = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`; };

function startClock() {
  if (coach.clock) return;
  coach.endsAt = Date.now() + coach.maxMinutes * 60000;
  coach.warned = false;
  coach.clock = setInterval(tickCoach, 1000);
  tickCoach();
}

function stopClock() {
  clearInterval(coach.clock);
  coach.clock = null;
  coach.endsAt = 0;
}

function tickCoach() {
  const left = coach.endsAt - Date.now();
  const el = document.getElementById('coach-time');
  if (el) { el.textContent = clockText(left); el.classList.toggle('ending', left < 60000); }
  if (left < 60000 && !coach.warned) {
    coach.warned = true;
    try { coach.conversation?.sendContextualUpdate?.('About one minute of this session is left. Start wrapping up: agree one clear next step and remind them to log their session.'); } catch { /* optional */ }
  }
  if (left <= 0) {
    coach.message = `That was your ${coach.maxMinutes} minutes for this chat. Start another whenever you are ready.`;
    stopCoach().then(render);
  }
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
      billingCall('/api/coach-session', { voice: account.profile?.coach_voice || 'male', lang: i18n.lang })
    ]);
    coach.remaining = session.remaining;
    coach.limit = session.limit;
    coach.maxMinutes = session.maxMinutes || 10;
    coach.conversation = await sdk.Conversation.startSession({
      signedUrl: session.signedUrl,
      dynamicVariables: { ...coachContext(), coach_memory: session.memory || 'No previous conversations yet.', language: COACH_LANGUAGES[i18n.lang] || 'English' },
      overrides: {
        ...(session.voiceId ? { tts: { voiceId: session.voiceId } } : {}),
        // Only sent when the agent has this language under "Additional languages"
        ...(session.language ? { agent: { language: session.language } } : {})
      },
      onConnect: info => { coach.conversationId = info?.conversationId || null; coach.state = 'listening'; startClock(); paintCoach(); },
      onModeChange: ({ mode }) => { coach.state = mode === 'speaking' ? 'speaking' : 'listening'; paintCoach(); },
      onMessage: ({ message, source }) => { if (message) { coach.transcript.push({ who: source === 'ai' ? 'coach' : 'you', text: message }); if (coach.transcript.length > 300) coach.transcript.shift(); paintCoach(); } },
      onDisconnect: () => { stopClock(); rememberConversation(); coach.conversation = null; coach.state = 'idle'; render(); },
      onError: msg => { coach.message = typeof msg === 'string' ? msg : 'The coach had a problem. Please try again.'; paintCoach(); }
    });
  } catch (err) {
    stopClock();
    coach.conversation = null;
    coach.state = 'idle';
    coach.message = err?.name === 'NotAllowedError'
      ? 'The coach needs your microphone. Allow it in your browser settings, then try again.'
      : err?.message || 'The coach could not start. Please try again.';
    render();
  }
}

// Coach memory: tell the website which chat finished, so its summary can be
// collected at the start of the next one
function rememberConversation() {
  const id = coach.conversationId || coach.conversation?.getId?.();
  coach.conversationId = null;
  if (id) billingCall('/api/coach-memory', { conversationId: id }).catch(() => { /* the next chat just won't mention it */ });
}

async function stopCoach() {
  stopClock();
  rememberConversation();
  try { await coach.conversation?.endSession(); } catch { /* already ended */ }
  coach.conversation = null;
  coach.state = 'idle';
}

/* ---- Coach portrait ----
   The round button shows the coach, matching the member's coach voice.
   Portraits are assets/coach/coach-<voice>.webp; a voice without one yet
   shows the microphone. Add a voice here once its file is in place. */
const COACH_PORTRAITS = ['male', 'female'];
const coachVoice = () => (account.profile?.coach_voice === 'female' ? 'female' : 'male');
const coachPortrait = () => (COACH_PORTRAITS.includes(coachVoice()) ? `assets/coach/coach-${coachVoice()}.webp` : '');

function orbMarkup(active) {
  const pic = coachPortrait();
  const attrs = `data-coach="${active ? 'stop' : 'start'}" aria-label="${active ? 'End the conversation' : 'Talk to your coach'}"`;
  return pic
    ? `<button class="coach-orb has-portrait" ${attrs}><img src="${pic}" alt="" width="132" height="132"><span class="coach-orb-badge">${icon(active ? 'x' : 'mic')}</span></button>`
    : `<button class="coach-orb" ${attrs}>${icon(active ? 'x' : 'mic')}</button>`;
}

/* ---- Saved conversations: kept on this phone only ---- */
const CHATS_KEY = 'fight-hub-coach-chats-v1';
function savedChats() {
  try { const list = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
function storeChats(list) {
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch { return false; }
}
const chatWhen = at => new Date(at).toLocaleString(appLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function savedChatsMarkup() {
  const chats = savedChats();
  if (!chats.length) return '';
  return `<h3 class="coach-saved-title">Saved conversations</h3>
    ${chats.map(ch => `<details class="coach-chat"><summary><span>${esc(chatWhen(ch.at))}</span><span class="small">${ch.lines.length} ${ch.lines.length === 1 ? 'message' : 'messages'}</span></summary>
      <div class="coach-transcript">${transcriptMarkup(ch.lines)}</div>
      <button class="full" data-coach="delete-chat" data-id="${esc(ch.id)}">${icon('trash')} Delete this conversation</button></details>`).join('')}
    <p class="small">Saved conversations stay on this phone only.</p>`;
}

/* ---- What the coach remembers ---- */
function memoryMarkup() {
  const n = window.Clerk?.user?.publicMetadata?.coachMemoryCount || 0;
  if (!n) return '';
  const note = n === 1 ? 'Your coach remembers a short summary of your last chat.' : `Your coach remembers a short summary of your last ${n} chats.`;
  return `<p class="small coach-memory">${note} <button class="link-button" data-coach="forget">${n === 1 ? 'Forget it' : 'Forget them'}</button></p>`;
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
  // Whole sentences, so each one can be translated
  const details = [
    ...(remaining !== null && remaining !== undefined ? [`${remaining} of ${limit} coach sessions left this month`] : []),
    `Up to ${coach.maxMinutes} minutes each`,
    account.profile?.coach_voice === 'female' ? 'Female voice (change it in your profile).' : 'Male voice (change it in your profile).'
  ];
  const active = coach.state !== 'idle';
  return title('Your coach', 'Talk it<br>through.')
    + `<div class="coach-stage" data-state="${coach.state}">
        ${orbMarkup(active)}
        <p class="coach-status" id="coach-status" role="status">${COACH_STATUS[coach.state]}</p>
        ${active ? `<p class="coach-time" id="coach-time">${coach.endsAt ? clockText(coach.endsAt - Date.now()) : ''}</p>` : ''}
        ${active ? '<button class="full" data-coach="stop">End conversation</button>' : ''}
      </div>
      ${coach.message ? `<p class="status" role="status">${esc(coach.message)}</p>` : ''}
      <div class="coach-transcript" id="coach-transcript">${transcriptMarkup()}</div>
      ${!active && coach.transcript.length ? `<div class="coach-chat-actions"><button class="primary" data-coach="save">${icon('save')} Save conversation</button><button data-coach="clear">${icon('trash')} Clear</button></div>` : ''}
      <p class="small">${details.join(' · ')}</p>
      <details><summary>What can I ask?</summary><ul>
        <li>“What should I train today?”</li><li>“How do I throw a better switch kick?”</li>
        <li>“I missed two sessions this week. Help me get back on track.”</li><li>“How do I recover after hard sparring?”</li></ul></details>
      ${savedChatsMarkup()}
      ${memoryMarkup()}
      <p class="draft-note">Your coach is an AI. It gives general training guidance, not medical advice. Your name, goal and recent journal are shared with the coach during the conversation, and a short summary of each chat is kept so your coach can follow up next time.</p>`;
}

function transcriptMarkup(lines = coach.transcript) {
  return lines.map(m => `<p class="coach-line ${m.who}"><strong>${m.who === 'coach' ? 'Coach' : 'You'}</strong><span translate="no">${esc(m.text)}</span></p>`).join('');
}

// Update just the live parts while talking (no full redraw)
function paintCoach() {
  const stage = document.querySelector('.coach-stage');
  if (!stage) return;
  stage.dataset.state = coach.state;
  const status = document.getElementById('coach-status');
  if (status) status.textContent = COACH_STATUS[coach.state];
  const t = document.getElementById('coach-transcript');
  if (t) { t.innerHTML = transcriptMarkup(); t.scrollTop = t.scrollHeight; }
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
    screen.querySelector('.week-card')?.insertAdjacentHTML('afterend', `<div class="card coach-today">${coachPortrait() ? `<img class="coach-avatar" src="${coachPortrait()}" alt="" width="56" height="56">` : ''}<span class="eyebrow">Your coach</span><h3>Talk through today’s training</h3><button class="full" data-go="coach">${icon('mic')} Talk to your coach</button></div>`);
    screen.insertAdjacentHTML('beforeend', `<div class="card news-today"><span class="eyebrow">Fight news</span><h3>${next ? esc(next.name) : 'The latest from the fight world'}</h3><p class="small">${next ? `Next fight night · ${esc(niceDate(next.date))}` : 'News, fighters and the next fight night.'}</p><button class="full" data-go="explore">Open fight news</button></div>`);
    loadFeed();
  }
};

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-coach]');
  if (!b) return;
  if (b.dataset.coach === 'start') startCoach();
  if (b.dataset.coach === 'stop') stopCoach().then(render);
  if (b.dataset.coach === 'save') {
    const ok = storeChats([{ id: Date.now().toString(36), at: new Date().toISOString(), voice: coachVoice(), lines: coach.transcript }, ...savedChats()]);
    coach.message = ok ? 'Saved on this phone. You’ll find it under Saved conversations.' : 'This phone has no room to save it. Delete an older conversation and try again.';
    if (ok) coach.transcript = [];
    render();
  }
  if (b.dataset.coach === 'clear') { coach.transcript = []; coach.message = ''; render(); }
  if (b.dataset.coach === 'forget') {
    b.disabled = true;
    try {
      await billingCall('/api/coach-memory', { forget: true });
      await window.Clerk?.user?.reload();
      coach.message = 'Done. Your coach starts fresh next time.';
    } catch (err) {
      coach.message = err.message;
    }
    render();
  }
  if (b.dataset.coach === 'delete-chat') {
    if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = 'Tap again to delete'; return; }
    storeChats(savedChats().filter(ch => ch.id !== b.dataset.id));
    render();
  }
});
