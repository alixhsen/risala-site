// Inventory report as an A4 PDF: stock register, usage for the period, and
// loans. Drawn on canvas (Arabic shaping and RTL order come from the browser).
import { formatDate } from './api.js';
import { loadBrandLogo, drawBrandLogo } from './pdfLogo.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1240;
const H = 1754;
const M = 80;
const FOOT = 90;
const C = { green: '#0b2415', brand: '#1a5130', gold: '#c5a059', goldText: '#9b783a', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f8fafc', urgent: '#c0272d', urgentBg: '#fdf0f0', warn: '#8a5b00', warnBg: '#fbf1d9', ok: '#15803d', okBg: '#ecfdf3' };

// Same expiry rule as the admin inventory page.
export function expiryOf(dateStr) {
  if (!dateStr) return { key: 'none', label: 'لا ينتهي' };
  const days = (new Date(dateStr) - new Date(new Date().toDateString())) / 86400000;
  if (days < 0) return { key: 'expired', label: 'منتهي الصلاحية' };
  if (days <= 30) return { key: 'expiring', label: 'قريب الانتهاء' };
  return { key: 'ok', label: 'صالح' };
}

export async function generateInventoryPdf({ settings, periodLabel, items, usage, loans }) {
  const logo = await loadBrandLogo(settings);
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ'))).catch(() => {});

  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const orgLine = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  const generated = formatDate(new Date().toISOString());
  const pages = [];
  let cv;
  let cx;
  let y;

  const put = (str, x, yy, size, weight, color, align) => {
    cx.font = `${weight} ${size}px ${FONT}`;
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, x, yy);
  };

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
    put(periodLabel, M, 96, 22, 700, C.gold, 'left');
    y = 180;
  };

  const heading = (label, title) => {
    if (y + 120 > H - FOOT - 30) newPage(title);
    cx.fillStyle = C.gold;
    cx.fillRect(W - M - 6, y + 6, 6, 34);
    put(label, W - M - 22, y + 36, 30, 900, C.ink, 'right');
    y += 76;
  };

  // A table whose cells can carry a tone (for expiry and status chips).
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
        const cell = row[i];
        if (cell && typeof cell === 'object') {
          const label = String(cell.text);
          if (cell.tone) {
            cx.font = `900 19px ${FONT}`;
            const tw = cx.measureText(label).width + 26;
            cx.fillStyle = cell.tone === 'urgent' ? C.urgentBg : cell.tone === 'warn' ? C.warnBg : cell.tone === 'ok' ? C.okBg : C.soft;
            cx.beginPath();
            cx.roundRect(x + widths[i] - 16 - tw, y + 11, tw, 30, 15);
            cx.fill();
            put(label, x + widths[i] - 16 - tw / 2, y + 32, 19, 900, cell.tone === 'urgent' ? C.urgent : cell.tone === 'warn' ? C.warn : cell.tone === 'ok' ? C.ok : C.ink2, 'center');
          } else {
            put(label, x + widths[i] - 16, y + 33, 21, 700, C.ink2, 'right');
          }
        } else {
          put(String(cell ?? '—'), x + widths[i] - 16, y + 33, 21, c.strong ? 900 : 700, c.strong ? C.brand : C.ink2, 'right');
        }
      });
      y += rowH;
    });
    cx.fillStyle = C.line;
    cx.fillRect(M, y, total, 2);
    y += 40;
  };

  // ----- Page 1: summary -----
  newPage('تقرير المخزون');
  const expiring = items.filter((i) => expiryOf(i.expiry_date).key === 'expiring').length;
  const expired = items.filter((i) => expiryOf(i.expiry_date).key === 'expired').length;
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const usedQty = usage.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const out = loans.filter((l) => l.status !== 'returned').length;

  put('ملخص المخزون', W - M, y + 30, 34, 900, C.ink, 'right');
  y += 70;
  const kpis = [
    ['أصناف المخزون', items.length, true],
    ['إجمالي الكميات', totalQty, false],
    ['قريبة الانتهاء', expiring, false],
    ['منتهية الصلاحية', expired, false],
    ['مستهلك في الفترة', usedQty, false],
    ['عُهد خارجة', out, false],
  ];
  const bw = (W - M * 2 - 2 * 20) / 3;
  kpis.forEach(([label, value, dark], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = W - M - (col + 1) * bw - col * 20;
    const yy = y + row * (150 + 20);
    cx.fillStyle = dark ? C.brand : C.soft;
    cx.beginPath();
    cx.roundRect(x, yy, bw, 150, 20);
    cx.fill();
    put(String(value), x + bw - 22, yy + 80, 52, 900, dark ? '#ffffff' : C.brand, 'right');
    put(label, x + bw - 22, yy + 126, 21, 700, dark ? '#cfe0d4' : C.ink3, 'right');
  });
  y += 2 * (150 + 20) + 24;

  // ----- Stock register -----
  const stockRows = items.map((i) => {
    const ex = expiryOf(i.expiry_date);
    const tone = ex.key === 'expired' ? 'urgent' : ex.key === 'expiring' ? 'warn' : ex.key === 'ok' ? 'ok' : null;
    return [
      Number(i.quantity) || 0,
      i.unit || '—',
      i.name,
      { text: ex.label, tone },
      i.expiry_date ? formatDate(i.expiry_date) : '—',
      i.source || '—',
    ];
  });
  table(
    [
      { label: 'الكمية', width: 0.09, strong: true },
      { label: 'الوحدة', width: 0.1 },
      { label: 'المادة', width: 0.26, strong: true },
      { label: 'الصلاحية', width: 0.18 },
      { label: 'تاريخ الانتهاء', width: 0.15 },
      { label: 'المصدر', width: 0.22 },
    ],
    stockRows,
    'سجلّ المخزون',
    'لا مواد مسجّلة في المخزون.',
  );

  // ----- Usage per item for the period -----
  const byItem = new Map();
  for (const r of usage) {
    const key = r.item_name;
    const cur = byItem.get(key) || { unit: r.unit, qty: 0, uses: 0, last: null };
    cur.qty += Number(r.quantity) || 0;
    cur.uses += 1;
    if (!cur.last || new Date(r.used_at) > new Date(cur.last)) cur.last = r.used_at;
    byItem.set(key, cur);
  }
  const usageRows = [...byItem.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => [v.last ? formatDate(v.last) : '—', v.uses, `${v.qty}${v.unit ? ` ${v.unit}` : ''}`, name]);
  table(
    [
      { label: 'آخر استخدام', width: 0.2 },
      { label: 'عدد المرات', width: 0.14 },
      { label: 'الكمية', width: 0.16, strong: true },
      { label: 'المادة', width: 0.5, strong: true },
    ],
    usageRows,
    'الاستهلاك خلال الفترة',
    'لا استخدامات مسجّلة في هذه الفترة.',
  );

  // ----- Loans -----
  const loanRows = loans.map((l) => {
    const returned = l.status === 'returned';
    return [
      { text: returned ? 'أُعيدت' : 'قيد العهدة', tone: returned ? 'ok' : 'warn' },
      l.recipient_name || '—',
      l.item_name,
      formatDate(l.loan_date) || '—',
    ];
  });
  table(
    [
      { label: 'الحالة', width: 0.18 },
      { label: 'المستلم', width: 0.3 },
      { label: 'الغرض', width: 0.32, strong: true },
      { label: 'تاريخ التسليم', width: 0.2 },
    ],
    loanRows,
    'العُهد',
    'لا عُهد مسجّلة.',
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
    c.fillText(orgLine || orgName, W - M, H - 52);
    c.textAlign = 'left';
    c.fillText(`صفحة ${i + 1} من ${pages.length} · أُنشئ ${generated}`, M, H - 52);
  });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(p.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  });
  pdf.save(`تقرير-المخزون-${periodLabel.replace(/[\\/:*?"<>|]/g, '')}.pdf`);
}
