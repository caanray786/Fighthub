/* Fight training content: drills, round-based sessions and multi-week programmes.
   Original wording. Structure follows published guidance (see docs/FIGHT-TRAINING.md):
   round lengths match each sport, flexibility holds follow the stretching consensus
   (2–3 sets of 30–120 s, contract-relax 6 s), running uses base, interval and sprint work.
   General training information, not individual coaching or medical advice. */
const FightData = (() => {
  // ---- Drill library ----
  // n name · arts · t type · eq equipment · lv level · s steps · c key cue · e easier · h harder · w safety
  const drills = {
    // Warm-up and general
    'skip-rope': { n: 'Skipping rope', arts: ['all'], t: 'Warm-up', eq: 'Skipping rope', lv: 'Foundation', s: ['Hold the handles at hip height with elbows close to your sides.', 'Turn the rope with your wrists, not your shoulders.', 'Jump just high enough to clear the rope and land softly on the balls of your feet. Alternate feet once the bounce feels easy.'], c: 'Quiet feet, relaxed shoulders, steady breathing.', e: 'No rope: bounce lightly on the spot or step side to side.', h: 'Add runs of fast alternate-foot skips or double-unders.' },
    'shadow-bounce': { n: 'Bounce and guard', arts: ['all'], t: 'Warm-up', eq: 'None', lv: 'Foundation', s: ['Stand in your fighting stance with hands up by your cheeks.', 'Bounce lightly on the balls of your feet, shifting forward, back and side to side.', 'Throw loose, light punches every few seconds to raise the heart rate.'], c: 'Stay light and relaxed; this is a warm-up, not a sprint.', e: 'March in place with your guard up.' },
    'jog-in-place': { n: 'Jog on the spot', arts: ['all'], t: 'Warm-up', eq: 'None', lv: 'Foundation', s: ['Jog gently on the spot, landing softly.', 'Swing your arms naturally.', 'Build the pace a little each minute.'], c: 'Easy effort: you should be able to talk.', e: 'March instead of jogging.' },
    'arm-circles': { n: 'Arm circles and shoulder rolls', arts: ['all'], t: 'Warm-up', eq: 'None', lv: 'Foundation', s: ['Roll your shoulders backward ten times, then forward ten times.', 'Circle straight arms, small to large, forward then backward.', 'Finish with loose punches straight out in front.'], c: 'Smooth circles; no forcing at the end of range.', e: 'Keep the circles small.' },
    'hip-openers': { n: 'Hip openers', arts: ['all'], t: 'Warm-up', eq: 'None', lv: 'Foundation', s: ['Lift one knee to hip height, then rotate it out to the side and step down ("open the gate").', 'Reverse it: lift the knee out to the side and bring it round to the front ("close the gate").', 'Alternate legs, using a wall for balance if needed.'], c: 'Tall posture; move slowly through the full circle.', e: 'Hold a wall or chair for balance.' },
    'leg-swings-front': { n: 'Front leg swings', arts: ['all'], t: 'Warm-up', eq: 'Wall for balance', lv: 'Foundation', s: ['Stand side-on to a wall and hold it with one hand.', 'Swing the outside leg forward and back, starting low.', 'Let the height build gradually over the set; switch sides halfway.'], c: 'Controlled swings; the height comes from warming up, not from throwing the leg.', e: 'Keep the swings low and short.' },
    'leg-swings-side': { n: 'Side leg swings', arts: ['all'], t: 'Warm-up', eq: 'Wall for balance', lv: 'Foundation', s: ['Face a wall and rest both hands on it.', 'Swing one leg across your body and out to the side.', 'Increase the range gradually; switch legs halfway.'], c: 'Keep your hips facing the wall.', e: 'Smaller swings.' },
    'inchworm': { n: 'Inchworm walk-out', arts: ['all'], t: 'Warm-up', eq: 'None', lv: 'Foundation', s: ['From standing, bend forward and place your hands on the floor (bend your knees as much as you need).', 'Walk your hands out to a high plank.', 'Walk your feet towards your hands and stand up.'], c: 'Move slowly and keep your trunk firm in the plank.', e: 'Walk the hands out only part of the way.' },

    // Boxing
    'stance-footwork': { n: 'Stance and step-drag footwork', arts: ['boxing', 'kickboxing', 'mma'], t: 'Stance & footwork', eq: 'None', lv: 'Foundation', s: ['Stand side-on, feet about shoulder-width apart, lead foot forward, knees soft, hands up by your cheeks, chin down.', 'To move forward, step with the lead foot and drag the rear foot the same distance. To move back, step with the rear foot first.', 'Move sideways the same way: the foot nearest the direction moves first. Never cross your feet.'], c: 'Keep the same stance width after every step.', e: 'Take smaller steps and pause between them.', h: 'Add a jab with each forward step.' },
    'pivot': { n: 'Pivots and angles', arts: ['boxing', 'kickboxing', 'mma'], t: 'Stance & footwork', eq: 'None', lv: 'Intermediate', s: ['From your stance, turn on the ball of your lead foot and swing your rear foot round a quarter-turn.', 'You now face a new angle; reset your guard.', 'Practise pivoting after combinations to move off the line.'], c: 'Pivot on the ball of the foot, not the heel.', e: 'Smaller turns, slower pace.' },
    'jab': { n: 'Jab', arts: ['boxing', 'kickboxing', 'mma', 'muaythai'], t: 'Punching', eq: 'None', lv: 'Foundation', s: ['From your stance, extend your lead hand straight out, turning the palm down as the arm straightens.', 'Keep your rear hand by your chin and your chin tucked behind the lead shoulder.', 'Bring the hand back along the same line to your guard.'], c: 'Snap it out, bring it back just as fast.', e: 'Throw slowly at half speed.', h: 'Double jab, or step in with the jab.' },
    'cross': { n: 'Cross', arts: ['boxing', 'kickboxing', 'mma', 'muaythai'], t: 'Punching', eq: 'None', lv: 'Foundation', s: ['Push off the ball of your rear foot and turn your hip and shoulder forward.', 'Extend the rear hand straight down the middle, palm turning down.', 'Keep the lead hand up; return the punch to your chin.'], c: 'Power starts at the rear foot and travels through the hip.', e: 'Half speed with a pause at full extension.' },
    'lead-hook': { n: 'Lead hook', arts: ['boxing', 'kickboxing', 'mma', 'muaythai'], t: 'Punching', eq: 'None', lv: 'Intermediate', s: ['Shift your weight slightly onto the lead leg.', 'Turn your lead hip, shoulder and foot together, bringing the lead arm round at shoulder height with the elbow bent about 90°.', 'Keep the rear hand glued to your chin; return to guard.'], c: 'Turn the body; the arm just comes along.', e: 'Shorter, slower turns.' },
    'uppercut': { n: 'Uppercuts', arts: ['boxing', 'kickboxing', 'mma'], t: 'Punching', eq: 'None', lv: 'Intermediate', s: ['Dip slightly by bending the knees on the side you are punching with.', 'Drive up through the legs and hip, bringing the fist upward with the palm facing you.', 'Keep the punch short and return to guard.'], c: 'Legs first, then the fist; do not drop the hand before throwing.', e: 'Practise slowly in front of a mirror.' },
    'body-shots': { n: 'Body shots', arts: ['boxing', 'kickboxing', 'mma'], t: 'Punching', eq: 'None', lv: 'Intermediate', s: ['Bend your knees to lower your level; do not just lean forward.', 'Throw the jab, cross or hook to body height.', 'Come back up to your stance with your guard high.'], c: 'Change level with your legs and keep your head off the centre line.', e: 'Straight punches only.' },
    'slip': { n: 'Slips', arts: ['boxing', 'kickboxing', 'mma'], t: 'Defence', eq: 'None', lv: 'Intermediate', s: ['From your stance, rotate your shoulders and bend slightly at the knees to move your head just outside an imaginary straight punch.', 'Slip to the outside of the lead hand, then to the outside of the rear hand.', 'Return to centre with your hands up.'], c: 'Small movements: the head moves inches, not feet.', e: 'Slow slips with a pause.', h: 'Slip then counter with a punch from the same side.' },
    'roll': { n: 'Roll (bob and weave)', arts: ['boxing', 'kickboxing', 'mma'], t: 'Defence', eq: 'None', lv: 'Intermediate', s: ['Imagine a hook coming at head height.', 'Bend your knees and move your head in a U-shape under it, from one side to the other.', 'Come up on the far side with your guard high, ready to punch.'], c: 'Bend at the knees and keep your eyes forward, not on the floor.', e: 'Shallow rolls, slowly.' },
    'parry': { n: 'Parry and catch', arts: ['boxing', 'kickboxing', 'mma'], t: 'Defence', eq: 'None', lv: 'Foundation', s: ['Imagine a jab coming in. Catch it with your rear palm just in front of your face.', 'Or tap it slightly aside (parry) with the same hand.', 'Return the jab straight away.'], c: 'Short hand movements; do not reach out for the punch.', e: 'Practise the catch only.' },
    'punch-out': { n: 'Punch-out', arts: ['boxing', 'kickboxing', 'mma', 'muaythai'], t: 'Conditioning', eq: 'None or bag', lv: 'Intermediate', s: ['Square up slightly with knees bent.', 'Throw fast, light, straight punches, alternating hands as quickly as you can.', 'Keep the punches in front of your face and breathe out with each one.'], c: 'Speed over power; keep the hands returning to your face.', e: 'Slower pace, or shorter bursts.' },
    'bag-work': { n: 'Heavy bag technique', arts: ['boxing', 'kickboxing', 'muaythai', 'mma'], t: 'Punching', eq: 'Heavy bag + wraps + gloves', lv: 'Intermediate', s: ['Wrap your hands and wear bag gloves.', 'Find your distance: your jab should land with the arm almost straight.', 'Punch through the surface of the bag, not at it, then move and reset.'], c: 'Keep hitting with correct form; stop the round if your technique falls apart.', e: 'Work at half power with longer rests.', w: 'Always wrap your hands and wear gloves on the bag.' },

    // Muay Thai and kickboxing
    'mt-stance': { n: 'Muay Thai stance and rhythm', arts: ['muaythai', 'kickboxing'], t: 'Stance & footwork', eq: 'None', lv: 'Foundation', s: ['Stand more square than a boxer, feet about shoulder-width apart, weight mostly on the rear leg.', 'Keep the lead leg light so it can lift to teep or check at any time.', 'Hands high, elbows in; move with a relaxed rhythm, stepping rather than bouncing.'], c: 'Light lead leg, tall posture, hands high.', e: 'Hold the stance and practise lifting the lead knee.' },
    'teep': { n: 'Teep (push kick)', arts: ['muaythai', 'kickboxing', 'mma'], t: 'Kicking', eq: 'None', lv: 'Foundation', s: ['Lift the knee high towards your chest.', 'Push the foot straight forward, striking with the ball of the foot, pushing the hips through.', 'Bring the foot back and set it down in stance.'], c: 'Knee up first, then push, like shutting a door with your foot.', e: 'Lower target, slower pace, hold a wall.', h: 'Step-in teep, or switch teep with the rear leg.' },
    'roundhouse': { n: 'Roundhouse kick (Muay Thai)', arts: ['muaythai', 'kickboxing', 'mma'], t: 'Kicking', eq: 'None', lv: 'Intermediate', s: ['Step slightly out at an angle with the lead foot.', 'Turn on the ball of your supporting foot, rotating the hips over and swinging the kicking leg round with a slightly bent knee.', 'Strike with the shin; swing the same-side arm down for balance and keep the other hand guarding your face. Return to stance.'], c: 'Turn the hip over and let the leg swing like a bat, with the shin as the contact point.', e: 'Kick low and slowly; hold a wall to practise the pivot.', h: 'Kick at head height once flexibility allows.' },
    'low-kick': { n: 'Low kick', arts: ['muaythai', 'kickboxing', 'mma'], t: 'Kicking', eq: 'None', lv: 'Intermediate', s: ['Set up with a punch or a step.', 'Turn the hip over and kick down at an angle into the thigh with the lower shin.', 'Keep your hands up and return to stance.'], c: 'Kick through the target and return to your stance straight away.', e: 'Slow shadow kicks.' },
    'switch-kick': { n: 'Switch kick', arts: ['muaythai', 'kickboxing'], t: 'Kicking', eq: 'None', lv: 'Advanced', s: ['Do a quick hop to swap your feet, bringing the lead foot back and the rear foot forward.', 'Straight away, throw a roundhouse kick with the leg that is now at the back.', 'Return to your normal stance.'], c: 'The switch and the kick flow together as one movement.', e: 'Step through the switch instead of hopping.' },
    'check': { n: 'Checking a low kick', arts: ['muaythai', 'kickboxing'], t: 'Defence', eq: 'None', lv: 'Intermediate', s: ['Lift the lead knee up and slightly out, turning the shin outwards to meet an incoming kick.', 'Keep your hands high and your posture upright.', 'Set the foot back down and fire back with a punch or kick.'], c: 'Lift fast, shin turned out, then answer back.', e: 'Practise the lift and hold for 2 seconds.' },
    'knee-straight': { n: 'Straight knee', arts: ['muaythai', 'kickboxing', 'mma'], t: 'Knees & clinch', eq: 'None', lv: 'Foundation', s: ['Reach both hands forward as if holding the back of an opponent’s head.', 'Drive the rear knee up and forward, pushing the hips through and rising onto the toes of the standing foot.', 'Pull the hands down as the knee comes up, then step back to stance.'], c: 'Hips forward, not just knee up.', e: 'Slow knees holding a wall.' },
    'clinch-knees': { n: 'Clinch knees', arts: ['muaythai'], t: 'Knees & clinch', eq: 'None or heavy bag', lv: 'Intermediate', s: ['Hold the plum position: both hands stacked behind an imaginary head, elbows squeezed together in front.', 'Throw alternating knees, turning the opponent (or the bag) slightly with your hands.', 'Keep your posture tall and your hips close.'], c: 'Stand tall, hips in, elbows tight.', e: 'Single knees with a pause.', w: 'On a bag, drive knees into the bag, not your own hands.' },
    'elbows': { n: 'Elbows (shadow)', arts: ['muaythai'], t: 'Knees & clinch', eq: 'None', lv: 'Intermediate', s: ['Step in close to shadow range.', 'Throw a horizontal elbow by turning the shoulder, keeping the forearm level and the other hand guarding.', 'Practise the uppercut elbow by driving the elbow up through the centre.'], c: 'Short distance, turn the body, keep the guard.', e: 'Slow, controlled shadow reps.' },
    'high-kick': { n: 'High kick', arts: ['kickboxing', 'muaythai', 'taekwondo', 'karate'], t: 'Kicking', eq: 'None', lv: 'Advanced', s: ['Warm up fully with leg swings first.', 'Throw a roundhouse aimed at head height, turning the support foot fully.', 'Keep your hands up and return to stance under control.'], c: 'Only kick as high as you can with good balance; the height comes with flexibility work.', e: 'Kick to body height.', w: 'Never throw high kicks cold.' },

    // Taekwondo, karate and kung fu
    'chamber-hold': { n: 'Chamber hold', arts: ['taekwondo', 'karate', 'kungfu', 'kickboxing'], t: 'Kicking', eq: 'Wall for balance (optional)', lv: 'Foundation', s: ['From your stance, lift the kicking knee to the chamber position for the kick you are training (front, side or roundhouse).', 'Hold it steady for 5–10 seconds with the supporting knee soft.', 'Lower with control and repeat on the other leg.'], c: 'Still, balanced and tall: no wobbling.', e: 'Hold a wall and hold for 3 seconds.', h: 'Extend the kick slowly from the chamber and hold it out.' },
    'front-kick': { n: 'Front kick (ap chagi / mae-geri)', arts: ['taekwondo', 'karate', 'kungfu'], t: 'Kicking', eq: 'None', lv: 'Foundation', s: ['Lift the kicking knee high in front of you.', 'Snap the lower leg out, striking with the ball of the foot (toes pulled back).', 'Snap it back to the chamber and set it down.'], c: 'Snap out, snap back: the return is as fast as the kick.', e: 'Low target, slow pace.' },
    'side-kick': { n: 'Side kick (yeop chagi / yoko-geri)', arts: ['taekwondo', 'karate', 'kungfu'], t: 'Kicking', eq: 'None', lv: 'Intermediate', s: ['Lift the knee across your body so the foot is chambered by the opposite knee.', 'Turn the supporting foot away and drive the kick out sideways, striking with the heel or blade of the foot.', 'Re-chamber and return to stance.'], c: 'Heel, hip and shoulder in one line at full extension.', e: 'Low side kicks holding a wall.' },
    'snap-roundhouse': { n: 'Snapping roundhouse (dollyo chagi / mawashi-geri)', arts: ['taekwondo', 'karate', 'kungfu'], t: 'Kicking', eq: 'None', lv: 'Intermediate', s: ['Lift the knee to the side, chambered and pointing at the target.', 'Pivot on the supporting foot and snap the lower leg round, striking with the instep or ball of the foot.', 'Snap the leg back to the chamber before putting it down.'], c: 'Point the knee, pivot, snap and return.', e: 'Low target with a wall for balance.' },
    'rapid-kicks': { n: 'Rapid-fire kicks', arts: ['taekwondo', 'kickboxing', 'karate'], t: 'Conditioning', eq: 'None', lv: 'Intermediate', s: ['Pick one kick, for example a roundhouse at body height.', 'Kick as quickly as you can while keeping good form and balance.', 'Switch legs halfway through the round.'], c: 'Speed, but still chamber and re-chamber every kick.', e: 'Slower pace, lower kicks.' },
    'zenkutsu': { n: 'Front stance stepping (zenkutsu-dachi)', arts: ['karate'], t: 'Stance & footwork', eq: 'None', lv: 'Foundation', s: ['Step forward into a long, low stance: front knee bent over the toes, back leg nearly straight, both heels down.', 'Step forward by bringing the back foot in beside the front foot, then out into the next stance.', 'Keep your head at the same height as you move.'], c: 'Low and stable; the head does not bob up and down.', e: 'A shorter, higher stance.' },
    'oi-zuki': { n: 'Stepping punch (oi-zuki)', arts: ['karate'], t: 'Punching', eq: 'None', lv: 'Foundation', s: ['From front stance, step forward into the next stance.', 'Punch with the hand on the same side as the front leg, landing the punch as the foot lands.', 'Pull the other hand back to your hip as you punch.'], c: 'Foot and fist arrive together.', e: 'Punch from a still stance first.' },
    'gyaku-zuki': { n: 'Reverse punch (gyaku-zuki)', arts: ['karate'], t: 'Punching', eq: 'None', lv: 'Foundation', s: ['From front stance, punch with the hand opposite the front leg.', 'Drive the rear hip forward as the punch goes out.', 'Pull the other hand back to your hip.'], c: 'The hip turns first; the punch rides the hip.', e: 'Half speed with a pause.' },
    'karate-blocks': { n: 'Basic blocks (age-uke, soto-uke, gedan-barai)', arts: ['karate'], t: 'Defence', eq: 'None', lv: 'Foundation', s: ['Rising block: bring the forearm up and above your forehead, turning it outward.', 'Outside block: swing the forearm from outside inward across the chest.', 'Downward block: sweep the forearm down and across in front of the lead leg.'], c: 'Each block finishes firm, with the other hand pulling back to the hip.', e: 'One block at a time, slowly.' },
    'horse-stance': { n: 'Horse stance hold (ma bu)', arts: ['kungfu', 'karate', 'taekwondo'], t: 'Conditioning', eq: 'None', lv: 'Foundation', s: ['Stand with feet about twice shoulder-width apart, toes forward.', 'Sink until the thighs approach level with the floor, knees tracking over the toes.', 'Keep your back upright and hold.'], c: 'Knees out over the toes, back tall, breathe slowly.', e: 'Stand higher with a narrower stance.', h: 'Hold longer, or punch alternately while holding.' },
    'horse-bow': { n: 'Horse-to-bow stance punches', arts: ['kungfu'], t: 'Punching', eq: 'None', lv: 'Intermediate', s: ['Start in horse stance with fists at your hips.', 'Turn into a bow stance (front knee bent, back leg straight) and punch straight forward.', 'Turn back to horse stance and repeat to the other side.'], c: 'The turn and the punch happen together.', e: 'Higher stances, slower turns.' },

    // MMA and wrestling
    'sprawl': { n: 'Sprawl', arts: ['mma', 'wrestling', 'bjj'], t: 'Wrestling', eq: 'None', lv: 'Intermediate', s: ['From your stance, shoot both legs back while dropping your hips to the floor.', 'Land on the balls of your feet with hips down and hands posted, as if flattening an opponent who shot on you.', 'Bring your feet back under you and return to stance.'], c: 'Hips down hard, legs back wide, head up.', e: 'Step back one leg at a time into a plank.' },
    'level-change': { n: 'Level change and penetration step', arts: ['mma', 'wrestling', 'bjj'], t: 'Wrestling', eq: 'None', lv: 'Intermediate', s: ['From your stance, drop your hips by bending your knees (not your back).', 'Take a deep step forward with the lead foot and let the rear knee touch down softly behind.', 'Bring the rear foot up and stand back into your stance.'], c: 'Back straight, head up, hips travel forward.', e: 'Level change only, without the step.', w: 'Use a mat or soft floor for the knee touch.' },
    'stance-motion': { n: 'Stance and motion', arts: ['wrestling', 'mma', 'bjj'], t: 'Stance & footwork', eq: 'None', lv: 'Foundation', s: ['Get into a wrestling stance: feet wide, knees bent, hips low, elbows in, hands in front.', 'Move forward, back and in circles without standing up or crossing your feet.', 'Every few seconds, add a level change or a sprawl.'], c: 'Stay low for the whole round.', e: 'Shorter bursts with rests standing up.' },
    'technical-standup': { n: 'Technical stand-up', arts: ['bjj', 'mma', 'wrestling'], t: 'Grappling movement', eq: 'None', lv: 'Foundation', s: ['Sit on the floor. Post one hand behind you and plant the opposite foot.', 'Lift your hips and swing the free leg back through under you.', 'Stand up into your stance with your front hand up to guard.'], c: 'Always keep a hand guarding your face as you rise.', e: 'Move slowly through each part.' },
    'ground-strikes': { n: 'Ground-and-pound (bag on the floor)', arts: ['mma'], t: 'Punching', eq: 'Heavy bag laid down, or shadow', lv: 'Intermediate', s: ['Kneel over a bag laid on the floor, or shadow from a kneeling top position.', 'Posture up and throw short punches down, keeping your base wide.', 'Move around the bag: change position every few strikes.'], c: 'Wide base, posture up, strike, then move.', e: 'Shadow version at half speed.', w: 'Wear gloves on the bag.' },
    'sit-out': { n: 'Sit-out', arts: ['wrestling', 'bjj', 'mma'], t: 'Grappling movement', eq: 'None', lv: 'Intermediate', s: ['Start on hands and knees.', 'Step one foot through under your body towards the other side, turning your hips so you end up sitting side-on.', 'Return to hands and knees and repeat to the other side.'], c: 'Hips turn fast; hands stay light.', e: 'Slow, one side at a time.' },

    // BJJ
    'shrimp': { n: 'Hip escape (shrimp)', arts: ['bjj', 'mma'], t: 'Grappling movement', eq: 'Mat or soft floor', lv: 'Foundation', s: ['Lie on your back, knees bent, feet flat.', 'Push off one foot and turn onto your side, driving your hips back while your hands push an imaginary opponent away.', 'Return flat and repeat to the other side, travelling across the floor.'], c: 'Hips move away; shoulders and hands stay in front.', e: 'One shrimp, pause, reset.' },
    'bridge-roll': { n: 'Bridge and roll (upa)', arts: ['bjj', 'mma', 'wrestling'], t: 'Grappling movement', eq: 'Mat or soft floor', lv: 'Foundation', s: ['Lie on your back with feet flat close to your hips.', 'Drive your hips high and turn over one shoulder, as if rolling someone off you.', 'Come back down and repeat to the other side.'], c: 'Explode from the feet and hips; look over your shoulder.', e: 'Bridge straight up and hold 2 seconds.' },
    'granby-roll': { n: 'Granby roll', arts: ['bjj', 'wrestling'], t: 'Grappling movement', eq: 'Mat', lv: 'Advanced', s: ['From your knees or sitting, tuck your chin and turn to roll across the back of your shoulders (not your neck).', 'Keep your legs tucked as you roll through.', 'Come out on your knees or into guard facing forward.'], c: 'Chin tucked, roll over the shoulders.', e: 'Practise shoulder rolls instead.', w: 'Only on a mat. Never roll over the top of your head or neck. Skip this if you have neck problems.' },
    'breakfall': { n: 'Back breakfall', arts: ['bjj', 'judo', 'wrestling'], t: 'Grappling movement', eq: 'Mat', lv: 'Foundation', s: ['Start sitting with legs out, chin tucked to your chest.', 'Roll back onto your upper back and slap the mat with both arms at about 45° from your body.', 'Roll forward to sitting; progress to starting from a squat.'], c: 'Chin tucked so your head never touches the mat.', e: 'Start lying on your back, rocking back and slapping.', w: 'Only on a mat.' },

    // Flexibility
    'lizard': { n: 'Low lunge (lizard)', arts: ['all'], t: 'Flexibility', eq: 'Mat', lv: 'Foundation', s: ['Step into a long lunge with the back knee down on a mat.', 'Place both hands inside the front foot and let the hips sink forward and down.', 'If comfortable, lower onto your forearms.'], c: 'Sink the hips; keep breathing slowly.', e: 'Stay on your hands, or put a cushion under the back knee.' },
    'couch-stretch': { n: 'Couch stretch', arts: ['all'], t: 'Flexibility', eq: 'Wall or sofa', lv: 'Intermediate', s: ['Kneel facing away from a wall or sofa, with one knee close to it and that shin running up it.', 'Step the other foot forward into a lunge.', 'Squeeze the glute of the back leg and lift your chest gradually.'], c: 'Squeeze the glute; you should feel it at the front of the hip and thigh.', e: 'Move the knee further from the wall or keep hands on the floor.' },
    'pnf-hamstring': { n: 'Contract-relax hamstring stretch', arts: ['all'], t: 'Flexibility', eq: 'Strap, belt or towel', lv: 'Intermediate', s: ['Lie on your back and loop a strap around one foot. Raise the straight leg until you feel a stretch.', 'CONTRACT: press the leg down into the strap at about half effort for 6 seconds, without moving.', 'RELAX: breathe out and gently draw the leg a little closer, then hold.'], c: 'Contract gently; relax fully; ease a little deeper.', e: 'Bend the knee slightly.', w: 'Stretch to mild tension, never sharp pain.' },
    'pnf-adductor': { n: 'Contract-relax straddle stretch', arts: ['all'], t: 'Flexibility', eq: 'Mat', lv: 'Intermediate', s: ['Sit with legs wide in a straddle, hands behind you or on the floor in front.', 'CONTRACT: press your heels down and in towards each other (without moving) at about half effort for 6 seconds.', 'RELAX: breathe out and ease slightly wider or further forward, then hold.'], c: 'Long spine, relax on the out-breath.', e: 'Narrower straddle, sitting on a cushion.' },
    'front-split-slide': { n: 'Supported front split', arts: ['all'], t: 'Flexibility', eq: 'Two chairs or yoga blocks, socks on a smooth floor', lv: 'Intermediate', s: ['From a kneeling lunge, place a hand on a support on each side.', 'Slide the front heel forward and the back knee back, taking weight in your hands.', 'Stop at a strong but comfortable stretch and hold, keeping the hips square.'], c: 'Hips square to the front; your hands take the weight.', e: 'Stay higher with more weight in the hands.', w: 'Never drop into a split. If you feel pain at the back of the knee or in the hip joint, come out.' },
    'frog': { n: 'Frog stretch', arts: ['all'], t: 'Flexibility', eq: 'Mat, cushions under the knees', lv: 'Intermediate', s: ['On hands and knees, slide your knees wide apart with ankles in line with the knees.', 'Lower onto your forearms and let the hips sink back gently.', 'Hold, breathing slowly.'], c: 'Knees and ankles in line; sink back slowly.', e: 'Knees less wide.' },
    'pancake': { n: 'Straddle fold (pancake)', arts: ['all'], t: 'Flexibility', eq: 'Mat', lv: 'Intermediate', s: ['Sit with legs in a wide straddle, knees and toes pointing up.', 'Sit tall, then hinge forward from the hips, walking your hands out.', 'Hold where you feel a good stretch.'], c: 'Fold from the hips with a long spine; do not round and force.', e: 'Sit on a cushion and bend the knees slightly.' },
    'straddle-slide': { n: 'Supported middle split', arts: ['all'], t: 'Flexibility', eq: 'Two chairs or blocks, socks on a smooth floor', lv: 'Advanced', s: ['Stand in a wide horse stance with hands on supports in front of you.', 'Slide the feet apart slowly, taking weight into your hands.', 'Stop at a strong but comfortable stretch and hold, with toes pointing forward or up.'], c: 'Hands take the weight; move a centimetre at a time.', e: 'Stay higher.', w: 'Come out immediately if you feel pain in the knees or hip joints.' },
    'cossack': { n: 'Cossack squat', arts: ['all'], t: 'Flexibility', eq: 'None', lv: 'Intermediate', s: ['Stand in a wide stance with toes turned slightly out.', 'Sit down onto one leg while the other leg straightens, toes pointing up.', 'Push back to the middle and repeat to the other side.'], c: 'Heel of the bent leg stays down; chest up.', e: 'Go only part of the way down, holding a support.' },
    'active-front-raise': { n: 'Active front leg raise', arts: ['all'], t: 'Flexibility', eq: 'Wall or chair', lv: 'Intermediate', s: ['Stand tall holding a support.', 'Keeping the leg straight, lift it in front of you as high as you can using only your muscles (no swinging).', 'Hold 2–3 seconds at the top and lower slowly.'], c: 'Strength at the top of the range is what gets kicks higher.', e: 'Bend the knee slightly.' },
    'active-side-raise': { n: 'Active side leg raise', arts: ['all'], t: 'Flexibility', eq: 'Wall or chair', lv: 'Intermediate', s: ['Stand side-on to a support.', 'Lift the outside leg to the side as high as you can without leaning over, toes pointing forward.', 'Hold 2–3 seconds and lower slowly.'], c: 'Stay upright; height comes from the hip, not leaning.', e: 'Smaller range.' },
    '90-90': { n: '90/90 hip switches', arts: ['all'], t: 'Flexibility', eq: 'Mat', lv: 'Foundation', s: ['Sit with both knees bent at 90°: one leg in front of you, the other out to the side.', 'Keeping your feet on the floor, rotate both knees over to the other side.', 'Sit tall and keep switching slowly.'], c: 'Slow and controlled; use your hands behind you if needed.', e: 'Hands on the floor behind you.' },

    // Running
    'easy-run': { n: 'Easy run', arts: ['all'], t: 'Running', eq: 'Trainers', lv: 'Foundation', s: ['Run at a comfortable, steady pace.', 'You should be able to talk in full sentences.', 'Slow down or walk if your breathing gets heavy.'], c: 'Conversation pace: easy runs build the engine that helps you recover between rounds.', e: 'Alternate running and walking.' },
    'hard-run': { n: 'Hard interval', arts: ['all'], t: 'Running', eq: 'Trainers', lv: 'Intermediate', s: ['Run hard, at an effort of about 8 out of 10.', 'Keep the pace even for the whole interval; do not sprint the start.', 'Breathing will be heavy; talking should be difficult.'], c: 'Hard but steady, like a tough round.', e: 'Run at 6–7 out of 10.' },
    'recovery-jog': { n: 'Recovery jog or walk', arts: ['all'], t: 'Running', eq: 'Trainers', lv: 'Foundation', s: ['Slow right down to an easy jog or a walk.', 'Let your breathing settle.', 'Be ready to go again when the timer says.'], c: 'Recover properly so the next effort is good quality.', e: 'Walk.' },
    'hill-sprint': { n: 'Hill sprint', arts: ['all'], t: 'Running', eq: 'A hill (or flat ground)', lv: 'Intermediate', s: ['Sprint up the hill at near-maximum effort, driving your knees and arms.', 'Lean slightly into the hill; stay tall.', 'Walk back down slowly: that is your recovery.'], c: 'Short and fast; full effort, then full recovery.', e: 'Run strides at 80% effort on flat ground.', w: 'Warm up fully first. Stop if you feel a pull in the hamstring or calf.' },
    'sprint': { n: 'Sprint interval', arts: ['all'], t: 'Running', eq: 'Trainers, or exercise bike', lv: 'Advanced', s: ['After a full warm-up, go as hard as you can for the whole interval.', 'Running, cycling or a hill all work.', 'Recover completely with easy movement.'], c: 'All-out effort; quality over quantity.', e: 'Reduce the number of repeats.', w: 'Only if you are already used to regular exercise.' },
    'run': { n: 'Run', arts: ['all'], t: 'Running', eq: 'Trainers', lv: 'Foundation', s: ['Run at a gentle pace you could keep going with.', 'Short steps, relaxed shoulders.', 'It is fine to go slowly.'], c: 'Slow is fine: finishing the interval is the goal.', e: 'Walk briskly instead.' }
  };

  // ---- Disciplines ----
  const arts = [
    { id: 'boxing', name: 'Boxing', image: 'boxing', about: 'Footwork, the jab, combinations and defence, with the conditioning to last the rounds. Three-minute rounds with one minute of rest match the professional format.', week: 'A good week: 3 boxing sessions (shadow, bag, defence), 2–3 roadwork runs, 2 strength sessions from the Library, and at least 1 full rest day.' },
    { id: 'muaythai', name: 'Muay Thai', image: 'muay-thai', about: 'The art of eight limbs: punches, kicks, knees and elbows, plus the clinch. Thai camps build their days around running, skipping, shadowboxing, pads, bag work and clinching.', week: 'A good week: 3–4 Muay Thai sessions, 2–3 runs (Thai fighters run most mornings), 2 flexibility sessions for kicks, and 1 rest day.' },
    { id: 'kickboxing', name: 'Kickboxing', image: 'kickboxing', about: 'Boxing combinations finished with kicks, with fast footwork and checks against low kicks.', week: 'A good week: 3 kickboxing sessions, 2 runs, 2 strength sessions and 2 flexibility sessions.' },
    { id: 'mma', name: 'MMA', image: 'mma', about: 'Striking, wrestling and ground work in one sport. Five-minute rounds need a strong aerobic base plus repeated explosive efforts: sprawls, shots and scrambles.', week: 'A good week: 2 striking sessions, 2 wrestling or grappling sessions, 1 MMA conditioning session, 2 runs and 2 strength sessions, spread so hard days are followed by easier ones.' },
    { id: 'bjj', name: 'BJJ & grappling', image: 'bjj', about: 'Solo movement drills are the building blocks of every escape and transition: shrimping, bridging, stand-ups and rolls.', week: 'A good week: 2–3 classes or rolling sessions, 2 solo movement sessions, 2 strength sessions and 1 flexibility session.' },
    { id: 'wrestling', name: 'Wrestling', image: 'mma', about: 'Stance, motion, level changes, shots and sprawls: the solo homework of every wrestling room, and relentless conditioning.', week: 'A good week: 3 wrestling sessions, 2 strength sessions, 2 runs including hill sprints, and 1 rest day.' },
    { id: 'karate', name: 'Karate', image: 'karate', about: 'Kihon, the basics: stances, punches, blocks and kicks, drilled with precision and speed.', week: 'A good week: 3 kihon sessions, 2 flexibility sessions for kicks, 2 strength or conditioning sessions.' },
    { id: 'taekwondo', name: 'Taekwondo', image: 'kickboxing', about: 'Fast, high, precise kicking. Chamber control, speed and flexibility come first.', week: 'A good week: 3 kicking sessions, 3 flexibility sessions (splits programme), 2 strength sessions for the legs and core.' },
    { id: 'kungfu', name: 'Kung Fu & Sanda', image: 'karate', about: 'Stance strength from traditional kung fu, and the kicks and punches of Sanda, China’s full-contact sport.', week: 'A good week: 2 stance-strength sessions, 2 Sanda sessions, 2 flexibility sessions and 2 runs.' }
  ];

  // ---- Warm-ups and cool-downs (id, seconds) ----
  const warmups = {
    striking: [['skip-rope', 180], ['arm-circles', 45], ['hip-openers', 60], ['leg-swings-front', 45], ['leg-swings-side', 45], ['shadow-bounce', 90]],
    kicking: [['skip-rope', 150], ['hip-openers', 60], ['leg-swings-front', 60], ['leg-swings-side', 60], ['chamber-hold', 60], ['shadow-bounce', 60]],
    grappling: [['jog-in-place', 120], ['arm-circles', 45], ['hip-openers', 60], ['inchworm', 60], ['bridge', 45], ['bear-crawl', 45]],
    flexibility: [['jog-in-place', 180], ['leg-swings-front', 60], ['leg-swings-side', 60], ['hip-openers', 60]],
    running: [['walk', 300]]
  };
  const cooldowns = {
    upper: [['walk', 60], ['chest-stretch', 60], ['upper-back-stretch', 60], ['hamstring-stretch', 60], ['hip-flexor-stretch', 60]],
    legs: [['walk', 60], ['hamstring-stretch', 60], ['quad-stretch', 60], ['hip-flexor-stretch', 60], ['glute-stretch', 60], ['butterfly-stretch', 60]],
    running: [['walk', 300], ['calf-stretch', 60], ['hamstring-stretch', 60], ['quad-stretch', 60]]
  };

  // ---- Round-based sessions ----
  // plan: one entry per round: [drill id, focus for the round]
  const sessions = [
    // Boxing
    { id: 'box-fundamentals', art: 'boxing', name: 'Shadowboxing fundamentals', level: 'Beginner', eq: 'No equipment', free: true, warmup: 'striking', cooldown: 'upper', work: 120, rest: 60,
      about: 'Build the basics round by round: stance, footwork, the jab, the one-two and your first defence.',
      plan: [['stance-footwork', 'Step-drag forward, back and to both sides. Keep the same stance width.'], ['jab', 'Jab only. Step in with some, stay still for others. Hand straight back to your face.'], ['cross', '1-2 (jab, cross). Rear foot turns, hand returns to chin.'], ['lead-hook', '1-2-3 (jab, cross, lead hook). Turn the body for the hook.'], ['slip', 'Slip outside an imaginary jab, then answer with 1-2.'], ['stance-footwork', 'Free round: move, jab, 1-2, 1-2-3 and slips. Stay relaxed.']] },
    { id: 'box-bag', art: 'boxing', name: 'Heavy bag: power and volume', level: 'Intermediate', eq: 'Heavy bag, wraps and gloves', warmup: 'striking', cooldown: 'upper', work: 180, rest: 60,
      about: 'Classic three-minute bag rounds mixing technique, power shots and high-volume bursts.',
      plan: [['bag-work', 'Find your range: jabs and 1-2s, moving round the bag after each.'], ['bag-work', '1-2-3 and 1-1-2. Punch through the bag and step off to the side.'], ['body-shots', 'Body-head: 1-2 to the body, then 3 (hook) to the head.'], ['bag-work', 'Power round: single hard shots, full reset between each. Quality over speed.'], ['punch-out', 'Volume: 20 seconds of non-stop straight punches, 10 seconds of moving. Repeat.'], ['slip', 'Defence then attack: slip or roll, then counter 2-3-2.'], ['bag-work', 'Your best combinations, 3–5 punches, then move.'], ['bag-work', 'Last round: every 30 seconds, a 10-second all-out flurry.']] },
    { id: 'box-defence', art: 'boxing', name: 'Footwork and defence', level: 'Intermediate', eq: 'No equipment', warmup: 'striking', cooldown: 'upper', work: 180, rest: 60,
      about: 'Hard to hit, easy to counter: pivots, angles, slips, rolls and parries.',
      plan: [['pivot', 'Jab, then pivot off the line. Alternate directions.'], ['slip', 'Slip-slip-counter: slip the jab, slip the cross, answer with 2-3.'], ['roll', 'Roll under imaginary hooks and come up throwing.'], ['parry', 'Catch or parry the jab, return your own jab straight away.'], ['stance-footwork', 'In and out: step in with a combination, step out before the return.'], ['slip', 'Free defence round: mix all defences, always answer back.']] },
    { id: 'box-conditioning', art: 'boxing', name: 'Fight-pace conditioning', level: 'Advanced', eq: 'No equipment (bag optional)', warmup: 'striking', cooldown: 'upper', work: 180, rest: 60,
      about: 'Rounds that mix technical shadowboxing with fight-pace bursts, to build the engine for late rounds.',
      plan: [['shadow-bounce', 'Steady shadowboxing with 20-second fast bursts every minute.'], ['punch-out', 'Alternate 30 seconds of punch-outs with 30 seconds of footwork.'], ['burpee', '1-2-3 on every burpee: 5 burpees, 20 seconds of shadow, repeat.'], ['body-shots', 'Level changes: 1-2 to the body, 1-2 to the head, non-stop.'], ['punch-out', '10 seconds all-out, 20 seconds steady, all round.'], ['shadow-bounce', 'Championship round: your fastest, cleanest work.']],
      finisher: [['plank', 45], ['rest', 15], ['mountain-climber', 30], ['rest', 15], ['side-plank', 30], ['rest', 15], ['plank', 45]] },

    // Muay Thai
    { id: 'mt-fundamentals', art: 'muaythai', name: 'Muay Thai shadow fundamentals', level: 'Beginner', eq: 'No equipment', free: true, warmup: 'kicking', cooldown: 'legs', work: 180, rest: 60,
      about: 'Stance, rhythm, the teep, the roundhouse and knees, the weapons every Muay Thai fighter builds on.',
      plan: [['mt-stance', 'Stance and rhythm: step forward, back and around, lifting the lead leg to check every few steps.'], ['teep', 'Teeps: lead-leg teep, then rear-leg teep. Knee up first.'], ['roundhouse', 'Roundhouse kicks to the body, alternating sides. Turn the hip over.'], ['knee-straight', 'Jab, cross, then a rear knee.'], ['mt-stance', 'Free round: punches, teeps, kicks and knees with your guard high.']] },
    { id: 'mt-bag', art: 'muaythai', name: 'Kicks and knees on the bag', level: 'Intermediate', eq: 'Heavy bag, wraps, gloves (shin guards optional)', warmup: 'kicking', cooldown: 'legs', work: 180, rest: 60,
      about: 'Build kicking power and endurance: teeps, body kicks, low kicks, switch kicks and knees.',
      plan: [['teep', 'Teep the bag, reset, teep again. Lead and rear leg.'], ['roundhouse', 'Body kicks, alternating legs. Return to stance after each kick.'], ['roundhouse', 'Jab-cross-kick (1-2 then rear roundhouse).'], ['low-kick', 'Low kicks to the bottom of the bag, set up with a jab.'], ['switch-kick', 'Switch kicks, then a 1-2 as you land.'], ['clinch-knees', 'Clinch knees: hold the top of the bag and drive alternating knees.']] },
    { id: 'mt-clinch', art: 'muaythai', name: 'Clinch and knee conditioning', level: 'Intermediate', eq: 'No equipment (bag optional)', warmup: 'kicking', cooldown: 'legs', work: 180, rest: 60,
      about: 'Solo work for the clinch game: posture, knees and elbows, finishing with core strength.',
      plan: [['clinch-knees', 'Plum position, alternating knees, turning your imaginary opponent every 4 knees.'], ['knee-straight', 'Step-in knees: step forward and drive the rear knee.'], ['elbows', 'Close range: hook, then horizontal elbow. Uppercut, then uppercut elbow.'], ['check', 'Check a low kick and answer with a teep or kick.'], ['clinch-knees', '20 seconds of fast knees, 10 seconds of posture. Repeat.']],
      finisher: [['plank', 40], ['rest', 20], ['side-plank', 30], ['rest', 15], ['bridge', 45], ['rest', 15], ['dead-bug', 40]] },
    { id: 'mt-fight-rounds', art: 'muaythai', name: 'Thai-style fight rounds', level: 'Advanced', eq: 'Heavy bag (or shadow)', warmup: 'kicking', cooldown: 'legs', work: 180, rest: 120,
      about: 'Five three-minute rounds with two minutes of rest, the Thai professional format. Start measured, build to a big finish.',
      plan: [['mt-stance', 'Round 1: feel it out. Teeps and jabs, relaxed rhythm.'], ['roundhouse', 'Round 2: start scoring. Kicks and teeps, check everything.'], ['clinch-knees', 'Round 3: the busiest round. Kicks, knees and clinch work.'], ['roundhouse', 'Round 4: keep the pressure. Combinations finished with kicks.'], ['mt-stance', 'Round 5: controlled. Teeps and clean kicks, stay composed.']] },

    // Kickboxing
    { id: 'kb-fundamentals', art: 'kickboxing', name: 'Kickboxing combinations', level: 'Beginner', eq: 'No equipment', free: true, warmup: 'kicking', cooldown: 'legs', work: 180, rest: 60,
      about: 'Put hands and feet together: every combination finishes with a kick.',
      plan: [['stance-footwork', 'Footwork with jab and 1-2.'], ['low-kick', '1-2, rear low kick.'], ['roundhouse', '1-2-3, rear roundhouse to the body.'], ['teep', 'Jab-teep and teep-jab: use the teep to keep range.'], ['check', 'Check the low kick, then 1-2-low kick back.'], ['roundhouse', 'Free round mixing all your combinations.']] },
    { id: 'kb-speed', art: 'kickboxing', name: 'Speed and switch kicks', level: 'Intermediate', eq: 'No equipment (bag optional)', warmup: 'kicking', cooldown: 'legs', work: 120, rest: 45,
      about: 'Short, sharp rounds for fast hands and fast legs.',
      plan: [['rapid-kicks', 'Rapid roundhouse kicks at body height, switch legs halfway.'], ['switch-kick', 'Switch kick, then 1-2.'], ['punch-out', 'Punch-out 15 seconds, footwork 15 seconds.'], ['high-kick', '1-2 to high kick (only as high as is controlled).'], ['rapid-kicks', 'Rapid teeps, alternating legs.'], ['roundhouse', 'Everything fast: combinations finished with a kick.']] },

    // MMA
    { id: 'mma-fundamentals', art: 'mma', name: 'MMA movement fundamentals', level: 'Beginner', eq: 'Mat or soft floor', free: true, warmup: 'grappling', cooldown: 'legs', work: 180, rest: 60,
      about: 'The movements that link striking and grappling: stance, level changes, sprawls and getting back up.',
      plan: [['stance-footwork', 'MMA stance: slightly wider and lower than boxing. Jab and 1-2 with movement.'], ['level-change', 'Level changes and penetration steps. Back straight.'], ['sprawl', '1-2, sprawl, back to stance.'], ['technical-standup', 'Technical stand-ups, alternating sides.'], ['stance-motion', 'Free round: strike, change levels, sprawl and stand up.']] },
    { id: 'mma-sprawl-brawl', art: 'mma', name: 'Sprawl and brawl', level: 'Intermediate', eq: 'Mat (bag optional)', warmup: 'grappling', cooldown: 'legs', work: 300, rest: 60,
      about: 'Five-minute MMA rounds: strike, defend the takedown, get back to striking.',
      plan: [['stance-footwork', 'Striking with a sprawl every 30 seconds.'], ['sprawl', '1-2-3, sprawl, back up and strike.'], ['level-change', 'Feint the shot, then strike. Mix real shots and feints.'], ['ground-strikes', 'Sprawl, then ground strikes for 10 seconds, then stand up.'], ['stance-footwork', 'Free round: everything, at fight pace in bursts.']] },
    { id: 'mma-conditioning', art: 'mma', name: 'MMA conditioning: 5 x 5', level: 'Advanced', eq: 'Mat', warmup: 'grappling', cooldown: 'legs', work: 300, rest: 60,
      about: 'Mixed-intensity rounds matching the MMA pattern of short explosive efforts with lower-intensity movement in between.',
      plan: [['sprawl', '10 seconds of sprawls, then 20 seconds of light shadow. Repeat.'], ['ground-strikes', '20 seconds ground strikes, 10 seconds technical stand-up. Repeat.'], ['burpee', '5 burpees, 5 penetration steps, 30 seconds of shadow. Repeat.'], ['bear-crawl', '20 seconds bear crawl, 20 seconds of stance and motion. Repeat.'], ['stance-footwork', 'Final round: 10-second all-out striking bursts every 30 seconds.']] },

    // BJJ
    { id: 'bjj-movement', art: 'bjj', name: 'BJJ solo movement', level: 'Beginner', eq: 'Mat or soft floor', free: true, warmup: 'grappling', cooldown: 'legs', work: 120, rest: 60,
      about: 'The movements that power every escape: shrimping, bridging, stand-ups and breakfalls.',
      plan: [['shrimp', 'Shrimp the length of the mat and back.'], ['bridge-roll', 'Bridge and roll, alternating sides.'], ['technical-standup', 'Technical stand-ups, alternating sides.'], ['breakfall', 'Back breakfalls from sitting, then from a squat.'], ['sit-out', 'Sit-outs, alternating sides.'], ['shrimp', 'Flow round: shrimp, bridge, stand up, and back down.']] },
    { id: 'bjj-conditioning', art: 'bjj', name: 'Grappling conditioning', level: 'Intermediate', eq: 'Mat', warmup: 'grappling', cooldown: 'legs', work: 180, rest: 60,
      about: 'Rounds that feel like rolling: constant movement, grip and hip strength, and scrambles.',
      plan: [['shrimp', 'Fast shrimps, 30 seconds; bridges, 30 seconds.'], ['bear-crawl', 'Bear crawl forward and back, with a sprawl every 20 seconds.'], ['sit-out', 'Sit-outs then technical stand-up, non-stop.'], ['bridge-roll', 'Bridge and roll, then shrimp away, repeat.'], ['sprawl', 'Scramble round: sprawl, sit-out, stand up, repeat.']] },
    { id: 'bjj-advanced', art: 'bjj', name: 'Advanced movement and rolls', level: 'Advanced', eq: 'Mat', warmup: 'grappling', cooldown: 'legs', work: 120, rest: 60,
      about: 'Inversions and rolls for experienced grapplers, on a proper mat.',
      plan: [['granby-roll', 'Granby rolls across the mat, chin tucked.'], ['shrimp', 'Reverse shrimps (moving head first).'], ['sit-out', 'Sit-out to technical stand-up.'], ['granby-roll', 'Granby roll into shrimp, alternating sides.'], ['bridge-roll', 'Flow: bridge, roll, shrimp, stand up.']] },

    // Wrestling
    { id: 'wr-fundamentals', art: 'wrestling', name: 'Stance, motion and shots', level: 'Beginner', eq: 'Mat or soft floor', free: true, warmup: 'grappling', cooldown: 'legs', work: 120, rest: 60,
      about: 'The daily homework of the wrestling room.',
      plan: [['stance-motion', 'Stance and motion: forward, back, circles. Stay low.'], ['level-change', 'Penetration steps, alternating lead leg.'], ['sprawl', 'Sprawls: hips down hard, back to stance.'], ['stance-motion', 'Motion with a level change every 5 seconds.'], ['sit-out', 'Sit-outs, alternating sides.'], ['stance-motion', 'Free round: motion, shots, sprawls.']] },
    { id: 'wr-conditioning', art: 'wrestling', name: 'Wrestling conditioning', level: 'Advanced', eq: 'Mat', warmup: 'grappling', cooldown: 'legs', work: 120, rest: 30,
      about: 'Short rest, relentless pace: the conditioning wrestling is known for.',
      plan: [['sprawl', 'Sprawl every 5 seconds.'], ['level-change', 'Shot, stand, shot. Non-stop.'], ['burpee', 'Burpees with a sprawl landing.'], ['bear-crawl', 'Bear crawl with a sit-out every 10 seconds.'], ['stance-motion', 'Motion at full pace.'], ['sprawl', 'Last round: sprawl and shoot, everything you have.']] },

    // Karate
    { id: 'ka-kihon', art: 'karate', name: 'Kihon basics', level: 'Beginner', eq: 'No equipment', free: true, warmup: 'kicking', cooldown: 'legs', work: 120, rest: 45,
      about: 'Stances, punches, blocks and kicks: the foundations of every karate style.',
      plan: [['zenkutsu', 'Step forward and back in front stance.'], ['oi-zuki', 'Stepping punches up and down the room.'], ['gyaku-zuki', 'Reverse punch from a still stance, hip first.'], ['karate-blocks', 'Rising, outside and downward blocks, stepping.'], ['front-kick', 'Front kicks from front stance, alternating legs.'], ['gyaku-zuki', 'Combination: block, reverse punch, front kick.']] },
    { id: 'ka-speed', art: 'karate', name: 'Kumite speed', level: 'Intermediate', eq: 'No equipment', warmup: 'kicking', cooldown: 'legs', work: 120, rest: 60,
      about: 'Fast, sharp techniques for sparring: explosive entries and quick returns.',
      plan: [['shadow-bounce', 'Light bouncing footwork with sudden entries.'], ['gyaku-zuki', 'Jab then reverse punch, explode in and back out.'], ['snap-roundhouse', 'Roundhouse kicks at body height, snapping back.'], ['rapid-kicks', 'Rapid front kicks, alternating legs.'], ['gyaku-zuki', 'Free round: fast entries, one to three techniques, then out.']] },

    // Taekwondo
    { id: 'tkd-kicks', art: 'taekwondo', name: 'Kicking control and speed', level: 'Beginner', eq: 'Wall for balance', free: true, warmup: 'kicking', cooldown: 'legs', work: 120, rest: 60,
      about: 'Chamber control first, then speed: the Taekwondo way to higher, faster kicks.',
      plan: [['chamber-hold', 'Chamber holds: front, side and roundhouse chambers, 5–10 seconds each.'], ['front-kick', 'Front kicks, snapping back to the chamber.'], ['snap-roundhouse', 'Roundhouse kicks: point the knee, pivot, snap.'], ['side-kick', 'Side kicks: heel, hip and shoulder in line.'], ['rapid-kicks', 'Rapid roundhouse kicks, switch legs halfway.'], ['snap-roundhouse', 'Free round: combinations of two kicks.']] },
    { id: 'tkd-power', art: 'taekwondo', name: 'Height and power kicking', level: 'Advanced', eq: 'Wall for balance, bag optional', warmup: 'kicking', cooldown: 'legs', work: 120, rest: 60,
      about: 'Kicks at head height with control, and the leg strength to hold them.',
      plan: [['active-front-raise', 'Active front leg raises: slow, 3-second holds at the top.'], ['side-kick', 'Slow side kicks: extend and hold for 3 seconds.'], ['high-kick', 'Head-height roundhouse kicks, only as high as controlled.'], ['rapid-kicks', 'Double kicks: two roundhouses without putting the foot down.'], ['snap-roundhouse', 'Free round: speed and height together.']] },

    // Kung Fu and Sanda
    { id: 'kf-stances', art: 'kungfu', name: 'Kung fu stance strength', level: 'Beginner', eq: 'No equipment', free: true, warmup: 'kicking', cooldown: 'legs', work: 90, rest: 45,
      about: 'Traditional stance training builds the legs and balance that power every technique.',
      plan: [['horse-stance', 'Horse stance hold. Stand up briefly if you need to, then sink back in.'], ['horse-bow', 'Horse to bow stance with punches, alternating sides.'], ['horse-stance', 'Horse stance with alternating straight punches.'], ['front-kick', 'Bow stance to front kick, alternating legs.'], ['horse-stance', 'Final hold: as low and still as you can.']] },
    { id: 'kf-sanda', art: 'kungfu', name: 'Sanda kicks and punches', level: 'Intermediate', eq: 'No equipment (bag optional)', warmup: 'kicking', cooldown: 'legs', work: 180, rest: 60,
      about: 'The modern fighting side of kung fu: side kicks, roundhouses and punches, with throws practised as shadow sprawls.',
      plan: [['stance-footwork', 'Sanda stance and footwork, jab and cross.'], ['side-kick', 'Lead-leg side kicks to keep range.'], ['roundhouse', 'Rear roundhouse to the body, then 1-2.'], ['sprawl', 'Punch-punch-side kick, then sprawl.'], ['side-kick', 'Free round: kicks to keep range, punches when close.']] }
  ];

  // ---- Multi-week programmes ----
  // Each returns an array of weeks; each week is a list of sessions with timed phases.

  function splitsWeek(week) {
    const hold = week <= 2 ? 30 : week <= 4 ? 45 : 60;
    const sets = week <= 5 ? 2 : 3;
    const cycles = week <= 3 ? 2 : 3;
    const pnf = drill => {
      const out = [];
      for (let i = 0; i < cycles; i++) out.push({ id: drill, kind: 'Stretch', seconds: 20 }, { id: drill, kind: 'Contract', seconds: 6, focus: 'Press at about half effort, no movement.' }, { id: drill, kind: 'Relax', seconds: 25, focus: 'Breathe out, ease a little deeper and hold.' });
      return out;
    };
    const sides = (drill, secs, n = sets) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push({ id: drill, kind: 'Hold', seconds: secs, focus: 'Left side' }, { id: drill, kind: 'Hold', seconds: secs, focus: 'Right side' });
      return out;
    };
    const both = (drill, secs, n = sets) => Array.from({ length: n }, () => ({ id: drill, kind: 'Hold', seconds: secs }));
    const warm = warmups.flexibility.map(([id, seconds]) => ({ id, kind: 'Warm-up', seconds }));
    const front = { name: 'Front split and hamstrings', focus: 'Front split', phases: [
      ...warm,
      ...sides('lizard', hold, 1),
      ...sides('couch-stretch', hold, 1),
      ...pnf('pnf-hamstring').map(p => ({ ...p, focus: (p.focus ? p.focus + ' ' : '') + 'Left leg.' })),
      ...pnf('pnf-hamstring').map(p => ({ ...p, focus: (p.focus ? p.focus + ' ' : '') + 'Right leg.' })),
      ...sides('half-split', hold),
      ...sides('front-split-slide', hold),
      { id: 'active-front-raise', kind: 'Active', seconds: 45, focus: 'Left leg: slow raises, hold 2–3 seconds at the top.' },
      { id: 'active-front-raise', kind: 'Active', seconds: 45, focus: 'Right leg.' }
    ] };
    const middle = { name: 'Middle split and hips', focus: 'Middle split', phases: [
      ...warm,
      ...both('butterfly-stretch', hold, 1),
      ...both('frog', hold),
      ...pnf('pnf-adductor'),
      ...both('pancake', hold),
      { id: 'cossack', kind: 'Active', seconds: 60, focus: 'Slow, alternating sides.' },
      ...both('straddle-slide', hold),
      { id: 'active-side-raise', kind: 'Active', seconds: 45, focus: 'Left leg.' },
      { id: 'active-side-raise', kind: 'Active', seconds: 45, focus: 'Right leg.' },
      { id: 'horse-stance', kind: 'Hold', seconds: week <= 4 ? 30 : 45, focus: 'Strength at the end of range.' },
      { id: '90-90', kind: 'Active', seconds: 60 }
    ] };
    return [
      { day: 'Day 1', ...front }, { day: 'Day 2', ...middle }, { day: 'Day 4', ...front }, { day: 'Day 5', ...middle }
    ];
  }

  function roadworkWeek(week) {
    const warm = [{ id: 'walk', kind: 'Warm-up', seconds: 300 }, { id: 'easy-run', kind: 'Warm-up', seconds: 300, focus: 'Very easy jog.' }];
    const cool = [{ id: 'walk', kind: 'Cool-down', seconds: 300 }, { id: 'calf-stretch', kind: 'Cool-down', seconds: 60 }, { id: 'hamstring-stretch', kind: 'Cool-down', seconds: 60 }];
    const easyMinutes = [20, 22, 25, 22, 28, 30, 32, 25][week - 1];
    const easy = { name: 'Easy aerobic run', focus: `${easyMinutes} minutes at conversation pace`, phases: [{ id: 'walk', kind: 'Warm-up', seconds: 300 }, { id: 'easy-run', kind: 'Run', seconds: easyMinutes * 60 }, ...cool] };
    let intervals;
    if (week <= 3) {
      const reps = [6, 8, 10][week - 1];
      const ph = [...warm];
      for (let i = 0; i < reps; i++) ph.push({ id: 'hill-sprint', kind: 'Sprint', seconds: 10, round: i + 1, focus: `Sprint ${i + 1} of ${reps}.` }, { id: 'recovery-jog', kind: 'Recover', seconds: 80, focus: 'Walk back down.' });
      intervals = { name: 'Hill sprints', focus: `${reps} x 10-second sprints, walk-back recovery`, phases: [...ph, ...cool] };
    } else if (week <= 7) {
      const reps = [4, 5, 6, 6][week - 4];
      const ph = [...warm];
      for (let i = 0; i < reps; i++) ph.push({ id: 'hard-run', kind: 'Round', seconds: 180, round: i + 1, focus: `Round ${i + 1} of ${reps}: hard and even.` }, { id: 'recovery-jog', kind: 'Recover', seconds: 60 });
      intervals = { name: 'Round intervals', focus: `${reps} x 3-minute hard rounds, 1 minute easy`, phases: [...ph, ...cool] };
    } else {
      const ph = [...warm];
      for (let set = 0; set < 2; set++) {
        for (let i = 0; i < 6; i++) ph.push({ id: 'sprint', kind: 'Sprint', seconds: 20, round: set * 6 + i + 1, focus: `Set ${set + 1}, sprint ${i + 1} of 6.` }, { id: 'recovery-jog', kind: 'Recover', seconds: 10 });
        if (set === 0) ph.push({ id: 'recovery-jog', kind: 'Recover', seconds: 210, focus: 'Easy movement before set 2.' });
      }
      intervals = { name: 'Sharpening sprints', focus: '2 sets of 6 x 20 seconds hard, 10 seconds easy', phases: [...ph, ...cool] };
    }
    let third;
    if (week <= 5) {
      const reps = [4, 4, 5, 5, 6][week - 1];
      const ph = [...warm];
      for (let i = 0; i < reps; i++) ph.push({ id: 'sprint', kind: 'Sprint', seconds: 30, round: i + 1, focus: `All-out effort ${i + 1} of ${reps}.` }, { id: 'recovery-jog', kind: 'Recover', seconds: 240, focus: 'Full recovery: walk or very easy jog.' });
      third = { name: 'Sprint intervals', focus: `${reps} x 30 seconds all-out, 4 minutes recovery`, phases: [...ph, ...cool] };
    } else {
      const reps = week === 8 ? 3 : 4;
      const ph = [...warm];
      for (let i = 0; i < reps; i++) ph.push({ id: 'hard-run', kind: 'Round', seconds: 240, round: i + 1, focus: `Effort ${i + 1} of ${reps}: about 9 out of 10.` }, { id: 'recovery-jog', kind: 'Recover', seconds: 120 });
      third = { name: 'Long intervals', focus: `${reps} x 4 minutes very hard, 2 minutes easy`, phases: [...ph, ...cool] };
    }
    return [{ day: 'Day 1', ...easy }, { day: 'Day 3', ...intervals }, { day: 'Day 5', ...third }];
  }

  function runWalkWeek(week) {
    const pattern = [
      [[60, 90, 8]],
      [[90, 120, 6]],
      [[90, 90, 2], [180, 180, 2]],
      [[180, 90, 1], [300, 150, 1], [180, 90, 1], [300, 0, 1]],
      [[300, 120, 1], [480, 120, 1], [300, 0, 1]],
      [[600, 180, 1], [600, 0, 1]],
      [[1200, 0, 1]],
      [[1500, 0, 1]],
      [[1800, 0, 1]]
    ][week - 1];
    const phases = [{ id: 'walk', kind: 'Warm-up', seconds: 300, focus: 'Brisk walk.' }];
    let n = 0;
    for (const [run, walk, reps] of pattern) for (let i = 0; i < reps; i++) {
      phases.push({ id: 'run', kind: 'Run', seconds: run, round: ++n });
      if (walk) phases.push({ id: 'walk', kind: 'Walk', seconds: walk });
    }
    phases.push({ id: 'walk', kind: 'Cool-down', seconds: 300 });
    const runMin = pattern.reduce((t, [r, , reps]) => t + r * reps, 0) / 60;
    const s = { name: `Week ${week} run`, focus: `${Math.round(runMin)} minutes of running in total`, phases };
    return [{ day: 'Day 1', ...s }, { day: 'Day 3', ...s }, { day: 'Day 5', ...s }];
  }

  const programmes = [
    { id: 'splits', name: 'Splits and high kicks', weeks: 8, perWeek: 4, image: 'half-split', freeWeeks: [1],
      about: 'A proper flexibility programme for kicks: long holds, contract-relax stretching and active strength at the end of your range, building every two weeks.',
      how: 'Four sessions a week (front split days and middle split days). Holds build from 30 to 60 seconds and sets from 2 to 3. Stretch to strong but comfortable tension, never pain. Do these after training or as a separate session, not right before sparring or explosive work.',
      build: splitsWeek },
    { id: 'roadwork', name: 'Fighter roadwork', weeks: 8, perWeek: 3, image: 'walk', freeWeeks: [1],
      about: 'The running fighters use: easy runs for the aerobic base that recovers you between rounds, plus hill sprints, sprint intervals and three-minute round intervals.',
      how: 'Three runs a week with a rest or technique day between. Weeks 1–3 build speed with hill sprints, weeks 4–7 add fight-length intervals, week 8 sharpens with short sprints. Easy runs stay easy.',
      build: roadworkWeek },
    { id: 'run-walk', name: 'Run-walk starter', weeks: 9, perWeek: 3, image: 'walk', freeWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      about: 'New to running? Build from one-minute runs to 30 minutes of continuous running over nine weeks.',
      how: 'Three runs a week with a rest day between each. Every run starts and finishes with a five-minute brisk walk. Repeat a week if it felt too hard.',
      build: runWalkWeek }
  ];

  const getDrill = id => drills[id] || null;
  const sessionSeconds = s => {
    const w = (warmups[s.warmup] || []).reduce((t, [, sec]) => t + sec, 0);
    const c = (cooldowns[s.cooldown] || []).reduce((t, [, sec]) => t + sec, 0);
    const f = (s.finisher || []).reduce((t, [, sec]) => t + sec, 0);
    return w + s.plan.length * s.work + (s.plan.length - 1) * s.rest + f + c;
  };

  // Timed phases for the round timer
  function buildSession(s) {
    const phases = (warmups[s.warmup] || []).map(([id, seconds]) => ({ id, kind: 'Warm-up', seconds }));
    s.plan.forEach(([id, focus], i) => {
      phases.push({ id, kind: 'Round', seconds: s.work, round: i + 1, of: s.plan.length, focus });
      if (i < s.plan.length - 1) phases.push({ id: s.plan[i + 1][0], kind: 'Rest', seconds: s.rest, round: i + 1, focus: `Next: ${s.plan[i + 1][1]}` });
    });
    (s.finisher || []).forEach(([id, seconds]) => phases.push({ id, kind: id === 'rest' ? 'Rest' : 'Finisher', seconds }));
    (cooldowns[s.cooldown] || []).forEach(([id, seconds]) => phases.push({ id, kind: 'Cool-down', seconds }));
    return phases;
  }

  return { drills, arts, sessions, programmes, warmups, cooldowns, getDrill, sessionSeconds, buildSession };
})();
if (typeof module !== 'undefined') module.exports = FightData;
