/* Exercise details return to their entry screen, including nested alternatives. */
const ExerciseNavigation=(()=>{
 const labels={hiit:'Back to HIIT · Build your engine', 'routine-session':'Back to planned session',session:'Back to my workout',mobility:'Back to martial arts mobility',template:'Back to session selection',library:'Back to exercise library',training:'Back to training library'};
 function origin(page){return {page:labels[page]?page:'library',label:labels[page]||labels.library};}
 return {origin};
})();
if(typeof module!=='undefined')module.exports=ExerciseNavigation;
if(typeof document!=='undefined'){
 let exerciseReturn=ExerciseNavigation.origin('library');
 const beforeExerciseGo=go;
 go=function(page){
  if(page==='exercise'&&state.page!=='exercise')exerciseReturn=ExerciseNavigation.origin(state.page);
  if(state.page==='hiit'&&page!=='hiit')pauseInterval();
  return beforeExerciseGo(page);
 };
 const beforeExerciseNavigation=render;
 render=function(){beforeExerciseNavigation();if(state.page!=='exercise')return;
  screen.querySelector('[data-training="page"][data-id="library"]')?.remove();
  screen.insertAdjacentHTML('afterbegin',`<button class="full" data-exercise-return>${escapeText(exerciseReturn.label)}</button>`);
 };
 document.addEventListener('click',e=>{if(e.target.closest('[data-exercise-return]'))go(exerciseReturn.page);});
 render();
}
