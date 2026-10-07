// Logo for the report PDFs: the uploaded site logo, or the built-in emblem.
// Drawn in a white tile on the green page header, so the emblem's white
// background stays clean.
import { loadImage } from './cover.js';
import { LOGO } from './brand.js';

export async function loadBrandLogo(settings) {
  try {
    return await loadImage(settings.logo_url || LOGO);
  } catch {
    return null;
  }
}

// Draws the logo at the far end of a 120px header (right side in RTL).
export function drawBrandLogo(cx, logo, W, M) {
  const size = 96;
  const x = W - M - size;
  const y = 12;
  cx.save();
  cx.fillStyle = '#ffffff';
  cx.beginPath();
  cx.roundRect(x, y, size, size, 16);
  cx.fill();
  const s = Math.min((size - 14) / logo.width, (size - 14) / logo.height);
  const w = logo.width * s;
  const h = logo.height * s;
  cx.drawImage(logo, x + (size - w) / 2, y + (size - h) / 2, w, h);
  cx.restore();
}
