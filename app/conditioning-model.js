const ConditioningModel=(()=>{
 const levels={Starter:{work:20,rest:40,label:'Manageable effort · learn the movements'},Build:{work:30,rest:30,label:'Challenging but controlled'},Hard:{work:40,rest:20,label:'Experienced users · vigorous effort'}};
 const circuits={
  'Home foundations':{Starter:['step-jacks','march','squat','wall-press','heel-digs','side-steps','standing-curl','calf'],Build:['star-jacks','squat','kneeling-press','high-knees','reverse-lunge','slow-climber','bridge','step-jacks'],Hard:['star-jacks','burpee','reverse-lunge','push-up','high-knees','mountain-climber','squat','plank-tap']},
  'Military-inspired':{Starter:['step-jacks','squat','wall-press','march','hinge','side-steps','standing-curl','heel-digs'],Build:['star-jacks','step-burpee','kneeling-press','reverse-lunge','slow-climber','squat','high-knees','plank'],Hard:['star-jacks','burpee','hand-release-press','reverse-lunge','mountain-climber','squat-thrust','bear-crawl','plank-up-down']},
  'Quiet / no jumping':{Starter:['march','side-steps','wall-press','squat','heel-digs','standing-curl','step-jacks','calf'],Build:['step-jacks','reverse-lunge','kneeling-press','slow-climber','squat','bridge','plank','side-steps'],Hard:['step-burpee','reverse-lunge','push-up','slow-climber','lateral-lunge','plank-tap','bear-crawl','plank-up-down']}
 };
 const warmup=[{id:'march',seconds:180},{id:'heel-digs',seconds:60},{id:'shoulder-roll',seconds:30},{id:'march',seconds:30},{id:'squat',seconds:60}];
 const cooldown=[{id:'walk',seconds:60},{id:'calf-stretch',seconds:60},{id:'hamstring-stretch',seconds:60},{id:'quad-stretch',seconds:60},{id:'chest-stretch',seconds:60}];
 function build({minutes=25,level='Starter',circuit='Home foundations'}={}){
  if(![25,30,40].includes(minutes)||!levels[level]||!circuits[circuit])throw Error('Choose a listed duration, difficulty and circuit.');
  const ids=circuits[circuit][level],setting=levels[level],count=minutes-11;
  const phases=warmup.map(p=>({...p,kind:'Warm-up',round:0}));
  for(let i=0;i<count;i++){const id=ids[i%ids.length],round=Math.floor(i/ids.length)+1;phases.push({kind:'Work',id,seconds:setting.work,round,station:i+1},{kind:'Recover',id,seconds:setting.rest,round,station:i+1});}
  phases.push(...cooldown.map(p=>({...p,kind:'Cool-down',round:0})));
  return {phases,ids,minutes,level,circuit,count,total:minutes*60,workSeconds:count*setting.work};
 }
 return {levels,circuits,warmup,cooldown,build};
})();
if(typeof module!=='undefined')module.exports=ConditioningModel;
