// Logo for the report PDFs: the uploaded site logo, or the built-in emblem.
// Drawn in a white tile on the green page header, so the emblem's white
// background stays clean.
import { loadImage } from './cover.js';
import { LOGO, AMAL_LOGO } from './brand.js';

export async function loadBrandLogo(settings) {
  try {
    return await loadImage(settings.logo_url || LOGO);
  } catch {
    return null;
  }
}

// Partner emblem (حركة أمل - المكتب الصحي), used alongside the team logo on
// reports that credit that partnership, e.g. the blood-donation reports.
export async function loadAmalLogo() {
  try {
    return await loadImage(AMAL_LOGO);
  } catch {
    return null;
  }
}

// Draws the logo at the far end of a 120px header (right side in RTL).
export function drawBrandLogo(cx, logo, W, M) {
  drawLogoTile(cx, logo, W - M - 96, 12, 96);
}

// Same white rounded tile, but at an arbitrary position/size - for headers
// that carry more than one logo (e.g. the team logo plus a partner emblem).
export function drawLogoTile(cx, logo, x, y, size) {
  cx.save();
  cx.fillStyle = '#ffffff';
  cx.beginPath();
  cx.roundRect(x, y, size, size, size * 0.16);
  cx.fill();
  const s = Math.min((size - 14) / logo.width, (size - 14) / logo.height);
  const w = logo.width * s;
  const h = logo.height * s;
  cx.drawImage(logo, x + (size - w) / 2, y + (size - h) / 2, w, h);
  cx.restore();
}
