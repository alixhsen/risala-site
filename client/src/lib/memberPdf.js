// Individual monthly report for one team member, as an A4 PDF. Drawn on canvas
// like the monthly report (Arabic shaping and RTL order come from the browser).
import { formatDate } from './api.js';
import { loadBrandLogo, drawBrandLogo } from './pdfLogo.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1240;
const H = 1754;
const M = 80;
const FOOT = 90;
const C = { green: '#0b2415', brand: '#1a5130', gold: '#c5a059', goldText: '#9b783a', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f8fafc', tint: '#eaf4ec' };

export async function generateMemberPdf({ settings, member, monthName, year, missions, services }) {
  const logo = await loadBrandLogo(settings);
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ'))).catch(() => {});

  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const period = `${monthName} ${year}`;
  const totalQty = services.reduce((s, x) => s + (x.quantity || 1), 0);
  const pages = [];
  let cv;
  let cx;
  let y;

  const newPage = (title) => {
    cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    cx = cv.getContext('2d');
    cx.direction = 'rtl';
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, W, H);
    pages.push(cv);
    cx.fillStyle = C.green;
    cx.fillRect(0, 0, W, 120);
    cx.fillStyle = C.gold;
    cx.fillRect(0, 120, W, 6);
    if (logo) drawBrandLogo(cx, logo, W, M);
    put(orgName, W - M - (logo ? 120 : 0), 58, 34, 900, '#ffffff', 'right');
    put(title, W - M - (logo ? 120 : 0), 96, 22, 700, '#cfe0d4', 'right');
    put(period, M, 96, 22, 700, C.gold, 'left');
    y = 180;
  };

  const put = (str, x, yy, size, weight, color, align) => {
    cx.font = `${weight} ${size}px ${FONT}`;
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, x, yy);
  };

  const heading = (label, title) => {
    if (y + 120 > H - FOOT - 30) newPage(title);
    cx.fillStyle = C.gold;
    cx.fillRect(W - M - 6, y + 6, 6, 34);
    put(label, W - M - 22, y + 36, 30, 900, C.ink, 'right');
    y += 76;
  };

  const table = (columns, rows, title, empty) => {
    const rowH = 50;
    const headH = 52;
    const total = W - M * 2;
    const widths = columns.map((c) => c.width * total);
    const drawHead = () => {
      cx.fillStyle = C.soft;
      cx.fillRect(M, y, total, headH);
      let x = W - M;
      columns.forEach((c, i) => {
        x -= widths[i];
        put(c.label, x + widths[i] - 16, y + 34, 20, 900, C.ink3, 'right');
      });
      y += headH;
    };
    heading(title, title);
    if (rows.length === 0) {
      put(empty, W - M, y + 30, 22, 700, C.ink3, 'right');
      y += 60;
      return;
    }
    drawHead();
    rows.forEach((row, r) => {
      if (y + rowH > H - FOOT - 30) {
        newPage(title);
        heading(`${title} (تابع)`, title);
        drawHead();
      }
      if (r % 2 === 1) {
        cx.fillStyle = C.soft;
        cx.fillRect(M, y, total, rowH);
      }
      let x = W - M;
      columns.forEach((c, i) => {
        x -= widths[i];
        put(String(row[i] ?? '—'), x + widths[i] - 16, y + 33, 21, c.strong ? 900 : 700, c.strong ? C.brand : C.ink2, 'right');
      });
      y += rowH;
    });
    cx.fillStyle = C.line;
    cx.fillRect(M, y, total, 2);
    y += 40;
  };

  // ----- Page 1: the member -----
  newPage('التقرير الفردي للمسعف');

  // Member card
  cx.fillStyle = C.soft;
  cx.fillRect(M, y, W - M * 2, 200);
  cx.fillStyle = C.brand;
  cx.fillRect(W - M - 10, y, 10, 200);
  put(member.name, W - M - 40, y + 86, 46, 900, C.ink, 'right');
  const sub = [member.role_title, member.group_name].filter(Boolean).join(' · ');
  put(sub || 'عضو في الفريق', W - M - 40, y + 140, 24, 700, C.ink3, 'right');
  put(`التقرير عن ${period}`, M + 40, y + 140, 22, 700, C.goldText, 'left');
  y += 240;

  // Summary tiles
  const tiles = [
    ['المهام', missions.length, true],
    ['الخدمات المسجّلة', services.length, false],
    ['مجموع الكميات', totalQty, false],
  ];
  const tw = (W - M * 2 - 2 * 24) / 3;
  tiles.forEach(([label, value, dark], i) => {
    const x = W - M - (i + 1) * tw - i * 24;
    cx.fillStyle = dark ? C.brand : C.soft;
    cx.beginPath();
    cx.roundRect(x, y, tw, 170, 22);
    cx.fill();
    put(String(value), x + tw - 24, y + 90, 60, 900, dark ? '#ffffff' : C.brand, 'right');
    put(label, x + tw - 24, y + 140, 22, 700, dark ? '#cfe0d4' : C.ink3, 'right');
  });
  y += 230;

  table(
    [
      { label: 'نوع المهمة', width: 0.26 },
      { label: 'التاريخ', width: 0.2 },
      { label: 'عنوان المهمة', width: 0.54, strong: true },
    ],
    missions.map((m) => [m.type_name || '—', formatDate(m.event_date) || '—', m.title]),
    'المهام المشارَك فيها',
    'لم يُسجَّل مشاركة في مهام خلال هذا الشهر.',
  );

  table(
    [
      { label: 'الكمية', width: 0.12, strong: true },
      { label: 'التاريخ', width: 0.2 },
      { label: 'نوع الخدمة', width: 0.68 },
    ],
    services.map((s) => [s.quantity || 1, formatDate(s.service_date) || '—', s.type_name]),
    'الخدمات الطبية المنفّذة',
    'لم تُسجَّل خدمات طبية لهذا المسعف خلال هذا الشهر.',
  );

  // Footers
  pages.forEach((p, i) => {
    const c = p.getContext('2d');
    c.direction = 'rtl';
    c.fillStyle = C.line;
    c.fillRect(M, H - FOOT, W - M * 2, 2);
    c.font = `400 18px ${FONT}`;
    c.fillStyle = C.ink3;
    c.textAlign = 'right';
    c.fillText(orgName, W - M, H - 52);
    c.textAlign = 'left';
    c.fillText(`صفحة ${i + 1} من ${pages.length}`, M, H - 52);
  });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(p.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  });
  pdf.save(`تقرير-${member.name}-${monthName}-${year}.pdf`);
}
