// Custody (loan) receipt: an official A4 document. Drawn on a canvas so Arabic
// shaping and right-to-left order come from the browser, then placed into a
// single-page jsPDF page. Same export as before: downloadLoanReceipt().
import { loadImage } from './cover.js';
import { formatDate } from './api.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1000;
const H = 1414; // A4 portrait ratio
const M = 64; // page margin
const C = {
  green: '#0b2415', brand: '#1a5130', link: '#22743a', gold: '#c5a059', goldText: '#9b783a',
  ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#dfe5e0', soft: '#f6f8f5',
  warnBg: '#fbf1d9', warnText: '#8a5b00', okBg: '#e5f4e7', okText: '#1d7a31',
};

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

// Splits text into lines that fit maxW (words are kept whole).
function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
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

async function drawReceipt(ctx, { settings, loan }) {
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const orgLine = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  const today = formatDate(new Date().toISOString());
  const receiptNo = `RTS-${String(loan.id).padStart(4, '0')}`;
  const returned = loan.status === 'returned';

  // ----- Header band -----
  ctx.fillStyle = C.green;
  ctx.fillRect(0, 0, W, 176);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, 176, W, 6);

  // Logo in a white tile on the start side (right, in RTL)
  let logo = null;
  if (settings.logo_url) {
    try { logo = await loadImage(settings.logo_url); } catch { /* no logo: skip */ }
  }
  const tile = 104;
  const tileX = W - M - tile;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, tileX, 36, tile, tile, 18);
  ctx.fill();
  if (logo) {
    const s = Math.min((tile - 16) / logo.width, (tile - 16) / logo.height);
    const lw = logo.width * s;
    const lh = logo.height * s;
    ctx.drawImage(logo, tileX + (tile - lw) / 2, 36 + (tile - lh) / 2, lw, lh);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  font(ctx, 32, 900);
  ctx.fillText(orgName, tileX - 24, 84);
  font(ctx, 18, 700);
  ctx.fillStyle = '#cfe0d4';
  ctx.fillText(orgLine, tileX - 24, 118);
  ctx.fillStyle = C.gold;
  font(ctx, 16, 900);
  ctx.fillText('وثيقة رسمية · استلام عهدة', tileX - 24, 150);

  // ----- Title block -----
  ctx.textAlign = 'right';
  ctx.fillStyle = C.ink;
  font(ctx, 42, 900);
  ctx.fillText('إيصال تسليم عهدة', W - M, 262);
  ctx.fillStyle = C.ink3;
  font(ctx, 18, 700);
  ctx.fillText(`رقم الإيصال ${receiptNo}`, W - M, 296);
  ctx.textAlign = 'left';
  ctx.fillText(`تاريخ الإصدار ${today}`, M, 296);

  // Status badge
  const statusLabel = returned ? `أُعيدت بتاريخ ${formatDate(loan.return_date) || '—'}` : 'قيد العهدة';
  font(ctx, 18, 900);
  const badgeW = ctx.measureText(statusLabel).width + 48;
  ctx.fillStyle = returned ? C.okBg : C.warnBg;
  roundRect(ctx, W - M - badgeW, 322, badgeW, 44, 22);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = returned ? C.okText : C.warnText;
  ctx.fillText(statusLabel, W - M - 24, 350);

  // ----- Details as labelled tiles -----
  const tiles = [
    ['الغرض المسلَّم', loan.item_name || '—'],
    ['اسم المستلم', loan.recipient_name || '—'],
    ['رقم الهاتف', loan.recipient_phone || '—'],
    ['تاريخ التسليم', formatDate(loan.loan_date) || '—'],
    ['تاريخ الإعادة', returned ? (formatDate(loan.return_date) || '—') : 'لم تتم بعد'],
    ['رقم الإيصال', receiptNo],
  ];
  const gap = 20;
  const tileW = (W - M * 2 - gap) / 2;
  const tileH = 104;
  const top = 396;
  tiles.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? W - M - tileW : M;
    const y = top + row * (tileH + gap);
    ctx.fillStyle = C.soft;
    roundRect(ctx, x, y, tileW, tileH, 16);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + tileW - 6, y + 18, 6, tileH - 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink3;
    font(ctx, 16, 800);
    ctx.fillText(label, x + tileW - 24, y + 36);
    ctx.fillStyle = C.ink;
    font(ctx, 26, 900);
    const fitted = fit(ctx, String(value), tileW - 48);
    ctx.fillText(fitted, x + tileW - 24, y + 78);
  });
  let y = top + 3 * (tileH + gap) + 10;

  // ----- Notes -----
  ctx.textAlign = 'right';
  ctx.fillStyle = C.ink3;
  font(ctx, 16, 800);
  ctx.fillText('ملاحظات', W - M, y + 24);
  ctx.fillStyle = C.ink2;
  font(ctx, 20, 600);
  const noteLines = wrap(ctx, loan.notes || 'لا ملاحظات.', W - M * 2);
  noteLines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, W - M, y + 56 + i * 32));
  y += 56 + Math.max(1, Math.min(3, noteLines.length)) * 32 + 22;

  // ----- Photo + commitment -----
  const blockTop = y + 8;
  const photoW = 380;
  const photoH = 300;
  const photoX = M;
  ctx.fillStyle = C.soft;
  roundRect(ctx, photoX, blockTop, photoW, photoH, 18);
  ctx.fill();
  let drew = false;
  if (loan.image_url) {
    try {
      const img = await loadImage(loan.image_url);
      ctx.save();
      roundRect(ctx, photoX, blockTop, photoW, photoH, 18);
      ctx.clip();
      const s = Math.max(photoW / img.width, photoH / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, photoX + (photoW - dw) / 2, blockTop + (photoH - dh) / 2, dw, dh);
      ctx.restore();
      drew = true;
    } catch { /* image failed to load */ }
  }
  if (!drew) {
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink3;
    font(ctx, 18, 700);
    ctx.fillText('لا صورة مرفقة للغرض', photoX + photoW / 2, blockTop + photoH / 2);
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  roundRect(ctx, photoX, blockTop, photoW, photoH, 18);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink3;
  font(ctx, 15, 700);
  ctx.fillText('صورة الغرض', photoX, blockTop + photoH + 26);

  // Commitment statement
  ctx.textAlign = 'right';
  ctx.fillStyle = C.goldText;
  font(ctx, 16, 900);
  ctx.fillText('إقرار المستلم', W - M, blockTop + 22);
  ctx.fillStyle = C.ink2;
  font(ctx, 20, 600);
  const commitment = 'أقرّ أنا المستلم أدناه باستلام الغرض المذكور أعلاه بحالته المبيَّنة، وأتعهّد بالمحافظة عليه واستخدامه في أغراض الجمعية فقط، وإعادته عند الطلب أو عند انتهاء الحاجة إليه.';
  const commitLines = wrap(ctx, commitment, 400);
  commitLines.forEach((ln, i) => ctx.fillText(ln, W - M, blockTop + 60 + i * 34));

  // ----- Signatures -----
  const sigY = H - 230;
  const sigW = 330;
  const leftX = M;
  const rightX = W - M - sigW;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(leftX, sigY); ctx.lineTo(leftX + sigW, sigY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rightX, sigY); ctx.lineTo(rightX + sigW, sigY); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  font(ctx, 18, 900);
  ctx.fillText('توقيع المستلم', leftX + sigW / 2, sigY + 34);
  ctx.fillText('توقيع المسؤول عن العهدة', rightX + sigW / 2, sigY + 34);
  ctx.fillStyle = C.ink3;
  font(ctx, 16, 700);
  ctx.fillText(loan.recipient_name || '', leftX + sigW / 2, sigY + 62);
  ctx.fillText('الاسم والتوقيع', rightX + sigW / 2, sigY + 62);

  // ----- Footer -----
  ctx.fillStyle = C.line;
  ctx.fillRect(M, H - 86, W - M * 2, 2);
  ctx.fillStyle = C.ink3;
  font(ctx, 16, 700);
  ctx.textAlign = 'right';
  ctx.fillText(orgName, W - M, H - 52);
  ctx.textAlign = 'left';
  ctx.fillText([settings.phone, receiptNo].filter(Boolean).join(' · '), M, H - 52);
}

// Shrinks a value's font until it fits the width (keeps the tile tidy).
function fit(ctx, text, maxW) {
  let size = 26;
  while (size > 16) {
    font(ctx, size, 900);
    if (ctx.measureText(text).width <= maxW) break;
    size -= 1;
  }
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

export async function downloadLoanReceipt({ settings, loan }) {
  // The browser can't paint text it hasn't finished downloading the font for.
  await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ')))
    .catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  await drawReceipt(canvas.getContext('2d'), { settings, loan });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, pageH);
  const safeName = (loan.recipient_name || 'receipt').replace(/[\\/:*?"<>|]/g, '').trim();
  pdf.save(`إيصال-عهدة-${safeName}-${loan.id}.pdf`);
}
