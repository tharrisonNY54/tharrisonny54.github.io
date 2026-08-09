/**
 * Bakes the 1200x630 Open Graph card from the orbit render + a text plate.
 * Local dev tool — run `node scripts/og-card.mjs` after changing the tagline.
 * Output (`public/img/og-card.jpg`) IS committed and served.
 */
import sharp from 'sharp';
import { resolve } from 'node:path';

const SRC = resolve('public/img/aspera-orbit.webp');
const OUT = resolve('public/img/og-card.jpg');
const W = 1200;
const H = 630;

const NAME = 'Trey Harrison';
const LINE = 'Spacecraft geometry for NASA&#8217;s Aspera mission.';
const LINE2 = 'Volumetric capture at the University of Arizona.';
const FOOT = 'TUCSON, AZ';

const plate = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#08090b" stop-opacity="0.96"/>
      <stop offset="46%"  stop-color="#08090b" stop-opacity="0.86"/>
      <stop offset="72%"  stop-color="#08090b" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#08090b" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <text x="74" y="250" fill="#e9e8e3"
        font-family="Georgia, 'Times New Roman', serif" font-size="74">${NAME}</text>
  <text x="74" y="326" fill="#c9c8c2"
        font-family="Helvetica, Arial, sans-serif" font-size="31">${LINE}</text>
  <text x="74" y="372" fill="#c9c8c2"
        font-family="Helvetica, Arial, sans-serif" font-size="31">${LINE2}</text>
  <rect x="74" y="424" width="88" height="2" fill="#9fc7cf"/>
  <text x="74" y="486" fill="#9fc7cf" letter-spacing="4"
        font-family="'Courier New', monospace" font-size="21">${FOOT}</text>
</svg>`);

await sharp(SRC)
  .resize(W, H, { fit: 'cover', position: 'attention' })
  .composite([{ input: plate }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(OUT);

console.log('wrote', OUT);
