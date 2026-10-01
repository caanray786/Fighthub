/* Female versions of the demonstration pictures, so members see someone like
   them. Files: assets/movements/<id>-realistic-f.webp and assets/arts/<image>-f.webp.
   Members choose on their account page; by default the pictures follow the
   gender in their profile. Anything without a female version yet shows the
   original picture, so new pictures can be added a batch at a time:
   add each id below once its file is in place (a test checks the files). */
const FemaleMedia = {
  movements: new Set([
    'ankle', 'arm-circles', 'assisted-pull', 'b-stance-thrust', 'backpack-hinge', 'backpack-row', 'backpack-squat', 'bag-work',
    'band-curl', 'band-row', 'band-walk', 'bear-crawl', 'bench-press', 'biceps-curl', 'bike', 'bird-dog',
    'body-shots', 'bottle-carry', 'bottle-curl', 'bottle-raise', 'bridge', 'bulgarian-split', 'burpee', 'butt-kicks',
    'butterfly-stretch', 'cable-kickback', 'cable-row', 'calf', 'calf-stretch', 'carry', 'chair-rise', 'check',
    'chest-machine', 'chest-stretch', 'clamshell', 'curtsy-lunge', 'db-row', 'dead-bug', 'donkey-kick', 'floor-press',
    'glute-stretch', 'goblet', 'half-split', 'hammer-curl', 'hamstring-stretch', 'hand-release-press', 'heel-digs', 'heel-taps',
    'high-knees', 'hinge', 'hip-abduction', 'hip-flexor-stretch', 'hip-openers', 'hip-thrust', 'inchworm', 'incline-press',
    'jab', 'kb-swing', 'knee-straight', 'kneeling-press', 'lat-pull', 'lateral-lunge', 'lateral-raise', 'lead-hook',
    'leg-curl', 'leg-press', 'leg-swings-front', 'leg-swings-side', 'low-kick', 'march', 'mountain-climber', 'mt-stance',
    'parry', 'pivot', 'plank', 'plank-tap', 'plank-up-down', 'prone-w', 'pull-through', 'push-up',
    'quad-stretch', 'rdl', 'reverse-fly', 'reverse-lunge', 'roll', 'roundhouse', 'rower', 'seated-calf',
    'shadow-bounce', 'shoulder-press', 'shoulder-roll', 'side-leg', 'side-lying-raise', 'side-plank', 'side-steps', 'single-leg-bridge',
    'single-leg-rdl', 'skip-rope', 'slip', 'slow-climber', 'split-squat', 'squat', 'squat-jump', 'squat-thrust',
    'stance-footwork', 'standing-curl', 'star-jacks', 'step-burpee', 'step-jacks', 'step-up', 'sumo-squat', 'switch-kick',
    'teep', 'triceps', 'tuck-jump', 'upper-back-stretch', 'uppercut', 'walk', 'walking-lunge', 'wall-press',
    'wall-sit', 'wall-slide'
  ]),
  arts: new Set(['bjj', 'boxing', 'karate', 'kickboxing', 'kung-fu', 'mma', 'muay-thai', 'taekwondo', 'wrestling'])
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
