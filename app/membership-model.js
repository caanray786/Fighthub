/* Product-access rules for the local preview, not server-side subscription security. */
const Membership=(()=>{
 const freeExercises=['chair-rise','wall-press','bridge','bird-dog','dead-bug','calf','march','shoulder-roll','ankle','side-steps','heel-digs','side-leg'];
 const freeTemplates=['home-start','lower-home','core-control'];
 const freeMobility=['ankle','shoulder-roll','side-leg'];
 const sample=['chair-rise','wall-press','calf'];
 const canExercise=(id,premium)=>premium||freeExercises.includes(id);
 const canTemplate=(id,premium)=>premium||freeTemplates.includes(id);
 const canSession=(session,premium)=>!!session&&(premium||session.access==='free-starter');
 return {freeExercises,freeTemplates,freeMobility,sample,canExercise,canTemplate,canSession};
})();
if(typeof module!=='undefined')module.exports=Membership;
