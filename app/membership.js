/* UI gates only. Production needs authenticated, server-enforced entitlements. */
let upgradeReason='';
function membershipLock(name){return title('Premium training',name)+`<div class="card feature"><span class="badge">PREMIUM</span><h3>Explore the full training experience</h3><p>Unlock the complete exercise library, home and gym selections, HIIT, flexibility collections and custom session builder.</p>${act('See Premium access','page','premium','primary full')}${act('Continue with free sessions','page','training','full')}</div><p class="small">${window.billingLive?'Start a free trial or subscribe on the Premium page. Cancel any time.':'Early access: Premium can be tried at no charge while subscriptions are being set up. No payment details are taken.'}</p>`;}
function startFree(name,ids){training.active={id:Date.now()+'-starter',name,access:'free-starter',paused:false,phase:'warmup',entries:ids.map(id=>({id,sets:'',reps:'',minutes:'',done:false}))};go('session');}
const beforeMembership=render;
render=function(){
 const blocked=(state.page==='exercise'&&!Membership.canExercise(training.selected,training.premium))||(!training.premium&&['builder','hiit','guided-session'].includes(state.page))||(state.page==='session'&&!Membership.canSession(training.active,training.premium));
 if(blocked){const original=state.page;state.page='membership-locked';beforeMembership();state.page=original;screen.innerHTML=membershipLock(original==='exercise'?ex(training.selected)?.name||'Full exercise library':original==='hiit'?'HIIT collection':original==='builder'?'Custom workout builder':'Premium session');return;}
 beforeMembership();
 if(state.page==='training'){
  screen.querySelectorAll('article.card').forEach((card,i)=>{const t=FightTraining.templates[i];card.querySelector('.badge').textContent=Membership.freeTemplates.includes(t.id)?'FREE STARTER':'PREMIUM';});
  screen.insertAdjacentHTML('afterbegin','<p class="small">Free: 3 fixed starter workouts · Premium: the full collection and customisation.</p>');
 }
 if(state.page==='library')screen.insertAdjacentHTML('afterbegin','<p class="small">12 complete beginner exercises are free. Other entries can be discovered here; their instructions and demonstrations require Premium.</p>');
 if(state.page==='template'){
  const t=FightTraining.templates.find(x=>x.id===training.template);if(t){const free=Membership.freeTemplates.includes(t.id);screen.querySelector('.eyebrow').textContent=free?'Free fixed starter workout':'Premium session preview';const b=screen.querySelector('[data-training="use-template"]');b.textContent=!training.premium&&free?'Start free starter workout':!training.premium?'Explore Premium access':'Use this selection';}
 }
 if(!training.premium&&['setup','plan'].includes(state.page))screen.innerHTML=title('Free guided sample','Try one clear<br>starting session.')+`<p>Try sit-to-stand, wall press-ups and supported calf raises. You need a stable chair and a solid wall. Check each movement is suitable before starting.</p><p>Includes full instructions, images, warm-up, cooldown and a session log. You can repeat this fixed sample.</p><button class="primary full" data-membership="sample">Start free guided sample</button><div class="card"><h3>Want more choice?</h3><p>Equipment/focus matching and the dated weekly plan are included in Premium.</p>${act('Explore Premium','page','premium','full')}</div>`;
 if(state.page==='mobility'){
  screen.querySelector('.badge').textContent='FREE INTRODUCTION + PREMIUM COLLECTIONS';
  const cards=screen.querySelectorAll('article');cards.forEach((card,i)=>{const key=Object.keys(MartialMobility)[i];if(!training.premium){card.querySelector('details').remove();card.querySelector('button').textContent='Explore Premium collection';}card.insertAdjacentHTML('afterbegin','<span class="badge">PREMIUM</span>');});
  screen.insertAdjacentHTML('afterbegin',`<div class="card feature"><span class="badge">FREE</span><h3>Introductory mobility</h3><p>Ankle movement, shoulder rolls and supported sideways leg raises, with complete preparation and instructions. A stable chair is needed.</p><button class="primary full" data-membership="mobility">Start free mobility introduction</button></div>`);
 }
 if(state.page==='premium')screen.innerHTML=title('Fight Hub membership','A taste for free.<br>The full experience in Premium.')+`${upgradeReason?'<p role="status">'+escapeText(upgradeReason)+'</p>':''}<div class="card"><span class="badge">FREE STARTER</span><ul><li>12 beginner exercises with complete instructions and images</li><li>3 fixed starter workouts</li><li>One mobility introduction and one repeatable guided sample</li><li>Record starter sessions and retain access to saved history</li><li>Live fight news and the next fight night in Explore</li></ul>${act('Continue with free sessions','page','training','full')}</div><div class="card feature"><span class="badge">PREMIUM${training.premium?' · ON':''}</span><h3>Your full training collection</h3><ul><li>All 85 exercises and available illustrations</li><li>All 17 home and gym session selections</li><li>25, 30 and 40-minute HIIT sessions at three levels</li><li>Martial-arts mobility and splits-preparation collections</li><li>Custom session building and logging</li><li>Equipment/focus matching and a dated-week preview</li></ul>${act(training.premium?'Return to the free plan':'Try Premium free during early access','toggle-premium','','primary full')}<p class="small">Early access: no payment details are taken and access resets when the app is closed. Subscriptions are coming soon.</p></div><div class="card"><h3>Coming next</h3><p>Professionally reviewed multi-week programmes, performance comparisons, adaptation to goals/time and class-aware scheduling, cloud accounts and secure subscriptions.</p></div><p class="small">Every unlocked workout includes preparation, instructions and easier options. Existing saved history remains readable when Premium is off. Content is still a draft awaiting professional review.</p>`;
};
document.addEventListener('click',e=>{
 const own=e.target.closest('[data-membership]');if(own){e.stopImmediatePropagation();return own.dataset.membership==='sample'?startFree('Free guided sample',Membership.sample):startFree('Free mobility introduction',Membership.freeMobility);}
 if(training.premium)return;
 const t=e.target.closest('[data-training]'),g=e.target.closest('[data-guide]'),m=e.target.closest('[data-mobility]'),h=e.target.closest('[data-hiit]');
 let reason='';
 if(t){const a=t.dataset.training,id=t.dataset.id;
  if(a==='use-template'){e.stopImmediatePropagation();if(Membership.canTemplate(id,false)){const p=FightTraining.templates.find(x=>x.id===id);return startFree(p.name,p.ids);}reason='This workout belongs to the Premium collection.';}
  if(['add','remove','up','start'].includes(a))reason='Create and customise sessions with Premium.';
  if(['exercise','favorite'].includes(a)&&!Membership.canExercise(id,false))reason='This exercise is part of the full Premium library.';
 }
 if(m)reason='The full mobility and splits-preparation collections are Premium.';
 if(g&&['generate','open','resume','swap'].includes(g.dataset.guide))reason='Weekly planning and extended guided training are Premium.';
 if(g?.dataset.guide==='enlarge'&&!Membership.canExercise(g.dataset.id,false)&&!['session','hiit'].includes(state.page))reason='This illustration is part of the Premium library.';
 if(h&&h.dataset.hiit!=='open')reason='The HIIT collection is included in Premium.';
 if(reason){e.preventDefault();e.stopImmediatePropagation();upgradeReason=reason;go('premium');}
},true);
render();
