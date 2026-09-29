let workloadLevel='Starter';
function movementMedia(id){return ExerciseMedia.has(id)?diagram(id):'<p class="small media-pending">Image awaiting correction. Use the machine’s own setup diagram alongside the written steps below.</p>';}
function movementInstructions(id,withImage=true,showWorkload=true){const e=ex(id),info=ExerciseContent.get(id);return `${withImage?movementMedia(id):''}<div class="card"><h3>${escapeText(e.name)}</h3>${showWorkload?`<p class="workload">${ExerciseContent.target(e,workloadLevel)}</p>`:''}<ol>${info.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p class="small">${info.cue}</p><details><summary>Make it easier</summary><p>${info.easy}</p></details></div>`;}
function preparationPage(phase,kind){const warming=phase==='warmup',routine=warming?ConditioningModel.warmup:ConditioningModel.cooldown;
 return title(warming?'Prepare / 6 minutes':'Recover / 5 minutes',warming?'Ease into<br>your session.':'Bring the<br>pace down.')+`<p>${warming?'Start gently, gradually increase your movement, and extend this warm-up if needed. Practise a light or unloaded version of your first strength exercise before its working sets.':'Walk gently, then use mild, comfortable stretches. Hold each stretch for 15–20 seconds per side, release, and use the remaining time to transition. Take longer to recover if needed.'}</p><p class="small">These are untimed guides. Read each movement before beginning; skip or adapt a movement that is unsuitable for you.</p>${routine.map(p=>`<details class="preparation-step"><summary>${ex(p.id).name} · ${p.seconds}s</summary>${movementInstructions(p.id,true,false)}${warming&&p.id==='squat'?'<p>Use shallow knee bends for this warm-up and pause between repetitions.</p>':''}</details>`).join('')}${warming?'<button class="primary full" data-experience="begin" data-kind="'+kind+'">Continue to my exercises</button>':kind==='guided'?gbtn('Save my session log','finish','','primary full'):act('Save my session log','save-log','','primary full')}<p class="small">Continuing does not automatically mark any exercise complete.</p>`;
}
const beforeExperience=render;
render=function(){beforeExperience();
 if(state.page==='exercise'&&ex(training.selected)){
  screen.querySelector('.movement-image')?.remove();
  const overview=screen.querySelector('.card.feature');
  overview.innerHTML=`<h3>How to do it</h3><p>${ex(training.selected).description}</p>`;
  const stretching=['Stretch','Mobility'].includes(ex(training.selected).pattern);
  overview.insertAdjacentHTML('afterend',`${stretching?'':pick('workload-level','Starting workload examples',['Starter','Build','Hard'],workloadLevel)}${movementInstructions(training.selected)}<details><summary>How to progress</summary><p>${ExerciseContent.progressionFor(ex(training.selected))}</p></details>`);
 }
 if(state.page==='session'&&training.active){const a=training.active;a.phase??='warmup';
  if(a.phase!=='main'){screen.innerHTML=preparationPage(a.phase,'custom');return;}
  screen.querySelectorAll('[data-log="sets"]').forEach((input,i)=>{const card=input.closest('.card'),id=a.entries[i].id;card.querySelector('h3').insertAdjacentHTML('afterend',`<details><summary>Instructions, image and starting reps</summary>${movementInstructions(id)}</details>`);
   const fields=card.querySelector('.log-fields');if(['Dumbbells','Dumbbells + bench','Cable machine','Gym machine','Backpack','Water bottles'].includes(ex(id).equipment))fields.insertAdjacentHTML('beforeend',`<label>Load per weight (kg)<input type="number" data-log="load" data-index="${i}" min="0" max="1000" step="0.1" value="${escapeText(a.entries[i].load||'')}"></label>`);
  });
  const finish=screen.querySelector('[data-training="save-log"]');finish.removeAttribute('data-training');finish.dataset.experience='cooldown';finish.dataset.kind='custom';finish.textContent='Finish with cooldown / save';
  screen.insertAdjacentHTML('afterbegin',`${pick('workload-level','Workload examples',['Starter','Build','Hard'],workloadLevel)}<details><summary>How to progress</summary><p>${a.entries.some(x=>ex(x.id).pattern==='Stretch')?ExerciseContent.flexibilityProgression:ExerciseContent.progression}</p></details>`);
 }
 if(state.page==='guided-session'&&guide.active){const a=guide.active;a.phase??='warmup';
  if(a.phase!=='main'){screen.innerHTML=preparationPage(a.phase,'guided');return;}
  screen.querySelector('.card strong').textContent=ExerciseContent.target(ex(a.ids[guide.index]),workloadLevel);
  screen.querySelector('h2').insertAdjacentHTML('afterend',pick('workload-level','Workload examples',['Starter','Build','Hard'],workloadLevel));
  screen.insertAdjacentHTML('beforeend',`<details><summary>How to progress</summary><p>${ExerciseContent.progression}</p></details>`);
  const finish=screen.querySelector('[data-guide="finish"]');finish.removeAttribute('data-guide');finish.dataset.experience='cooldown';finish.dataset.kind='guided';finish.textContent='Finish with cooldown / save';
 }
 if(state.page==='progress')screen.querySelectorAll('.session').forEach((row,i)=>{const h=training.history[i];if(!h)return;const details=row.querySelector('details');for(const entry of h.entries)if(entry.load!==undefined&&entry.load!=='')details.insertAdjacentHTML('beforeend',`<p class="small">${escapeText(ex(entry.id)?.name||entry.id)} · recorded load per weight: ${escapeText(entry.load)} kg</p>`);});
 if(state.page==='hiit'&&hiit.run===null)screen.insertAdjacentHTML('beforeend','<p class="small">Looking for 25+ minutes of interval training itself? Choose 40 minutes: it includes 29 minutes of work/recovery intervals plus preparation and cooldown.</p>');
};
document.addEventListener('click',e=>{if(e.target.closest('[data-guide="enlarge"]')&&state.page==='hiit'&&hiit.run){pauseInterval();render();}const b=e.target.closest('[data-experience]');if(!b)return;const active=b.dataset.kind==='guided'?guide.active:training.active;if(!active)return;active.phase=b.dataset.experience==='begin'?'main':'cooldown';render();screen.scrollTop=0;});
document.addEventListener('change',e=>{if(e.target.id==='workload-level'){workloadLevel=e.target.value;render();}});
render();
