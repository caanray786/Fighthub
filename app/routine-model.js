const RoutineModel=(()=>{
 const banks={
  Gym:{split:[['Push','Chest, shoulders & triceps',['chest-machine','shoulder-press','lateral-raise','triceps']],['Pull','Back, biceps & forearms',['lat-pull','cable-row','biceps-curl','hammer-curl']],['Legs','Quads, hamstrings, glutes & calves',['leg-press','rdl','bridge','seated-calf']]],full:[['Full body A','Legs, chest, back & core',['leg-press','chest-machine','cable-row','dead-bug']],['Full body B','Hips, shoulders, back & core',['rdl','shoulder-press','lat-pull','bird-dog']],['Full body C','Legs, chest, back & arms',['goblet','floor-press','cable-row','hammer-curl']]]},
  Home:{split:[['Push','Chest, shoulders & triceps',['floor-press','lateral-raise','wall-press']],['Pull','Back, biceps & forearms',['band-row','biceps-curl','hammer-curl']],['Legs','Quads, hamstrings, glutes & calves',['goblet','rdl','bridge','calf']]],full:[['Full body A','Legs, chest, back & core',['squat','floor-press','band-row','dead-bug']],['Full body B','Hips, chest, back & core',['bridge','wall-press','band-row','bird-dog']],['Full body C','Legs, chest, back & arms',['chair-rise','floor-press','band-row','biceps-curl']]]}
 };
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function build({start,days,location='Gym',split='split',level='Starter'}){
  const date=new Date(start+'T12:00:00');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(date.getTime())||iso(date)!==start||date.getDay()!==1)throw Error('Choose a Monday for the week starting date.');
  if(!Array.isArray(days)||days.length!==3||new Set(days).size!==3||days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose exactly three different training days.');
  if(!banks[location]||!['split','full'].includes(split)||!['Starter','Build'].includes(level))throw Error('Choose the listed routine options.');
  let n=0;const sessions=[];for(let i=0;i<7;i++){const d=new Date(date);d.setDate(d.getDate()+i);if(days.includes(d.getDay())){const [name,focus,ids]=banks[location][split][n++];sessions.push({date:iso(d),name,focus,ids:[...ids]});}}
  return {version:1,start,days:[...days],location,split,level,sessions};
 }
 return {build,iso};
})();
if(typeof module!=='undefined')module.exports=RoutineModel;
