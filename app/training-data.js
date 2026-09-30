/* Editorial draft catalogue. Exercise names and original brief descriptions;
   not a reviewed programme or a licensed copy of reference-provider content. */
const FightTraining = (() => {
  const rows = [
    ['wall-press','Wall press-up','Chest','Bodyweight','Foundation','Press','Standing press against a stable wall; adjust your distance to change the challenge.'],
    ['incline-press','Incline press-up','Chest','Bench','Foundation','Press','A raised, stable support changes the angle of a press-up.'],
    ['push-up','Press-up','Chest','Bodyweight','Intermediate','Press','A floor-based pressing movement that also requires trunk control.'],
    ['floor-press','Dumbbell floor press','Chest','Dumbbells','Intermediate','Press','A horizontal press performed lying on the floor.'],
    ['bench-press','Dumbbell bench press','Chest','Dumbbells + bench','Intermediate','Press','A supported horizontal press using a pair of dumbbells.'],
    ['chest-machine','Seated chest press','Chest','Gym machine','Foundation','Press','A seated machine-based horizontal press; setup depends on the machine.'],
    ['band-row','Resistance-band row','Back','Resistance band','Foundation','Pull','A pulling movement with resistance from a securely positioned band.'],
    ['db-row','Supported dumbbell row','Back','Dumbbells + bench','Intermediate','Pull','A one-arm row with the other side supported on a stable bench.'],
    ['cable-row','Seated cable row','Back','Cable machine','Intermediate','Pull','A horizontal pull using a cable station.'],
    ['lat-pull','Lat pulldown','Back','Gym machine','Intermediate','Pull','A seated vertical pull using a pulldown machine.'],
    ['assisted-pull','Assisted pull-up','Back','Gym machine','Intermediate','Pull','A vertical pulling movement with assistance from a dedicated machine.'],
    ['shoulder-press','Seated dumbbell shoulder press','Shoulders','Dumbbells + bench','Intermediate','Press','A seated overhead press with dumbbells.'],
    ['lateral-raise','Dumbbell lateral raise','Shoulders','Dumbbells','Intermediate','Raise','A shoulder-focused raise out to the sides.'],
    ['reverse-fly','Reverse fly','Shoulders','Dumbbells','Intermediate','Raise','A rear-shoulder movement with light dumbbells.'],
    ['biceps-curl','Dumbbell biceps curl','Arms','Dumbbells','Foundation','Curl','An elbow-flexion movement using dumbbells.'],
    ['hammer-curl','Hammer curl','Arms','Dumbbells','Foundation','Curl','A curl performed with palms facing inward.'],
    ['band-curl','Resistance-band curl','Arms','Resistance band','Foundation','Curl','An elbow-flexion movement using a resistance band.'],
    ['triceps','Cable triceps pressdown','Arms','Cable machine','Intermediate','Extend','An elbow-extension movement at a cable station.'],
    ['chair-rise','Sit-to-stand','Quads','Chair','Foundation','Squat','Stand from and return to a stable chair.'],
    ['squat','Bodyweight squat','Quads','Bodyweight','Foundation','Squat','A standing squat without external load.'],
    ['goblet','Goblet squat','Quads','Dumbbells','Intermediate','Squat','A squat holding one dumbbell in front of the torso.'],
    ['split-squat','Split squat','Quads','Bodyweight','Intermediate','Lunge','A squat in a staggered stance, working each side separately.'],
    ['leg-press','Leg press','Quads','Gym machine','Intermediate','Press','A machine-based leg press with adjustable seating and resistance.'],
    ['bridge','Glute bridge','Glutes','Bodyweight','Foundation','Bridge','A floor-based hip lift with the feet planted.'],
    ['hip-thrust','Bench hip thrust','Glutes','Bench','Intermediate','Bridge','A hip-lift movement with the upper back supported by a stable bench.'],
    ['side-leg','Standing side leg raise','Glutes','Chair','Foundation','Raise','A sideways leg raise with stable support available for balance.'],
    ['hinge','Hip hinge practice','Hamstrings','Bodyweight','Foundation','Hinge','An unloaded movement pattern that folds at the hips.'],
    ['rdl','Dumbbell Romanian deadlift','Hamstrings','Dumbbells','Intermediate','Hinge','A loaded hip-hinge movement using dumbbells.'],
    ['leg-curl','Seated leg curl','Hamstrings','Gym machine','Intermediate','Curl','A machine-based knee-flexion movement.'],
    ['calf','Supported calf raise','Calves','Chair','Foundation','Raise','A heel raise with stable support available for balance.'],
    ['seated-calf','Seated calf raise','Calves','Chair','Foundation','Raise','A heel raise performed while seated.'],
    ['dead-bug','Dead bug','Core','Bodyweight','Foundation','Control','A floor-based movement coordinating opposite limbs while controlling the trunk.'],
    ['bird-dog','Bird dog','Core','Bodyweight','Foundation','Control','An all-fours movement extending opposite limbs with trunk control.'],
    ['plank','Forearm plank','Core','Bodyweight','Intermediate','Hold','A static trunk-support position on forearms and toes.'],
    ['side-plank','Side plank','Core','Bodyweight','Intermediate','Hold','A side-supported static trunk position.'],
    ['carry','Farmer carry','Full body','Dumbbells','Intermediate','Carry','Walk a clear route carrying a dumbbell at each side.'],
    ['walk','Walking','Cardio','None','Foundation','Steady','A walking activity that can be logged by duration.'],
    ['bike','Stationary cycling','Cardio','Exercise bike','Foundation','Steady','A stationary-bike activity with adjustable resistance.'],
    ['rower','Rowing ergometer','Cardio','Rowing machine','Intermediate','Steady','A seated whole-body activity on a rowing machine.'],
    ['march','Marching on the spot','Cardio','None','Foundation','Steady','An indoor marching activity without external equipment.'],
    ['ankle','Ankle circles','Mobility','Chair','Foundation','Mobility','Seated ankle movement through a comfortable range.'],
    ['shoulder-roll','Shoulder rolls','Mobility','None','Foundation','Mobility','Gentle shoulder movement that can form part of a movement break.']
  ];
  rows.push(
    ['burpee','Burpee','Full body','Bodyweight','Advanced','Jump','A standing-to-floor movement returning to a jump. Requires clear floor space and controlled landings.'],
    ['step-burpee','Step-back burpee — no jump','Full body','Bodyweight','Intermediate','Control','Step each foot back and forward through a supported plank position, returning to standing without a jump.'],
    ['star-jacks','Star jumps / jumping jacks','Cardio','Bodyweight','Intermediate','Jump','Repeated out-and-in jumps with arm movement. Allow clear space overhead and beside you.'],
    ['step-jacks','Step jacks — no jump','Cardio','Bodyweight','Foundation','Steady','Alternate side steps with arm raises while keeping one foot on the floor.'],
    ['high-knees','High knees','Cardio','Bodyweight','Intermediate','Jump','Running on the spot with alternating raised knees. Choose marching for a non-jumping option.'],
    ['tuck-jump','Tuck jump / knee jump','Full body','Bodyweight','Advanced','Jump','A jump bringing the knees upward, followed by a controlled landing. An advanced option, not a beginner default.'],
    ['squat-jump','Squat jump','Quads','Bodyweight','Advanced','Jump','A squat followed by a jump and controlled landing. Bodyweight squats are the non-jumping alternative.'],
    ['heel-digs','Alternating heel digs','Cardio','Bodyweight','Foundation','Steady','Alternate forward heel taps while standing, with optional arm movement.'],
    ['side-steps','Side steps','Cardio','Bodyweight','Foundation','Steady','Step sideways and bring the other foot alongside without jumping.'],
    ['butt-kicks','Jogging heel flicks','Cardio','Bodyweight','Intermediate','Jump','Jog in place with alternating heels moving behind you. Standing hamstring curls avoid the jogging impact.'],
    ['standing-curl','Standing hamstring curl','Hamstrings','Chair','Foundation','Curl','Bend one knee to bring the heel behind you, using a stable chair for balance if needed.'],
    ['mountain-climber','Mountain climbers','Core','Bodyweight','Intermediate','Control','From a high plank, alternate bringing a knee forward while controlling the trunk.'],
    ['slow-climber','Slow mountain climbers','Core','Bodyweight','Intermediate','Control','A deliberately slower knee-drive variation from a high plank; still loads wrists and shoulders.'],
    ['reverse-lunge','Reverse lunge','Quads','Bodyweight','Intermediate','Lunge','Step back into a staggered position and return to standing, alternating sides.'],
    ['lateral-lunge','Lateral lunge','Quads','Bodyweight','Intermediate','Lunge','Step to the side and bend that leg while keeping the other leg longer.'],
    ['wall-sit','Wall sit','Quads','Wall','Intermediate','Hold','A supported static squat position with the back against a clear, solid wall.'],
    ['kneeling-press','Kneeling press-up','Chest','Bodyweight','Foundation','Press','A floor press-up supported on the knees rather than the toes.'],
    ['plank-tap','Plank shoulder taps','Core','Bodyweight','Intermediate','Control','From a high plank, alternate briefly touching the opposite shoulder.'],
    ['heel-taps','Supine heel taps','Core','Bodyweight','Foundation','Control','Lying on the back with bent legs raised, lower one heel towards the floor at a time.'],
    ['clamshell','Side-lying clamshell','Glutes','Bodyweight','Foundation','Control','Lying on one side with bent knees, open the upper knee while keeping the feet together.'],
    ['side-lying-raise','Side-lying leg raise','Glutes','Bodyweight','Foundation','Raise','Raise and lower the upper leg while lying on your side.'],
    ['bridge-march','Glute bridge march','Glutes','Bodyweight','Intermediate','Control','Alternate lifting a foot from a bridge position while controlling the pelvis.'],
    ['prone-w','Prone W raise','Back','Bodyweight','Intermediate','Raise','Lying face down, gently lift the arms in a W shape without forcing the lower back.'],
    ['wall-slide','Wall arm slides','Shoulders','Wall','Foundation','Mobility','Move the arms along a clear wall through a comfortable range.'],
    ['backpack-squat','Backpack front-held squat','Quads','Backpack','Intermediate','Squat','Hold a securely closed backpack close to the torso during a squat. Use a manageable load with no loose or sharp contents.'],
    ['backpack-row','Backpack bent-over row','Back','Backpack','Intermediate','Pull','Row a securely closed backpack with a controlled hip hinge. Check handles and stitching; use a manageable load.'],
    ['backpack-hinge','Backpack hip hinge','Hamstrings','Backpack','Intermediate','Hinge','Hold a securely closed backpack close to the body during a hip hinge. Keep contents secure and use a manageable load.'],
    ['bottle-curl','Water-bottle curl','Arms','Water bottles','Foundation','Curl','Use matched, sealed non-glass water bottles as light resistance for curls. Keep a secure grip.'],
    ['bottle-raise','Water-bottle lateral raise','Shoulders','Water bottles','Intermediate','Raise','Raise matched, sealed non-glass bottles to the sides using light, controlled resistance.'],
    ['bottle-carry','Water-bottle carry','Full body','Water bottles','Foundation','Carry','Carry sealed non-glass bottles along a clear, level indoor route with a secure grip.']
  );
  rows.push(
    ['squat-thrust','Squat thrust','Full body','Bodyweight','Advanced','Jump','From a crouch, hop the feet back to a high plank and in again. No standing jump or press-up.'],
    ['hand-release-press','Hand-release press-up','Chest','Bodyweight','Advanced','Press','Lower to the floor, briefly lift the hands, replace them and press the body up together.'],
    ['bear-crawl','Bear crawl','Full body','Bodyweight','Advanced','Control','Travel slowly on hands and toes with bent knees hovering above the floor.'],
    ['plank-up-down','Plank up-down','Core','Bodyweight','Advanced','Control','Move between forearm and high plank, alternating the leading arm.'],
    ['calf-stretch','Standing calf stretch','Mobility','Wall','Foundation','Stretch','A gentle staggered-stance stretch with a wall for balance.'],
    ['hamstring-stretch','Lying hamstring stretch','Mobility','Bodyweight','Foundation','Stretch','Support the back of one thigh while lying down and gently straighten that knee.'],
    ['quad-stretch','Side-lying thigh stretch','Mobility','Bodyweight','Foundation','Stretch','Lie on one side and gently bring the upper heel toward the buttock.'],
    ['chest-stretch','Standing chest opening','Mobility','None','Foundation','Stretch','Open the arms gently out and slightly back with relaxed shoulders.'],
    ['glute-stretch','Lying figure-four stretch','Mobility','Bodyweight','Foundation','Stretch','Rest one ankle across the opposite thigh and draw the supported thigh toward you.'],
    ['upper-back-stretch','Upper-back reach','Mobility','None','Foundation','Stretch','Reach the hands forward with relaxed shoulders and gently widen the upper back.']
  );
  rows.push(
    ['hip-flexor-stretch','Half-kneeling hip-flexor stretch','Mobility','Bodyweight','Foundation','Stretch','A gentle split-stance hip stretch with the rear knee on a padded surface.'],
    ['butterfly-stretch','Seated butterfly stretch','Mobility','Bodyweight','Foundation','Stretch','Sit with soles together and allow the knees to relax without pressing them down.'],
    ['half-split','Half-split hamstring preparation','Mobility','Bodyweight','Intermediate','Stretch','From kneeling, lengthen one leg forward with a soft knee and gently hinge at the hips. This is preparation, not a full split.']
  );
  // Glutes and legs (the "Glutes and legs" weekly routine)
  rows.push(
    ['single-leg-bridge','Single-leg glute bridge','Glutes','Bodyweight','Intermediate','Bridge','A glute bridge driven through one foot while the other leg stays lifted.'],
    ['frog-pump','Frog pump','Glutes','Bodyweight','Foundation','Bridge','A short-range bridge with the soles of the feet together and the knees open.'],
    ['band-walk','Banded side walk','Glutes','Resistance band','Foundation','Control','Small side steps in a half-squat with a light loop band just above the knees.'],
    ['fire-hydrant','Fire hydrant','Glutes','Bodyweight','Foundation','Raise','On hands and knees, lift one bent knee out to the side and lower it.'],
    ['donkey-kick','Donkey kick','Glutes','Bodyweight','Foundation','Extend','On hands and knees, press one bent leg up behind you with the sole towards the ceiling.'],
    ['curtsy-lunge','Curtsy lunge','Glutes','Bodyweight','Intermediate','Lunge','Step one foot back and across behind the other, then return to standing.'],
    ['sumo-squat','Dumbbell sumo squat','Glutes','Dumbbells','Intermediate','Squat','A wide-stance squat holding one dumbbell between the legs.'],
    ['step-up','Step-up','Quads','Bench','Intermediate','Lunge','Step up onto a stable box or bench of knee height or lower, then step back down.'],
    ['single-leg-rdl','Single-leg Romanian deadlift','Hamstrings','Dumbbells','Intermediate','Hinge','A hip hinge on one leg while the other leg reaches back for balance.'],
    ['bulgarian-split','Bulgarian split squat','Glutes','Dumbbells + bench','Intermediate','Lunge','A split squat with the rear foot resting on a stable bench behind you.'],
    ['b-stance-thrust','B-stance hip thrust','Glutes','Bench','Intermediate','Bridge','A bench hip thrust with most of the work on one leg and the other foot as a kickstand.'],
    ['kb-swing','Kettlebell swing','Glutes','Kettlebell','Intermediate','Hinge','A powerful hip hinge that swings a kettlebell up to chest height.'],
    ['cable-kickback','Cable glute kickback','Glutes','Cable machine','Intermediate','Extend','Kick one leg straight back against a low cable with an ankle strap.'],
    ['pull-through','Cable pull-through','Glutes','Cable machine','Intermediate','Hinge','Facing away from a low cable, drive the hips forward to stand tall.'],
    ['back-extension','Glute-focused back extension','Glutes','Gym machine','Intermediate','Hinge','A 45-degree back extension moved from the hips, finishing with a strong glute squeeze.'],
    ['hip-abduction','Seated hip abduction','Glutes','Gym machine','Foundation','Control','A seated machine movement pushing the knees outward against the pads.'],
    ['walking-lunge','Walking lunge','Quads','Bodyweight','Intermediate','Lunge','Alternating forward lunges travelling along a clear, level route.']
  );
  const alternatives={'burpee':'step-burpee','star-jacks':'step-jacks','high-knees':'march','tuck-jump':'march','squat-jump':'squat','butt-kicks':'standing-curl','squat-thrust':'step-burpee'};
  const exercises = rows.map(([id,name,body,equipment,level,pattern,description]) => ({id,name,body,equipment,level,pattern,description,status:'Editorial draft',home:['Bodyweight','None','Chair','Wall','Backpack','Water bottles','Resistance band'].includes(equipment),impact:pattern==='Jump'?'Jumping':'No jumping',alternative:alternatives[id]||null}));
  const templates = [
    ['home-start','Home foundations','Full body','Home',false,['chair-rise','wall-press','bridge','bird-dog'],'An introduction to the session-building experience.'],
    ['upper-home','Upper-body basics','Upper body','Home',false,['wall-press','band-row','band-curl'],'Pressing and pulling exercise ideas for home.'],
    ['lower-home','Lower-body basics','Lower body','Home',false,['chair-rise','bridge','calf'],'Explore a selection of lower-body movements.'],
    ['core-control','Core control','Core','Home',false,['dead-bug','bird-dog','bridge'],'A small library selection centred on trunk control.'],
    ['movement','Movement break','Mobility','Home',false,['march','shoulder-roll','ankle'],'A movement-break layout to customise.'],
    ['gym-full','Gym full body','Full body','Gym',true,['leg-press','chest-machine','cable-row','bike'],'A broader gym session canvas.'],
    ['push','Push focus','Upper body','Gym',true,['bench-press','shoulder-press','triceps'],'Chest, shoulder and arm exercise selection.'],
    ['pull','Pull focus','Upper body','Gym',true,['lat-pull','cable-row','hammer-curl'],'Back and arm exercise selection.'],
    ['lower-gym','Lower-body strength','Lower body','Gym',true,['goblet','rdl','leg-curl','calf'],'A lower-body session canvas for gym equipment.'],
    ['conditioning','Conditioning mix','Conditioning','Gym',true,['bike','carry','rower'],'General conditioning options, not a fight-camp prescription.'],
    ['db-full','Dumbbell selection','Full body','Home',true,['goblet','floor-press','rdl','biceps-curl'],'Build a session around available dumbbells.'],
    ['recovery','Easy movement','Mobility','Home',false,['walk','ankle','shoulder-roll'],'A movement selection for a quieter day.'],
    ['home-cardio','Living-room cardio','Cardio','Home',false,['step-jacks','heel-digs','side-steps','march'],'A no-jumping cardio selection for indoor space.'],
    ['home-bodyweight','Bodyweight selection','Full body','Home',false,['squat','kneeling-press','bridge','bird-dog'],'Home options without weights or machines.'],
    ['home-resistance','Household resistance','Full body','Home',false,['backpack-squat','backpack-row','bottle-curl','bottle-carry'],'Backpack and sealed-bottle options; inspect equipment and keep loads manageable.'],
    ['home-impact','Jumping options','Conditioning','Home',false,['star-jacks','high-knees','burpee'],'An experienced-user selection with jumping and clear-space requirements. Non-jumping alternatives are linked in the library.'],
    ['home-floor','Floor-based control','Core','Home',false,['dead-bug','heel-taps','clamshell','bridge'],'A small-space selection with no jumping.']
  ].map(([id,name,focus,setting,premium,ids,description])=>({id,name,focus,setting,premium,ids,description}));
  function filter({query='',body='All',equipment='All',level='All',favorites=null,homeOnly=false,impact='All'}={}) {
    return exercises.filter(e=>(!homeOnly||e.home)&&(impact==='All'||e.impact===impact)&&(body==='All'||e.body===body)&&(equipment==='All'||e.equipment===equipment)&&(level==='All'||e.level===level)&&(!favorites||favorites.includes(e.id))&&`${e.name} ${e.body} ${e.pattern}`.toLowerCase().includes(query.toLowerCase().trim()));
  }
  return {exercises,templates,filter};
})();
if(typeof module!=='undefined') module.exports=FightTraining;
