// Blood-donation summary as a 1080x1350 PNG for social media: aggregate
// counts only (total, this month, breakdown by blood type), plus the call
// number so the image doubles as a call-to-action. A layered gradient,
// vignette and a large faint blood-drop watermark replace the old flat
// green fill; the team logo and the Amal Movement health office logo (the
// partner credited in the footer) sit as a pair of badges in the corner.
import { loadImage } from './cover.js';
import { LOGO, AMAL_LOGO } from './brand.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1080;
const H = 1350;
const C = { green: '#0b2415', brand: '#1a5130', gold: '#c5a059', ink3: '#64748b', line: '#e2e8f0', soft: '#f6f8f5' };
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CREDIT_LINE_1 = 'مركز الإمام علي الهادي (ع) التطوعي';
const CREDIT_LINE_2 = 'و المكتب الصحي لحركة أمل - شعبة بئر حسن';

function dropPath(cx, cxp, cyp, size) {
  cx.beginPath();
  cx.moveTo(cxp, cyp - size * 0.6);
  cx.bezierCurveTo(cxp + size * 0.55, cyp - size * 0.1, cxp + size * 0.42, cyp + size * 0.5, cxp, cyp + size * 0.58);
  cx.bezierCurveTo(cxp - size * 0.42, cyp + size * 0.5, cxp - size * 0.55, cyp - size * 0.1, cxp, cyp - size * 0.6);
  cx.closePath();
}

// Diagonal brand gradient, a soft gold glow behind the header, a large
// barely-visible blood-drop watermark, and a vignette for depth - the "flat
// green background" this replaces had none of these.
function drawBackground(cx) {
  const g = cx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#123420');
  g.addColorStop(0.55, '#0b2415');
  g.addColorStop(1, '#06160d');
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);

  const glow = cx.createRadialGradient(W - 160, 140, 40, W - 160, 140, 560);
  glow.addColorStop(0, 'rgba(197,160,89,0.16)');
  glow.addColorStop(1, 'rgba(197,160,89,0)');
  cx.fillStyle = glow;
  cx.fillRect(0, 0, W, H);

  cx.save();
  cx.globalAlpha = 0.05;
  cx.translate(190, H - 300);
  cx.rotate(-0.1);
  dropPath(cx, 0, 0, 480);
  cx.fillStyle = '#ffffff';
  cx.fill();
  cx.restore();

  const vin = cx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
  vin.addColorStop(0, 'rgba(0,0,0,0)');
  vin.addColorStop(1, 'rgba(0,0,0,0.38)');
  cx.fillStyle = vin;
  cx.fillRect(0, 0, W, H);

  cx.fillStyle = 'rgba(197,160,89,0.55)';
  cx.fillRect(0, 0, W, 2);
}

function drawLogoBadge(cx, logo, cxp, cyp, r) {
  if (!logo) return;
  cx.save();
  cx.beginPath();
  cx.arc(cxp, cyp, r, 0, Math.PI * 2);
  cx.clip();
  cx.fillStyle = '#fff';
  cx.fillRect(cxp - r, cyp - r, r * 2, r * 2);
  const s = Math.min((r * 2 - 14) / logo.width, (r * 2 - 14) / logo.height);
  const w = logo.width * s;
  const h = logo.height * s;
  cx.drawImage(logo, cxp - w / 2, cyp - h / 2, w, h);
  cx.restore();
  cx.strokeStyle = C.gold;
  cx.lineWidth = 3;
  cx.beginPath();
  cx.arc(cxp, cyp, r + 3, 0, Math.PI * 2);
  cx.stroke();
}

export async function generateBloodDonationsSocial({ settings, rows }) {
  if (document.fonts) {
    await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Cairo"`, 'أ'))).catch(() => {});
  }
  const [logo, amalLogo] = await Promise.all([
    loadImage(settings.logo_url || LOGO).catch(() => null),
    loadImage(AMAL_LOGO).catch(() => null),
  ]);

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  cx.direction = 'rtl';
  drawBackground(cx);

  const put = (str, x, y, size, weight, color, align = 'right') => {
    cx.font = `${weight} ${size}px ${FONT}`;
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, x, y);
  };

  const now = new Date();
  const thisMonth = rows.filter((r) => {
    const d = new Date(r.donation_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const byType = BLOOD_TYPES
    .map((t) => ({ name: t, count: rows.filter((r) => r.blood_type === t).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  // ----- Header: logo badges top-left, title block top-right -----
  drawLogoBadge(cx, logo, 116, 86, 36);
  drawLogoBadge(cx, amalLogo, 202, 86, 36);

  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  put('تقرير', W - 80, 140, 34, 900, C.gold);
  put('التبرّع بالدم', W - 80, 250, 96, 900, '#ffffff');
  cx.fillStyle = C.gold;
  cx.fillRect(W - 80 - 90, 278, 90, 4);
  put(orgName, W - 80, 336, 32, 700, 'rgba(255,255,255,0.92)');

  // ----- Breakdown panel -----
  const panelX = 60;
  const panelY = 386;
  const panelW = W - 120;
  const panelH = 620;
  cx.fillStyle = '#ffffff';
  cx.beginPath();
  cx.roundRect(panelX, panelY, panelW, panelH, 32);
  cx.fill();
  put('التبرعات حسب فصيلة الدم', W - 110, panelY + 70, 36, 900, C.green);

  const headY = panelY + 116;
  cx.fillStyle = C.soft;
  cx.fillRect(panelX + 24, headY, panelW - 48, 50);
  put('الفصيلة', W - 110, headY + 34, 22, 900, C.ink3);
  put('العدد', 110, headY + 34, 22, 900, C.ink3, 'left');

  const rowH = 46;
  let y = headY + 50;
  if (byType.length === 0) {
    put('لا تبرعات مسجّلة بعد', W / 2, y + 60, 24, 700, C.ink3, 'center');
  } else {
    byType.forEach((t, i) => {
      if (i % 2 === 1) {
        cx.fillStyle = 'rgba(246,248,245,0.9)';
        cx.fillRect(panelX + 24, y, panelW - 48, rowH);
      }
      put(t.name, W - 110, y + 31, 25, 900, C.brand);
      put(String(t.count), 110, y + 32, 26, 900, C.brand, 'left');
      y += rowH;
    });
  }

  // Total row
  const totalY = panelY + panelH - 112;
  cx.fillStyle = C.line;
  cx.fillRect(panelX + 24, totalY - 14, panelW - 48, 2);
  cx.fillStyle = C.green;
  cx.beginPath();
  cx.roundRect(panelX + 24, totalY, panelW - 48, 80, 22);
  cx.fill();
  put('الإجمالي', W - 110, totalY + 52, 32, 900, C.gold);
  put(String(rows.length), 110, totalY + 56, 50, 900, '#ffffff', 'left');
  put(`${thisMonth.length} تبرّع هذا الشهر`, W / 2 + 40, totalY + 50, 22, 700, 'rgba(255,255,255,0.85)', 'center');

  // ----- Call bar -----
  let bloodPhones = [];
  try { bloodPhones = JSON.parse(settings.blood_phones || '[]').filter(Boolean); } catch { bloodPhones = []; }
  const callNumber = bloodPhones[0] || settings.phone;
  if (callNumber) {
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
    put('للتبرّع اتصل', W - 100, barY + 72, 30, 700, C.gold);
    put(callNumber, 100, barY + 76, 52, 900, '#ffffff', 'left');
  }

  // ----- Footer -----
  put(CREDIT_LINE_1, W / 2, 1282, 28, 900, '#ffffff', 'center');
  put(CREDIT_LINE_2, W / 2, 1320, 22, 700, 'rgba(255,255,255,0.82)', 'center');

  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `تقرير-التبرع-بالدم-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
