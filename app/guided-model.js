const GuidedModel=(()=>{
 const movements={
  'chair-rise':{needs:['Chair'],areas:['Full body','Legs'],target:'Demo: 5 repetitions',steps:['Sit on a stable chair with your feet planted.','Rise steadily, then lower back to the seat.'],cue:'Avoid dropping into the chair.',easy:'Use the chair arms for assistance if needed.'},
  'wall-press':{needs:['Wall'],areas:['Full body','Upper body'],target:'Demo: 3 sets of 5 repetitions',steps:['Place hands against a solid wall at chest height.','Bend the elbows towards the wall, then press back.'],cue:'Keep the trunk aligned.',easy:'Stand closer to the wall.'},
  'calf':{needs:['Chair'],areas:['Full body','Legs'],target:'Demo: 5 repetitions',steps:['Hold stable support and stand tall.','Lift your heels slowly, then lower them.'],cue:'Avoid rocking or bouncing.',easy:'Use seated calf raises from the library.'},
  'side-leg':{needs:['Chair'],areas:['Full body','Legs'],target:'Demo: 5 repetitions each side',steps:['Hold a stable chair for balance.','Move one leg sideways, return, then change sides.'],cue:'Keep your trunk upright.',easy:'Reduce the movement range.'},
  'bottle-curl':{needs:['Water bottles'],areas:['Full body','Upper body'],target:'Demo: 3 sets of 5 repetitions',steps:['Hold sealed non-glass bottles at your sides.','Bend your elbows, then lower with control.'],cue:'Avoid swinging the torso.',easy:'Use lighter bottles.'},
  'biceps-curl':{needs:['Dumbbells'],areas:['Full body','Upper body'],target:'Demo: 3 sets of 5 repetitions',steps:['Hold light dumbbells beside the body.','Curl and lower while keeping upper arms still.'],cue:'Avoid swinging.',easy:'Use lighter resistance.'},
  'wall-slide':{needs:['Wall'],areas:['Shoulders','Upper body'],target:'Demo movement: choose a comfortable range',steps:['Stand at a clear wall with arms bent.','Slide arms upwards through a comfortable range and return.'],cue:'Do not force the shoulders overhead.',easy:'Use a smaller range.'},
  'shoulder-roll':{needs:[],areas:['Shoulders','Upper body'],target:'Demo movement: slow controlled repetitions',steps:['Stand or sit with arms relaxed.','Move shoulders gently in circles.'],cue:'Keep the neck relaxed.',easy:'Make the circles smaller.'}
 };
 function match(profile){return Object.keys(movements).filter(id=>movements[id].areas.includes(profile.focus)&&movements[id].needs.every(x=>profile.equipment.includes(x))&&(id!=='bottle-curl'||!profile.equipment.includes('Dumbbells')));}
 function dates(start,days){const result=[];const d=new Date(start+'T12:00:00');for(let i=0;i<7;i++){if(days.includes(d.getDay()))result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);d.setDate(d.getDate()+1);}return result;}
 return {movements,match,dates};
})();
if(typeof module!=='undefined')module.exports=GuidedModel;
