// Blood-donation summary as a single-page A4 PDF: aggregate counts only
// (total, this month, breakdown by blood type) - no donor names or contact
// info, so it's safe to hand out or post publicly. Styled like the monthly
// report PDF (see monthlyPdf.js) but trimmed to one page.
import { formatDate } from './api.js';
import { loadBrandLogo, loadAmalLogo, drawLogoTile } from './pdfLogo.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1240; // A4 at 150 dpi
const H = 1754;
const M = 80;
const C = {
  green: '#0b2415', brand: '#1a5130', gold: '#c5a059',
  ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f8fafc',
};
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CREDIT_LINE_1 = 'مركز الإمام علي الهادي (ع) التطوعي';
const CREDIT_LINE_2 = 'و المكتب الصحي لحركة أمل - شعبة بئر حسن';

async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ'))).catch(() => {});
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

export async function generateBloodDonationsPdf({ settings, rows }) {
  const [logo, amalLogo] = await Promise.all([loadBrandLogo(settings), loadAmalLogo()]);
  await loadFonts();
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const generated = formatDate(new Date().toISOString());

  const now = new Date();
  const thisMonth = rows.filter((r) => {
    const d = new Date(r.donation_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const byType = BLOOD_TYPES
    .map((t) => ({ name: t, count: rows.filter((r) => r.blood_type === t).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  const topType = byType[0];

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const cx = canvas.getContext('2d');
  cx.direction = 'rtl';
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, W, H);

  const text = (str, x, y, { size = 22, weight = 400, color = C.ink, align = 'right' } = {}) => {
    cx.font = `${weight} ${size}px ${FONT}`;
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, x, y);
  };

  // Header - team logo and the partner (Amal Movement health office) logo
  // side by side, since the footer credits both organizations.
  cx.fillStyle = C.green;
  cx.fillRect(0, 0, W, 120);
  cx.fillStyle = C.gold;
  cx.fillRect(0, 120, W, 6);
  let logosW = 0;
  if (logo) { drawLogoTile(cx, logo, W - M - 96, 12, 96); logosW += 96; }
  if (amalLogo) { drawLogoTile(cx, amalLogo, W - M - logosW - (logosW ? 104 : 96), 12, 96); logosW += logosW ? 104 : 96; }
  const titleX = W - M - logosW - (logosW ? 24 : 0);
  text(orgName, titleX, 58, { size: 34, weight: 900, color: '#ffffff', align: 'right' });
  text('تقرير التبرع بالدم', titleX, 96, { size: 22, weight: 700, color: '#cfe0d4', align: 'right' });
  text(generated, M, 96, { size: 22, weight: 700, color: C.gold, align: 'left' });

  let y = 200;
  text('نظرة عامة', W - M, y, { size: 34, weight: 900, color: C.ink, align: 'right' });
  y += 50;

  // KPI boxes
  const boxW = (W - M * 2 - 2 * 24) / 3;
  const kpis = [
    ['إجمالي التبرعات', rows.length],
    ['تبرعات هذا الشهر', thisMonth.length],
    ['الفصيلة الأكثر طلباً', topType ? topType.name : '—'],
  ];
  kpis.forEach(([label, value], i) => {
    const x = W - M - (i + 1) * boxW - i * 24;
    cx.fillStyle = i === 0 ? C.brand : C.soft;
    roundRect(cx, x, y, boxW, 170, 22);
    cx.fill();
    const onDark = i === 0;
    text(String(value), x + boxW - 24, y + 90, { size: 54, weight: 900, color: onDark ? '#ffffff' : C.brand, align: 'right' });
    text(label, x + boxW - 24, y + 140, { size: 22, weight: 700, color: onDark ? '#cfe0d4' : C.ink3, align: 'right' });
  });
  y += 210;

  // Breakdown by blood type - horizontal bars
  cx.fillStyle = C.gold;
  cx.fillRect(W - M - 6, y - 28, 6, 34);
  text('التبرعات حسب فصيلة الدم', W - M - 22, y, { size: 30, weight: 900, color: C.ink, align: 'right' });
  y += 50;

  if (byType.length === 0) {
    text('لا تبرعات مسجّلة بعد.', W - M, y + 20, { size: 22, color: C.ink3, align: 'right' });
    y += 60;
  } else {
    const max = Math.max(...byType.map((t) => t.count));
    byType.forEach((t, i) => {
      const labelW = 160;
      text(t.name, W - M, y + 30, { size: 24, weight: 900, color: C.brand, align: 'right' });
      const barMax = W - M * 2 - labelW - 120;
      const bw = Math.max(6, (t.count / max) * barMax);
      cx.fillStyle = i % 2 ? C.gold : C.brand;
      roundRect(cx, W - M - labelW - bw, y + 8, bw, 28, 8);
      cx.fill();
      text(String(t.count), M + 60, y + 30, { size: 22, weight: 900, color: C.brand, align: 'left' });
      y += 54;
    });
    y += 30;
  }

  // Footer: organization credit line + generated-on note
  cx.fillStyle = C.line;
  cx.fillRect(M, H - 160, W - M * 2, 2);
  text(CREDIT_LINE_1, W / 2, H - 110, { size: 26, weight: 900, color: C.brand, align: 'center' });
  text(CREDIT_LINE_2, W / 2, H - 76, { size: 22, weight: 700, color: C.ink2, align: 'center' });
  text(`أُنشئ بتاريخ ${generated}`, W / 2, H - 40, { size: 18, color: C.ink3, align: 'center' });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  pdf.save(`تقرير-التبرع-بالدم-${new Date().toISOString().slice(0, 10)}.pdf`);
}
