/* Female versions of the demonstration pictures, so members see someone like
   them. Files: assets/movements/<id>-realistic-f.webp and assets/arts/<image>-f.webp.
   Members choose on their account page; by default the pictures follow the
   gender in their profile. Anything without a female version yet shows the
   original picture, so new pictures can be added a batch at a time:
   add each id below once its file is in place (a test checks the files). */
const FemaleMedia = {
  movements: new Set([]),
  arts: new Set([])
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
