/* Female versions of the demonstration pictures, so members see someone like
   them. Files: assets/movements/<id>-realistic-f.webp and assets/arts/<image>-f.webp.
   Members choose on their account page; by default the pictures follow the
   gender in their profile. Anything without a female version yet shows the
   original picture, so new pictures can be added a batch at a time:
   add each id below once its file is in place (a test checks the files). */
const FemaleMedia = {
  movements: new Set([
    '90-90', 'active-front-raise', 'active-side-raise', 'ankle', 'arm-circles', 'assisted-pull', 'b-stance-thrust', 'back-extension',
    'back-squat', 'backpack-hinge', 'backpack-row', 'backpack-squat', 'bag-work', 'band-curl', 'band-row', 'band-walk',
    'barbell-bench', 'barbell-curl', 'barbell-row', 'bear-crawl', 'bear-hug-escape', 'bench-press', 'biceps-curl', 'bike', 'bird-dog', 'body-shots',
    'bottle-carry', 'bottle-curl', 'bottle-raise', 'breakfall', 'bridge', 'bridge-march', 'bridge-roll', 'bulgarian-split',
    'burpee', 'butt-kicks', 'butterfly-stretch', 'cable-kickback', 'cable-row', 'calf', 'calf-stretch', 'carry', 'chamber-hold',
    'chair-rise', 'check', 'chest-machine', 'clinch-knees', 'chest-stretch', 'clamshell', 'cossack', 'couch-stretch', 'cross',
    'curtsy-lunge', 'db-row', 'dead-bug', 'deadlift', 'dip', 'donkey-kick', 'elbows', 'easy-run', 'fence', 'fire-hydrant',
    'floor-press', 'frog', 'frog-pump', 'front-kick', 'front-split-slide', 'glute-stretch', 'goblet', 'granby-roll', 'ground-strikes', 'gyaku-zuki',
    'half-split', 'hammer-curl', 'hamstring-stretch', 'hand-release-press', 'hard-run', 'heel-digs', 'heel-taps', 'high-kick', 'high-knees',
    'hill-sprint', 'hinge', 'hip-abduction', 'hip-flexor-stretch', 'hip-openers', 'hip-thrust', 'horse-bow', 'horse-stance',
    'inchworm', 'incline-press', 'jab', 'jog-in-place', 'karate-blocks', 'kb-swing', 'knee-straight', 'kneeling-press',
    'lat-pull', 'lateral-lunge', 'lateral-raise', 'lead-hook', 'leg-curl', 'leg-press', 'leg-swings-front', 'leg-swings-side', 'level-change',
    'lizard', 'low-kick', 'march', 'mountain-climber', 'mt-stance', 'oi-zuki', 'overhead-press', 'palm-strike',
    'pancake', 'parry', 'pivot', 'plank', 'plank-tap', 'plank-up-down', 'pnf-adductor', 'pnf-hamstring',
    'prone-w', 'pull-through', 'pull-up', 'punch-out', 'push-up', 'quad-stretch', 'rapid-kicks', 'rdl',
    'reverse-fly', 'reverse-lunge', 'roll', 'roundhouse', 'rower', 'scan-escape', 'seated-calf', 'shadow-bounce',
    'shoulder-press', 'shoulder-roll', 'shrimp', 'side-kick', 'side-leg', 'side-lying-raise', 'side-plank', 'side-steps',
    'single-leg-bridge', 'single-leg-rdl', 'sit-out', 'skip-rope', 'slip', 'slow-climber', 'snap-roundhouse', 'split-squat',
    'sprawl', 'sprint', 'squat', 'squat-jump', 'squat-thrust', 'stance-footwork', 'stance-motion', 'standing-curl',
    'star-jacks', 'step-burpee', 'step-jacks', 'step-up', 'straddle-slide', 'sumo-squat', 'switch-kick', 'technical-standup',
    'teep', 'triceps', 'tuck-jump', 'upper-back-stretch', 'uppercut', 'walk', 'walking-lunge', 'wall-press',
    'wall-sit', 'wall-slide', 'wrist-escape', 'zenkutsu'
  ]),
  arts: new Set(['self-defence', 'bjj', 'boxing', 'karate', 'kickboxing', 'kung-fu', 'mma', 'muay-thai', 'taekwondo', 'wrestling'])
};

const pictureKey = 'fight-hub-pictures-v1';
const PICTURE_CHOICES = [['auto', 'Match my profile'], ['female', 'Women'], ['male', 'Men']];

function pictureChoice() {
  try { return localStorage.getItem(pictureKey) || 'auto'; } catch { return 'auto'; }
}

function setPictureChoice(choice) {
  try { localStorage.setItem(pictureKey, choice); } catch { /* this device only */ }
}

function womenPictures() {
  const choice = pictureChoice();
  return choice === 'female' || (choice === 'auto' && typeof account !== 'undefined' && account.profile?.gender === 'female');
}

function movementSrc(id) {
  return `assets/movements/${id}-realistic${FemaleMedia.movements.has(id) && womenPictures() ? '-f' : ''}.webp`;
}

function artSrc(image) {
  return `assets/arts/${image}${FemaleMedia.arts.has(image) && womenPictures() ? '-f' : ''}.webp`;
}

if (typeof module !== 'undefined') module.exports = FemaleMedia;
