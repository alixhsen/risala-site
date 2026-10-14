// Shift schedule as a 1080 x 1350 PNG for sharing - same design system as
// the monthly report (socialReport.js): a photo-mosaic background under a
// dark shade, header with a gold kicker and big title, and a white table
// panel listing every shift (day/date, time, members on duty).
import { loadImage } from './cover.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1080;
const H = 1350;
const MAX_ROWS = 9;
const C = { green: '#0b2415', brand: '#1a5130', gold: '#c5a059', goldText: '#9b783a', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f6f8f5' };
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function dayDateLabel(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr || '');
  return `${WEEKDAYS[d.getDay()]}، ${d.toLocaleDateString('ar-LB', { day: 'numeric', month: 'long' })}`;
}

function timeLabel(t) {
  const m = String(t || '').match(/(\d{2}):(\d{2})/);
  if (!m) return t || '';
  const h = Number(m[1]);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m[2]} ${period}`;
}

async function drawPhotoMosaic(cx, photoUrls) {
  cx.fillStyle = C.green;
  cx.fillRect(0, 0, W, H);
  const photos = [];
  for (const url of photoUrls) {
    try { photos.push(await loadImage(url)); } catch { /* skip a photo that fails */ }
  }
  if (!photos.length) return;
  const cols = 3, rows = 4, tw = W / cols, th = H / rows, f = 90;
  const cover = (ctx, img, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };
  cx.save();
  cx.filter = 'blur(30px)';
  cover(cx, photos[0], W, H);
  cx.restore();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('canvas');
      tile.width = Math.ceil(tw);
      tile.height = Math.ceil(th);
      const tc = tile.getContext('2d');
      cover(tc, photos[(r * cols + c) % photos.length], tile.width, tile.height);
      const hm = tc.createLinearGradient(0, 0, tile.width, 0);
      const lx = c === 0 ? 0 : f / tile.width;
      const rx = c === cols - 1 ? 1 : 1 - f / tile.width;
      hm.addColorStop(0, `rgba(0,0,0,${c === 0 ? 1 : 0})`);
      hm.addColorStop(Math.max(0, lx), 'rgba(0,0,0,1)');
      hm.addColorStop(Math.min(1, rx), 'rgba(0,0,0,1)');
      hm.addColorStop(1, `rgba(0,0,0,${c === cols - 1 ? 1 : 0})`);
      tc.globalCompositeOperation = 'destination-in';
      tc.fillStyle = hm;
      tc.fillRect(0, 0, tile.width, tile.height);
      const vm = tc.createLinearGradient(0, 0, 0, tile.height);
      const ty = r === 0 ? 0 : f / tile.height;
      const by = r === rows - 1 ? 1 : 1 - f / tile.height;
      vm.addColorStop(0, `rgba(0,0,0,${r === 0 ? 1 : 0})`);
      vm.addColorStop(Math.max(0, ty), 'rgba(0,0,0,1)');
      vm.addColorStop(Math.min(1, by), 'rgba(0,0,0,1)');
      vm.addColorStop(1, `rgba(0,0,0,${r === rows - 1 ? 1 : 0})`);
      tc.fillStyle = vm;
      tc.fillRect(0, 0, tile.width, tile.height);
      cx.drawImage(tile, c * tw, r * th);
    }
  }
}

// o: { settings, shifts: [{shift_date,start_time,end_time,members:[{name}]}],
//      from, to, rangeLabel, photoUrls }
export async function generateScheduleReport({ settings, shifts = [], rangeLabel, photoUrls = [] }) {
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Cairo"`, 'أ'))).catch(() => {});

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  cx.direction = 'rtl';

  await drawPhotoMosaic(cx, photoUrls);

  const shade = cx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(11,36,21,0.80)');
  shade.addColorStop(0.35, 'rgba(11,36,21,0.66)');
  shade.addColorStop(1, 'rgba(11,36,21,0.95)');
  cx.fillStyle = shade;
  cx.fillRect(0, 0, W, H);

  const put = (str, x, y, size, weight, color, align = 'right') => {
    cx.font = `${weight} ${size}px ${FONT}`;
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, x, y);
  };

  // Shrinks the font until `str` fits maxWidth, then draws it - used for the
  // members cell, whose text length varies a lot shift to shift.
  const putFit = (str, x, y, maxWidth, size, weight, color, align = 'right') => {
    let px = size;
    cx.font = `${weight} ${px}px ${FONT}`;
    while (px > 14 && cx.measureText(str).width > maxWidth) {
      px -= 1;
      cx.font = `${weight} ${px}px ${FONT}`;
    }
    let text = str;
    while (text.length > 1 && cx.measureText(text).width > maxWidth) {
      text = text.slice(0, -1);
    }
    if (text !== str) text = `${text.replace(/[،\s]+$/, '')}…`;
    put(text, x, y, px, weight, color, align);
  };

  // ----- Header -----
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للاسعاف الصحي';
  if (rangeLabel) put(rangeLabel, W - 80, 140, 32, 900, C.gold);
  put('جدول المناوبات', W - 80, 250, 92, 900, '#ffffff');
  cx.fillStyle = C.gold;
  cx.fillRect(W - 80 - 90, 278, 90, 4);
  put(orgName, W - 80, 336, 32, 700, 'rgba(255,255,255,0.92)');

  // ----- Table panel -----
  const panelX = 60;
  const panelY = 386;
  const panelW = W - 120;
  const panelH = 690;
  cx.fillStyle = '#ffffff';
  cx.beginPath();
  cx.roundRect(panelX, panelY, panelW, panelH, 32);
  cx.fill();

  put('المناوبات', W - 110, panelY + 70, 36, 900, C.green);

  const sorted = [...shifts].sort((a, b) => String(a.shift_date).localeCompare(String(b.shift_date)) || String(a.start_time).localeCompare(String(b.start_time)));
  const shown = sorted.length > MAX_ROWS ? sorted.slice(0, MAX_ROWS - 1) : sorted;
  const restCount = sorted.length > MAX_ROWS ? sorted.length - (MAX_ROWS - 1) : 0;

  // Column headers: day/date (right), time (center), members (left-ish wide cell)
  const headY = panelY + 116;
  cx.fillStyle = C.soft;
  cx.fillRect(panelX + 24, headY, panelW - 48, 50);
  const dateColX = W - 110;
  const timeColX = W - 440;
  const membersColRight = W - 580;
  const membersColLeft = panelX + 48;
  put('اليوم والتاريخ', dateColX, headY + 34, 20, 900, C.ink3);
  put('الوقت', timeColX, headY + 34, 20, 900, C.ink3, 'center');
  put('المسعفون', membersColRight, headY + 34, 20, 900, C.ink3);

  const rowH = 56;
  let y = headY + 50;
  const drawRow = (dateText, timeText, membersText, alt) => {
    if (alt) {
      cx.fillStyle = 'rgba(246,248,245,0.9)';
      cx.fillRect(panelX + 24, y, panelW - 48, rowH);
    }
    put(dateText, dateColX, y + 36, 21, 700, C.ink);
    put(timeText, timeColX, y + 36, 19, 800, C.brand, 'center');
    putFit(membersText || '—', membersColRight, y + 36, membersColRight - membersColLeft, 20, 700, C.ink2);
    y += rowH;
  };
  shown.forEach((s, i) => drawRow(
    dayDateLabel(s.shift_date),
    `${timeLabel(s.start_time)} – ${timeLabel(s.end_time)}`,
    (s.members || []).map((m) => m.name).join('، '),
    i % 2 === 1,
  ));
  if (restCount > 0) drawRow(`مناوبات أخرى (${restCount})`, '', '', shown.length % 2 === 1);

  // ----- Emergency bar -----
  if (settings.phone) {
    const barY = 1116;
    cx.fillStyle = 'rgba(11,36,21,0.92)';
    cx.beginPath();
    cx.roundRect(60, barY, W - 120, 118, 28);
    cx.fill();
    cx.strokeStyle = C.gold;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.roundRect(60, barY, W - 120, 118, 28);
    cx.stroke();
    put('للطوارئ', W - 100, barY + 72, 30, 700, C.gold);
    put(settings.phone, 100, barY + 76, 52, 900, '#ffffff', 'left');
  }

  // ----- Footer -----
  put(orgName, W / 2, 1290, 30, 900, '#ffffff', 'center');
  const sub = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  if (sub) put(sub, W / 2, 1328, 22, 700, 'rgba(255,255,255,0.82)', 'center');

  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `جدول-المناوبات-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
