# FightHub immersive 3D hero: master brief

This is the FightHub version of the "immersive 3D website" master prompt. It is
the brief for the hero at the top of www.fighthub.world. The rest of the
homepage (next fight night, news, fighters, martial arts, clubs, events, the app
section and the footer) stays exactly as it is, and the visitor scrolls straight
into it when the journey ends.

Built version: `hero3d/` (hero3d.js, hero3d.css, the Bebas Neue 3D font) and the
preview page `preview-hero.html`.

## The idea

Do not show a normal hero with a headline and a photo. Put the visitor inside
the fight world and let scrolling move a camera through it, as one continuous
journey with no hard cuts.

It starts in a dark, empty arena with one spotlit boxing ring. The visitor steps
through the ropes, the FightHub logo on the canvas becomes a portal, and they
dive through it into a tunnel of glowing ring squares. Inside are three chapters
built around giant 3D words:

- **FOLLOW**: the fight world (news, fight nights, rankings, fighters)
- **LEARN**: every martial art, and clubs near you
- **TRAIN**: the Fight Hub app

Everything then converges on **FIGHT HUB** and the call to action.

What the visitor should understand by the end:

> "Everything about fighting is here: I can follow the sport, learn any martial
> art, find a club and train like a fighter with the app."

It should feel premium, cinematic, bold and minimal, and it should be worth
screen-recording and sharing.

## Story and content (in order)

1. FightHub is the home of combat sports: boxing, MMA, Muay Thai, BJJ and every
   martial art.
2. Follow the fight world: news updated through the day, fight nights, rankings
   and fighters with their full records.
3. Learn: guides to every discipline, and a club finder for the UK, Europe, the
   USA and beyond.
4. Train: the Fight Hub app, with round-based sessions for nine martial arts
   plus self-defence, weekly routines, over 100 illustrated exercises and HIIT.
   It is free to start.
5. Premium adds the AI voice coach and the full programmes (fat loss, splits and
   high kicks, fighter roadwork). The app is in English, Spanish, Portuguese,
   French and German.
6. Join: open the app, or explore the fighters.

**Honesty rules**
- Only use real figures. The fighter, discipline and fight-night counts come
  live from the site's own data.
- Use no testimonials until there are real ones.
- Never fabricate results, records or member numbers.
- Avoid other brands' logos (for example the UFC octagon or belt). Event and
  fighter names in the live cards are fine, because they are news.

## Scenes

### Scene 1: the arena (the opening shot)
- A dark, empty arena: black floor, tiers of empty seats fading into darkness,
  and a thin red light strip around the floor.
- One boxing ring in a single white spotlight from above, with a visible light
  beam and dust drifting in it.
- The ring has chrome posts, red and black corner pads, white ropes with a red
  top rope, and a dark canvas with the FightHub logo in the centre. The apron
  carries a red edge and FIGHT HUB lettering.
- The camera opens on a wide shot with the ring to the right. The headline sits
  on the left: "Train like a fighter. Follow the fight world." It has a short
  line about what FightHub covers, the live facts line (fighters, disciplines,
  upcoming events) and a "scroll to step into the ring" cue.
- The mood is calm, heavy and expectant, like the minute before a fight.

### Scene 2: through the ropes, into the logo
- Scrolling pushes the camera in. It drops to rope height and passes between
  the middle and top ropes ("Step through the ropes.").
- Inside the ring the camera rises and looks straight down at the logo.
  The spotlight swells.
- The camera dives into the logo. A white-to-red flash covers the moment it
  passes through the canvas.
- A tunnel of glowing red and white rounded squares follows, shaped like the
  ring, with sparks around it. This is accelerated portal travel: the
  fastest-feeling moment.

### Scene 3: FOLLOW (the fight world)
- Giant chrome FOLLOW standing on a dark floor with a faint red grid, with red
  light catching its edges. The camera flies through the first O.
- Copy: "The whole fight world, in one place." plus a short line about news,
  fight nights, rankings and full records.
- Live cards (HTML, with real data):
  - next fight night: promotion, name and date, linking to the calendar;
  - the latest story, linking to the article.
- Giant number monuments stand in the space as architecture, not small stats:
  "1,010 FIGHTERS" and "16 FIGHT NIGHTS AHEAD", both counted live.

### Scene 4: LEARN (every martial art)
- LEARN hangs overhead like an arena banner. The camera looks up as it passes
  underneath.
- Copy: "Every martial art, explained." with guides to N disciplines (live
  count) and clubs near you.
- Then a corridor gallery: the discipline pictures from the app (boxing, Muay
  Thai, MMA, BJJ, kickboxing, wrestling, karate, taekwondo, kung fu,
  self-defence), with women and men alternating. They are panels at staggered
  depths on both sides, each labelled in Bebas Neue.
- Buttons: "All disciplines" and "Find a club near you".

### Scene 5: TRAIN (the app)
- Chrome TRAIN on the left. The camera turns towards it, then turns right to a
  flyby of floating phones showing real app screens: Today, Fight training, the
  Coach (with the coach portrait) and an exercise.
- Copy: "Fight training, in your pocket." with the app facts, then "A coach that
  knows your week." with Premium and the languages, and an "Open the app"
  button.
- A "100+ EXERCISES" monument.
- Motion here is a little faster and more energetic, with speed lines.

### Scene 6: convergence and the call to action
- The gallery panels and phones fly back past the camera and arrange themselves
  in a ring around a large 3D FIGHT HUB (chrome FIGHT, red HUB), with a red glow
  behind.
- Copy: "Your fight starts here." with the buttons "Open the app" and
  "Explore fighters".
- Then the stage releases and the normal homepage scrolls up underneath.

## How content behaves
- Big statements are 3D words and number monuments.
- Anything to read (copy, cards, buttons) is accessible HTML on top of the
  scene. It fades in and out at its moment in the journey. It is never tiny 3D
  text.
- Pictures are panels in space, not grids.
- The phones show real screenshots.
- A chapter bar at the bottom (Ring, Follow, Learn, Train, Join, Skip) shows
  progress and lets visitors jump. "Skip" goes straight to the homepage content.

## Motion
- One master timeline from 0 to 1, driven by scrolling. The camera eases towards
  the scroll position, so movement feels heavy, and scrolling back plays the
  journey in reverse.
- Mostly forward, with planned drifts left and right, reveal turns, a rise and a
  dive, flybys and a final converge. There is no spinning.
- Smooth scrolling (Lenis) on desktop. Phones use their own natural scrolling.

## Design language
- FightHub's colours:
  - near-black #050506 and charcoal;
  - chrome and silver;
  - white light;
  - one accent, FightHub red #e63946 (with #ff2d55 for gradients).
- Type: Bebas Neue for headlines and 3D words, Inter for text. These are the
  site's own fonts.
- Glass cards match the site's dark glass style.
- Glow and haze are used sparingly. There is no neon overload, no generic
  floating-glass clutter and no game look.

## Technology (as built)
- The site is static HTML on Vercel, so the hero is plain JavaScript modules
  with no framework:
  - Three.js 0.169, loaded from jsDelivr through an import map;
  - Lenis for smooth scrolling;
  - one WebGL scene with HTML overlays.
- The 3D words use Bebas Neue, converted to a Three.js font file by
  `tools/make-hero-font.cjs`, with only the letters needed (13 KB). The font is
  under the SIL Open Font License (`hero3d/OFL.txt`).
- The hero's assets are:
  - the logo;
  - the app's discipline pictures (`app/assets/arts/`);
  - screenshots in `images/app/`.
  The pictures load after the first frame.
- The homepage hands the live figures to the hero through `window.fightHubFacts`
  and a `fighthub:facts` event.

## Performance and access
- Phones get:
  - fewer seats, dust, cubes, sparks and speed lines;
  - no shadows;
  - a lower pixel ratio;
  - a closer camera path and a smaller layout.
- Drawing stops when the hero is off screen or the tab is hidden.
- Reduced motion, or no WebGL, shows a still hero instead: the headline, the
  facts and the call to action, with no scroll journey.
- The "Skip" link and keyboard focus styles are always available.

## Optional generated assets (Higgsfield, Seedance)
These are supporting media only, never the whole site. Real screenshots and real
data come first. The look is dark, cinematic and minimal, with FightHub red as
the only colour, and no logos or recognisable real people.
1. Arena ambience loop: an empty dark arena with one spotlight on a boxing ring,
   dust floating in the beam, a slow push in, 8 seconds, seamless loop.
2. Portal loop: glowing red and white rounded squares rushing past in black
   space, with sparks, seamless.
3. Training montage loop for a floating screen: close-ups of wraps, gloves, a
   heavy bag swinging and feet on a mat, dark with red rim light.
4. Coach loop: an abstract red sound-wave orb pulsing in darkness.

## Phases
1. Shell, master scroll timeline, loading screen and chapter bar: done.
2. Arena, ring and logo portal: done.
3. FOLLOW, with live cards and number monuments: done.
4. LEARN, with the discipline gallery: done.
5. TRAIN, with app phones: done.
6. Convergence and call to action: done.
7. Owner review on the preview page, then swap it into `index.html`.
8. Later:
   - generated ambient loops on screens;
   - a founder or coach video;
   - real member stories once they exist;
   - translated hero copy when the website gets languages.
