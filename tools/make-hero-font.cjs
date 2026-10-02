// Builds hero3d/bebas-neue.json (Three.js "typeface" format) from Bebas Neue,
// with only the characters the 3D hero needs.
// Usage: node tools/make-hero-font.cjs path/to/BebasNeue-Regular.ttf
// Needs opentype.js (npm install opentype.js). Bebas Neue is under the SIL Open
// Font License (hero3d/OFL.txt).
const fs = require('fs');
const path = require('path');
const opentype = require(process.env.OPENTYPE || 'opentype.js');

const font = opentype.loadSync(process.argv[2]);
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +,.-·&';
const round = n => Math.round(n);
const glyphs = {};
for (const ch of CHARS) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== ' ')) { console.warn('missing', ch); continue; }
  const o = g.getPath(0, 0, font.unitsPerEm).commands.map(c => {
    // getPath flips y (screen space); typeface outlines are y-up, so flip back
    switch (c.type) {
      case 'M': return `m ${round(c.x)} ${round(-c.y)}`;
      case 'L': return `l ${round(c.x)} ${round(-c.y)}`;
      case 'Q': return `q ${round(c.x)} ${round(-c.y)} ${round(c.x1)} ${round(-c.y1)}`;
      case 'C': return `b ${round(c.x)} ${round(-c.y)} ${round(c.x1)} ${round(-c.y1)} ${round(c.x2)} ${round(-c.y2)}`;
      default: return '';
    }
  }).filter(Boolean).join(' ');
  const box = g.getBoundingBox();
  glyphs[ch] = { ha: round(g.advanceWidth), x_min: round(box.x1), x_max: round(box.x2), o };
}
const head = font.tables.head, post = font.tables.post;
const out = {
  glyphs,
  familyName: 'Bebas Neue',
  ascender: font.ascender,
  descender: font.descender,
  underlinePosition: post.underlinePosition,
  underlineThickness: post.underlineThickness,
  boundingBox: { xMin: head.xMin, yMin: head.yMin, xMax: head.xMax, yMax: head.yMax },
  resolution: font.unitsPerEm,
  original_font_information: { format: 0, fontFamily: 'Bebas Neue', fontSubfamily: 'Regular', license: 'SIL Open Font License 1.1' }
};
const file = path.join(__dirname, '..', 'hero3d', 'bebas-neue.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(glyphs).length} glyphs, ${fs.statSync(file).size} bytes -> ${file}`);
