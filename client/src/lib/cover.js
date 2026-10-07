// Canvas drawing for the photo generator. Pure functions: give them a 2D
// context, a size and the options, and they paint the finished image.

export const SIZES = {
  portrait: { label: 'عمودي 4:5 (إنستغرام / فيسبوك)', w: 1080, h: 1350 },
  square: { label: 'مربع 1:1', w: 1080, h: 1080 },
  wide: { label: 'أفقي 16:9 (غلاف الموقع)', w: 1600, h: 900 },
};

export const BAND_COLORS = {
  grey: { label: 'رمادي', band: '#6c757c', text: '#4a5157' },
  green: { label: 'أخضر', band: '#2f9e3a', text: '#1f6f28' },
  red: { label: 'أحمر', band: '#c9252b', text: '#a01c21' },
  ink: { label: 'كحلي', band: '#1c2a3a', text: '#1c2a3a' },
};

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
// The activity cover uses Dubai Bold, which matches the reference design.
const COVER_FONT = '"Dubai", "Cairo", "Segoe UI", Tahoma, sans-serif';

// Draws `img` so it fills the box, like CSS object-fit: cover.
// zoom >= 1; posX / posY in [-1, 1] slide the photo inside the box.
function drawPhoto(ctx, img, x, y, w, h, { zoom = 1, posX = 0, posY = 0 } = {}) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) * (0.5 + posX * 0.5);
  const dy = y + (h - dh) * (0.5 + posY * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function placeholder(ctx, x, y, w, h, s) {
  ctx.fillStyle = '#dfe3e0';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8a938e';
  ctx.font = `700 ${34 * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ارفع صورة للبدء', x + w / 2, y + h * 0.4);
}

// Shrinks the font until the text fits maxWidth, then draws it.
function fitText(ctx, text, x, y, maxWidth, size, weight, minSize = 16, family = FONT) {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 2;
  } while (px > minSize);
  ctx.fillText(text, x, y);
  return px;
}

// Word-wraps `text` to fit maxWidth, up to maxLines; the last line gets an
// ellipsis if the text didn't fully fit. ctx.font must already be set.
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const allLines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      allLines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) allLines.push(current);
  if (allLines.length <= maxLines) return allLines;

  const lines = allLines.slice(0, maxLines);
  let last = lines[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trim();
  lines[maxLines - 1] = `${last}…`;
  return lines;
}

// Faint eight-point-star lattice used behind the text area.
function starPattern(ctx, x, y, w, h, cell, alpha = 0.055) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = `rgba(40, 50, 45, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, cell * 0.035);
  const r = cell * 0.42;
  for (let cy = y; cy < y + h + cell; cy += cell) {
    for (let cx = x; cx < x + w + cell; cx += cell) {
      for (const angle of [0, Math.PI / 4]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function hGradient(ctx, x0, x1, color) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  return g;
}

// Logo with the identity lines beside it, centred as one group on cx.
function identityBlock(ctx, o, cx, cy, s, color = '#3f474c', scale = 1, family = FONT) {
  const lines = [o.line1, o.line2, o.line3].filter(Boolean);
  const logoH = 150 * s * scale;
  const logoW = o.logo ? (o.logo.width / o.logo.height) * logoH : 0;
  const gap = o.logo && lines.length ? 22 * s * scale : 0;
  const fontPx = 27 * s * scale;
  ctx.font = `700 ${fontPx}px ${family}`;
  const textW = lines.length ? Math.max(...lines.map((l) => ctx.measureText(l).width)) : 0;
  const total = logoW + gap + textW;
  const right = cx + total / 2;
  if (o.logo) ctx.drawImage(o.logo, right - logoW, cy - logoH / 2, logoW, logoH);
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const lineH = fontPx * 1.55;
  lines.forEach((line, i) => {
    ctx.fillText(line, right - logoW - gap, cy + (i - (lines.length - 1) / 2) * lineH);
  });
}

// Activity cover: photo fading into white, title band, subtitles, identity.
export function drawCover(ctx, W, H, o) {
  const s = Math.min(W, H * 0.8) / 1080;
  const color = BAND_COLORS[o.color] || BAND_COLORS.grey;
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Photo across the top half, washed lightly and fading into white below.
  const photoH = H * 0.56;
  if (o.photo) drawPhoto(ctx, o.photo, 0, 0, W, photoH, o);
  else placeholder(ctx, 0, 0, W, photoH, s);
  // Paler than the raw photo, with the fade starting higher up, as in the reference.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(0, 0, W, photoH);

  const fade = ctx.createLinearGradient(0, photoH * 0.3, 0, photoH);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.6, 'rgba(255,255,255,0.8)');
  fade.addColorStop(1, '#ffffff');
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH * 0.3, W, photoH * 0.7 + 2);

  starPattern(ctx, 0, photoH * 0.8, W, H - photoH * 0.8, 260 * s, 0.06);

  // Title band: solid from the left edge to about the middle, then fading to near-white under the title.
  const band1Y = H * 0.585;
  const band1H = H * 0.09;
  const bandFade = ctx.createLinearGradient(0, 0, W, 0);
  bandFade.addColorStop(0, color.band);
  bandFade.addColorStop(0.55, color.band);
  bandFade.addColorStop(1, hexToRgba(color.band, 0.04));
  ctx.fillStyle = bandFade;
  ctx.fillRect(0, band1Y, W, band1H);
  ctx.fillStyle = color.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const titleY = band1Y + band1H / 2 + 12 * s;
  fitText(ctx, o.title || '', W - 28 * s, titleY, W * 0.62, 92 * s, 700, 16, COVER_FONT);
  // A thin stroke in the same colour makes the title heavier, as in the reference.
  ctx.strokeStyle = color.text;
  ctx.lineWidth = 2 * s;
  ctx.strokeText(o.title || '', W - 28 * s, titleY);

  // Second band on the right, with the subtitles on white to its left.
  const subs = [o.subtitle1, o.subtitle2].filter(Boolean);
  const band2Y = H * 0.72;
  const band2H = H * 0.09;
  if (subs.length) {
    ctx.fillStyle = hGradient(ctx, W, W * 0.615, color.band);
    ctx.fillRect(W * 0.615, band2Y, W * 0.385, band2H);
    ctx.fillStyle = '#3f464c';
    ctx.textAlign = 'center';
    const lineH = H * 0.041;
    const mid = H * 0.749;
    subs.forEach((line, i) => {
      fitText(ctx, line, W * 0.23, mid + (i - (subs.length - 1) / 2) * lineH, W * 0.46, 44 * s, 700, 16, COVER_FONT);
    });
  }

  identityBlock(ctx, o, W * 0.555, H * 0.925, s, '#3f474c', 0.8, COVER_FONT);
}

// Simple frame: the whole photo with a coloured border and an identity strip.
export function drawFrame(ctx, W, H, o) {
  const s = Math.min(W, H) / 1080;
  const color = BAND_COLORS[o.color] || BAND_COLORS.green;
  const stripH = 210 * s;
  const border = 16 * s;
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const photoH = H - stripH;
  if (o.photo) drawPhoto(ctx, o.photo, 0, 0, W, photoH, o);
  else placeholder(ctx, 0, 0, W, photoH, s);

  starPattern(ctx, 0, photoH, W, stripH, 150 * s);
  ctx.fillStyle = color.band;
  ctx.fillRect(0, photoH - 5 * s, W, 10 * s);

  identityBlock(ctx, o, W / 2, photoH + stripH / 2 + 2 * s, s);

  ctx.strokeStyle = color.band;
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, W - border, H - border);
}

function hexToRgba(hex, alpha) {
  const h = String(hex || '#2f9e3a').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16) || 0x2f9e3a;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Right-to-left flowing chip row for a list of names; wraps onto a second
// row and collapses anything past that into a "+N" badge. Returns row count.
function drawChips(ctx, names, rightX, topY, maxWidth, s, color) {
  const padX = 20 * s;
  const rowH = 52 * s;
  const gapX = 10 * s;
  const gapY = 12 * s;
  const maxRows = 2;
  ctx.font = `700 ${25 * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const leftX = rightX - maxWidth;
  let row = 0;
  let cursor = rightX;
  let shown = 0;
  for (const name of names) {
    const chipW = ctx.measureText(name).width + padX * 2;
    if (cursor - chipW < leftX) {
      if (row + 1 >= maxRows) break;
      row++;
      cursor = rightX;
    }
    const chipX = cursor - chipW;
    const chipY = topY + row * (rowH + gapY);
    ctx.fillStyle = hexToRgba(color.band, 0.12);
    roundRect(ctx, chipX, chipY, chipW, rowH, rowH / 2);
    ctx.fill();
    ctx.fillStyle = color.text;
    ctx.fillText(name, chipX + chipW / 2, chipY + rowH / 2 + 1 * s);
    cursor = chipX - gapX;
    shown++;
  }

  const remaining = names.length - shown;
  if (remaining > 0) {
    const text = `+${remaining}`;
    const chipW = ctx.measureText(text).width + padX * 2;
    let chipX = cursor - chipW;
    if (chipX < leftX) { row = Math.min(row + 1, maxRows - 1); chipX = rightX - chipW; }
    const chipY = topY + row * (rowH + gapY);
    ctx.fillStyle = color.band;
    roundRect(ctx, chipX, chipY, chipW, rowH, rowH / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, chipX + chipW / 2, chipY + rowH / 2 + 1 * s);
  }
  return row + 1;
}

// Mission info card: a clean, text-led companion to the cover - type + date
// header, title, participant chips and the details text, closing with the
// same identity block as the cover/frame so the pair reads as one set.
export function drawInfoCard(ctx, W, H, o) {
  const s = Math.min(W, H) / 1080;
  const color = BAND_COLORS[o.color] || { band: o.color || BAND_COLORS.green.band, text: o.color || BAND_COLORS.green.text };
  const pad = 64 * s;
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const bandH = H * 0.15;
  ctx.fillStyle = color.band;
  ctx.fillRect(0, 0, W, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if (o.typeLabel) fitText(ctx, o.typeLabel, W - pad, bandH * 0.4, W - pad * 2, 46 * s, 700);
  if (o.dateLabel) {
    ctx.font = `700 ${26 * s}px ${FONT}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(o.dateLabel, W - pad, bandH * 0.74);
    ctx.globalAlpha = 1;
  }

  starPattern(ctx, 0, bandH, W, H - bandH, 170 * s);

  let y = bandH + 80 * s;

  ctx.fillStyle = '#17211c';
  ctx.textAlign = 'right';
  ctx.font = `700 ${56 * s}px ${FONT}`;
  const titleLH = 66 * s;
  const titleLines = wrapLines(ctx, o.title || '', W - pad * 2, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, W - pad, y + i * titleLH));
  y += titleLines.length * titleLH + 26 * s;

  const divider = () => {
    ctx.strokeStyle = '#e2e0d6';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
    y += 40 * s;
  };
  divider();

  const names = (o.names || []).filter(Boolean);
  if (names.length) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#55615b';
    ctx.font = `700 ${27 * s}px ${FONT}`;
    ctx.fillText('المشاركون في المهمة', W - pad, y);
    y += 46 * s;
    const rows = drawChips(ctx, names, W - pad, y, W - pad * 2, s, color);
    y += rows * (52 * s + 12 * s) + 14 * s;
    divider();
  }

  const bodyBottom = H - 190 * s;
  const bodyLineH = 46 * s;
  const maxBodyLines = Math.max(1, Math.floor((bodyBottom - y) / bodyLineH));
  ctx.fillStyle = '#2d362f';
  ctx.font = `700 ${31 * s}px ${FONT}`;
  ctx.textAlign = 'right';
  const bodyLines = wrapLines(ctx, o.body || '', W - pad * 2, maxBodyLines);
  bodyLines.forEach((line, i) => ctx.fillText(line, W - pad, y + i * bodyLineH + bodyLineH * 0.5));

  identityBlock(ctx, o, W / 2, H - 68 * s, s);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تحميل الصورة'));
    img.src = src;
  });
}
