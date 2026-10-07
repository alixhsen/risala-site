// Monthly report as an A4 PDF. Each page is drawn on a canvas (so Arabic shaping
// and right-to-left order come from the browser, as in the receipt), then placed
// into a jsPDF page. Long tables continue on the next page with their header.
import { formatDate } from './api.js';
import { loadBrandLogo, drawBrandLogo } from './pdfLogo.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1240; // A4 at 150 dpi
const H = 1754;
const M = 80; // page margin
const C = {
  green: '#0b2415', brand: '#1a5130', link: '#22743a', gold: '#c5a059', goldText: '#9b783a',
  ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f8fafc', tint: '#eaf4ec',
};

async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ')))
    .catch(() => {});
}

export async function generateMonthlyPdf({ settings, data }) {
  const logo = await loadBrandLogo(settings);
  await loadFonts();
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const orgLine = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  const period = `${data.monthName} ${data.year}`;
  const generated = formatDate(new Date().toISOString());

  const pages = [];
  let canvas;
  let ctx;
  let y;
  const footerH = 90;

  function startPage(title) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    ctxRef = ctx;
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    pages.push(canvas);
    // Running header on every page
    ctx.fillStyle = C.green;
    ctx.fillRect(0, 0, W, 120);
    ctx.fillStyle = C.gold;
    ctx.fillRect(0, 120, W, 6);
    if (logo) drawBrandLogo(ctx, logo, W, M);
    text(orgName, W - M - (logo ? 120 : 0), 58, { size: 34, weight: 900, color: '#ffffff', align: 'right' });
    text(title, W - M - (logo ? 120 : 0), 96, { size: 22, weight: 700, color: '#cfe0d4', align: 'right' });
    text(period, M, 96, { size: 22, weight: 700, color: C.gold, align: 'left' });
    y = 180;
  }

  function finishPages() {
    pages.forEach((cv, i) => {
      const cx = cv.getContext('2d');
      cx.direction = 'ltr';
      cx.fillStyle = C.line;
      cx.fillRect(M, H - footerH, W - M * 2, 2);
      cx.direction = 'rtl';
      draw(cx, `${orgLine || orgName}`, W - M, H - 52, { size: 18, color: C.ink3, align: 'right' });
      draw(cx, `صفحة ${i + 1} من ${pages.length}`, M, H - 52, { size: 18, color: C.ink3, align: 'left' });
      draw(cx, `أُنشئ بتاريخ ${generated}`, W / 2, H - 52, { size: 18, color: C.ink3, align: 'center' });
    });
  }

  function ensure(space, title) {
    if (y + space > H - footerH - 30) startPage(title);
  }

  function sectionTitle(label) {
    ensure(120, label);
    ctx.fillStyle = C.gold;
    ctx.fillRect(W - M - 6, y + 6, 6, 34);
    text(label, W - M - 22, y + 36, { size: 30, weight: 900, color: C.ink, align: 'right' });
    y += 76;
  }

  function table(columns, rows, title, emptyText) {
    const rowH = 50;
    const headH = 52;
    const widthTotal = W - M * 2;
    const widths = columns.map((c) => c.width * widthTotal);

    const drawHeader = () => {
      ctx.fillStyle = C.soft;
      ctx.fillRect(M, y, widthTotal, headH);
      let x = W - M;
      columns.forEach((c, i) => {
        x -= widths[i];
        text(c.label, x + widths[i] - 16, y + 34, { size: 20, weight: 900, color: C.ink3, align: 'right' });
      });
      y += headH;
    };

    sectionTitle(title);
    if (rows.length === 0) {
      ensure(60, title);
      text(emptyText, W - M, y + 34, { size: 22, color: C.ink3, align: 'right' });
      y += 60;
      return;
    }
    ensure(headH + rowH, title);
    drawHeader();
    rows.forEach((row, r) => {
      if (y + rowH > H - footerH - 30) {
        startPage(title);
        sectionTitle(`${title} (تابع)`);
        drawHeader();
      }
      if (r % 2 === 1) {
        ctx.fillStyle = C.soft;
        ctx.fillRect(M, y, widthTotal, rowH);
      }
      let x = W - M;
      columns.forEach((c, i) => {
        x -= widths[i];
        const value = row[i];
        text(String(value ?? '—'), x + widths[i] - 16, y + 33, {
          size: c.strong ? 22 : 21,
          weight: c.strong ? 900 : 700,
          color: c.strong ? C.brand : C.ink2,
          align: 'right',
        });
      });
      y += rowH;
    });
    ctx.fillStyle = C.line;
    ctx.fillRect(M, y, widthTotal, 2);
    y += 40;
  }

  // ----- Page 1: summary -----
  startPage('التقرير الشهري');
  text('ملخص الشهر', W - M, y + 30, { size: 34, weight: 900, color: C.ink, align: 'right' });
  y += 70;

  const kpis = [
    ['المهام المنفّذة', data.missionsTotal],
    ['المسعفون المشاركون', data.paramedics.length],
    ['الخدمات الطبية', data.servicesTotal],
    ['أنواع المهام', Object.keys(data.typeCounts).length],
  ];
  const boxW = (W - M * 2 - 3 * 24) / 4;
  kpis.forEach(([label, value], i) => {
    const x = W - M - (i + 1) * boxW - i * 24;
    ctx.fillStyle = i === 0 ? C.brand : C.soft;
    roundRect(x, y, boxW, 170, 22);
    ctx.fill();
    const onDark = i === 0;
    text(String(value), x + boxW - 24, y + 90, { size: 60, weight: 900, color: onDark ? '#ffffff' : C.brand, align: 'right' });
    text(label, x + boxW - 24, y + 140, { size: 22, weight: 700, color: onDark ? '#cfe0d4' : C.ink3, align: 'right' });
  });
  y += 230;

  // Mission types as horizontal bars
  const typeRows = Object.entries(data.typeCounts).sort((a, b) => b[1] - a[1]);
  sectionTitle('المهام حسب النوع');
  if (typeRows.length === 0) {
    text('لا مهام مسجّلة لهذا الشهر.', W - M, y + 30, { size: 22, color: C.ink3, align: 'right' });
    y += 60;
  } else {
    const max = Math.max(...typeRows.map(([, v]) => v));
    typeRows.forEach(([name, value], i) => {
      ensure(70, 'المهام حسب النوع');
      const labelW = 380;
      text(name, W - M, y + 30, { size: 22, weight: 700, color: C.ink2, align: 'right' });
      const barMax = W - M * 2 - labelW - 120;
      const bw = Math.max(6, (value / max) * barMax);
      ctx.fillStyle = i % 2 ? C.gold : C.brand;
      roundRect(W - M - labelW - bw, y + 10, bw, 26, 8);
      ctx.fill();
      text(String(value), M + 60, y + 32, { size: 22, weight: 900, color: C.brand, align: 'left' });
      y += 52;
    });
    y += 30;
  }

  // ----- Tables -----
  table(
    [
      { label: 'عدد المهام', width: 0.16, strong: true },
      { label: 'المجموعة', width: 0.26 },
      { label: 'المسعف', width: 0.58 },
    ],
    data.paramedics.map((p) => [p.count, p.group_name || '—', p.name]),
    'مهام المسعفين',
    'لا مهام مرتبطة بأسماء خلال هذا الشهر.',
  );

  table(
    [
      { label: 'عدد الخدمات', width: 0.16, strong: true },
      { label: 'المجموعة', width: 0.26 },
      { label: 'المسعف', width: 0.58 },
    ],
    data.serviceParamedics.map((p) => [p.count, p.group_name || '—', p.name]),
    'الخدمات الطبية حسب المسعف',
    'لا خدمات مسجّلة لأسماء محدّدة خلال هذا الشهر.',
  );

  table(
    [
      { label: 'العدد', width: 0.2, strong: true },
      { label: 'نوع الخدمة', width: 0.8 },
    ],
    data.serviceTypes.map((t) => [t.count, t.name]),
    'الخدمات الطبية حسب النوع',
    'لا خدمات مسجّلة خلال هذا الشهر.',
  );

  finishPages();

  // ----- Assemble the PDF -----
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((cv, i) => {
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  });
  pdf.save(`تقرير-شهري-${data.monthName}-${data.year}.pdf`);
}

// ----- drawing helpers -----
function text(str, x, yPos, { size = 22, weight = 400, color = C.ink, align = 'right' } = {}) {
  draw(ctxRef, str, x, yPos, { size, weight, color, align });
}
let ctxRef = null;
function draw(cx, str, x, yPos, { size = 22, weight = 400, color = C.ink, align = 'right' } = {}) {
  cx.font = `${weight} ${size}px ${FONT}`;
  cx.fillStyle = color;
  cx.textAlign = align;
  cx.textBaseline = 'alphabetic';
  cx.fillText(str, x, yPos);
}
function roundRect(x, y, w, h, r) {
  ctxRef.beginPath();
  ctxRef.moveTo(x + r, y);
  ctxRef.arcTo(x + w, y, x + w, y + h, r);
  ctxRef.arcTo(x + w, y + h, x, y + h, r);
  ctxRef.arcTo(x, y + h, x, y, r);
  ctxRef.arcTo(x, y, x + w, y, r);
  ctxRef.closePath();
}
