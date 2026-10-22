// Monthly report as a 1080 x 1350 PNG for social media. Background: a mosaic
// of several team photos under a dark shade. One table lists every mission
// type and service type with its count, and a total closes the table.
import { loadImage } from './cover.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1080;
const H = 1350;
const MAX_ROWS = 9;
const C = { green: '#0b2415', brand: '#1a5130', gold: '#c5a059', goldText: '#9b783a', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f6f8f5' };

export async function generateSocialReport({ settings, data, photoUrls = [] }) {
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Cairo"`, 'أ'))).catch(() => {});

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  cx.direction = 'rtl';

  // ----- Background: photo mosaic -----
  cx.fillStyle = C.green;
  cx.fillRect(0, 0, W, H);
  const photos = [];
  for (const url of photoUrls) {
    try { photos.push(await loadImage(url)); } catch { /* skip a photo that fails */ }
  }
  if (photos.length) {
    // Photo grid with feathered tile edges: each tile fades into its neighbours,
    // so the seams blend. A blurred first photo sits underneath to fill any gaps.
    const cols = 3;
    const rows = 4;
    const tw = W / cols;
    const th = H / rows;
    const f = 90;
    const cover = (ctx, img, w, h) => {
      const s = Math.max(w / img.width, h / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
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
        // Feather only the inner seams; outer edges of the whole grid stay solid.
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
  // Shade: dark overall, stronger toward the bottom where the panel sits
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

  // ----- Header -----
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للاسعاف الصحي';
  const isYearly = !data.monthName;
  put(isYearly ? 'التقرير السنوي' : 'التقرير الشهري', W - 80, 140, 34, 900, C.gold);
  put(isYearly ? `${data.year}` : `${data.monthName} ${data.year}`, W - 80, 250, 102, 900, '#ffffff');
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

  put('المهام والخدمات', W - 110, panelY + 70, 36, 900, C.green);

  // Mission types get their own breakdown (rolled up into "other" if there
  // are too many to fit); services, activities and both kinds of donation
  // each appear as one fixed total row, counted against the same row budget
  // so they're never squeezed out by a long mission-type breakdown. Any row
  // - mission type or fixed total - with nothing to show is left out.
  const missionRows = Object.entries(data.typeCounts)
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const fixedRows = [
    { name: 'الخدمات الطبية', count: data.servicesTotal },
    { name: 'الأنشطة', count: data.activitiesTotal },
    { name: 'التبرع بالدم', count: data.bloodDonationsTotal },
    { name: 'الخدمات العينية', count: data.communityDonationsQuantity },
  ].filter((r) => r.count > 0);

  const missionBudget = Math.max(0, MAX_ROWS - fixedRows.length);
  let shownMissions = missionRows;
  let overflowRow = null;
  if (missionRows.length > missionBudget) {
    const keep = Math.max(0, missionBudget - 1);
    shownMissions = missionRows.slice(0, keep);
    const restCount = missionRows.slice(keep).reduce((s, r) => s + r.count, 0);
    overflowRow = { name: `أنواع مهام أخرى (${missionRows.length - keep})`, count: restCount };
  }

  const shown = [...shownMissions, ...fixedRows, ...(overflowRow ? [overflowRow] : [])]
    .sort((a, b) => b.count - a.count);

  // Column headers
  const headY = panelY + 116;
  cx.fillStyle = C.soft;
  cx.fillRect(panelX + 24, headY, panelW - 48, 50);
  put('النوع', W - 110, headY + 34, 22, 900, C.ink3);
  put('العدد', 110, headY + 34, 22, 900, C.ink3, 'left');

  // Body rows
  const rowH = 46;
  let y = headY + 50;
  const drawRow = (name, count, alt) => {
    if (alt) {
      cx.fillStyle = 'rgba(246,248,245,0.9)';
      cx.fillRect(panelX + 24, y, panelW - 48, rowH);
    }
    put(name, W - 110, y + 31, 25, 700, C.ink);
    put(String(count), 110, y + 32, 26, 900, C.brand, 'left');
    y += rowH;
  };
  shown.forEach((r, i) => drawRow(r.name, r.count, i % 2 === 1));

  // Total row - every row in the table above, not just missions and
  // services: mission types (missionsTotal covers all of them, counted once
  // even when some are rolled into the "other" overflow row) plus every
  // fixed row (services, activities, blood donations, community donations).
  const total = data.missionsTotal + data.servicesTotal + data.activitiesTotal
    + data.bloodDonationsTotal + data.communityDonationsQuantity;
  const totalY = panelY + panelH - 112;
  cx.fillStyle = C.line;
  cx.fillRect(panelX + 24, totalY - 14, panelW - 48, 2);
  cx.fillStyle = C.green;
  cx.beginPath();
  cx.roundRect(panelX + 24, totalY, panelW - 48, 80, 22);
  cx.fill();
  put('الإجمالي', W - 110, totalY + 52, 32, 900, C.gold);
  put(`${total}`, 110, totalY + 56, 50, 900, '#ffffff', 'left');

  // ----- Emergency bar -----
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
  if (settings.phone) put(settings.phone, 100, barY + 76, 52, 900, '#ffffff', 'left');

  // ----- Footer -----
  put(orgName, W / 2, 1290, 30, 900, '#ffffff', 'center');
  const sub = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  if (sub) put(sub, W / 2, 1328, 22, 700, 'rgba(255,255,255,0.82)', 'center');

  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = isYearly ? `تقرير-سنوي-${data.year}.png` : `تقرير-${data.monthName}-${data.year}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
