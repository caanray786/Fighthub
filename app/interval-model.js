const IntervalModel={
 build(ids,work,rest,rounds){
  if(!ids.length||!Number.isInteger(work)||work<5||work>180||!Number.isInteger(rest)||rest<5||rest>180||!Number.isInteger(rounds)||rounds<1||rounds>10)throw Error('Choose exercises, 5–180 second intervals and 1–10 rounds.');
  const phases=[];for(let r=1;r<=rounds;r++)for(let i=0;i<ids.length;i++){phases.push({kind:'Work',id:ids[i],seconds:work,round:r});if(r!==rounds||i!==ids.length-1)phases.push({kind:'Recover',id:ids[i],seconds:rest,round:r});}return phases;
 },
 position(phases,elapsed){let boundary=0;for(let i=0;i<phases.length;i++){boundary+=phases[i].seconds;if(elapsed<boundary)return {index:i,remaining:Math.ceil(boundary-elapsed),finished:false};}return {index:phases.length,remaining:0,finished:true};}
};
if(typeof module!=='undefined')module.exports=IntervalModel;
