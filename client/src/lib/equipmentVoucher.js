// Custody receipt form (نموذج استلام عهدة): an official A4 document handed to
// the member to sign. Drawn on a canvas for correct Arabic shaping and RTL
// order, then placed into jsPDF pages (more than one when the list is long).
import { loadImage } from './cover.js';
import { formatDate } from './api.js';
import { memberNo } from './equipment.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1000;
const H = 1414;
const M = 64;
const C = { green: '#0b2415', gold: '#c5a059', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#dfe5e0', soft: '#f6f8f5', head: '#1a5130' };

export const PLEDGE = 'أتعهّد أنا الموقّع أدناه بالمحافظة على الأغراض المبيّنة أعلاه وصيانتها واستعمالها في خدمة الفرقة حصراً، وبإعادتها كاملة وبحالة سليمة عند طلب الإدارة، وعند توقفي عن الخدمة أو انسحابي أو فصلي من الفرقة. وأتحمّل مسؤولية أي تلف أو فقدان ناتج عن إهمالي.';

function wrapText(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Splits the items across pages; the last page also holds the pledge and signatures.
function paginate(n) {
  const pages = [];
  let left = n;
  let first = true;
  for (;;) {
    const lastCap = first ? 6 : 11;
    const midCap = first ? 11 : 20;
    if (left <= lastCap) { pages.push(left); break; }
    pages.push(midCap);
    left -= midCap;
    first = false;
  }
  return pages;
}

export async function buildVoucherPdf({ settings, issue, items }) {
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ'))).catch(() => {});
  let logo = null;
  if (settings.logo_url) { try { logo = await loadImage(settings.logo_url); } catch { /* no logo */ } }
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const orgLine = [settings.line2, settings.line3].filter(Boolean).join(' — ');
  const formNo = `EQ-${String(issue.id).padStart(5, '0')}`;
  const plan = paginate(items.length);
  const canvases = [];
  let cursor = 0;

  plan.forEach((count, pi) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext('2d');
    canvases.push(cv);
    cx.direction = 'rtl';
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, W, H);
    const isFirst = pi === 0;
    const isLast = pi === plan.length - 1;
    const put = (str, x, y, size, weight, color, align = 'right') => {
      cx.font = `${weight} ${size}px ${FONT}`;
      cx.fillStyle = color;
      cx.textAlign = align;
      cx.textBaseline = 'alphabetic';
      cx.fillText(str, x, y);
    };

    // header band
    cx.fillStyle = C.green;
    cx.fillRect(0, 0, W, 160);
    cx.fillStyle = C.gold;
    cx.fillRect(0, 160, W, 6);
    const tile = 100;
    const tileX = W - M - tile;
    cx.fillStyle = '#ffffff';
    roundRect(cx, tileX, 30, tile, tile, 18);
    cx.fill();
    if (logo) {
      const s = Math.min((tile - 16) / logo.width, (tile - 16) / logo.height);
      cx.drawImage(logo, tileX + (tile - logo.width * s) / 2, 30 + (tile - logo.height * s) / 2, logo.width * s, logo.height * s);
    }
    put(orgName, tileX - 24, 74, 32, 900, '#ffffff');
    put(orgLine, tileX - 24, 108, 18, 700, '#cfe0d4');
    put('وثيقة رسمية · إدارة العُهد والتجهيزات', tileX - 24, 138, 16, 900, C.gold);

    let y = 232;
    put('نموذج استلام عهدة', W - M, y, 42, 900, C.ink);
    put(`رقم النموذج ${formNo}`, W - M, y + 36, 18, 700, C.ink3);
    if (plan.length > 1) put(`صفحة ${pi + 1} من ${plan.length}`, M, y + 36, 18, 700, C.ink3, 'left');
    y += 70;

    if (isFirst) {
      const tiles = [
        ['اسم العضو', issue.member_name],
        ['رقم العضو', memberNo(issue.member_id)],
        ['تاريخ التسليم', formatDate(issue.issue_date)],
        ['المسؤول عن التسليم', issue.issuer_name],
      ];
      const gap = 16;
      const tw = (W - M * 2 - gap) / 2;
      tiles.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = W - M - tw - col * (tw + gap);
        const ty = y + row * 96;
        cx.fillStyle = C.soft;
        roundRect(cx, x, ty, tw, 82, 14);
        cx.fill();
        put(label, x + tw - 20, ty + 30, 16, 700, C.ink3);
        let size = 26;
        cx.font = `900 ${size}px ${FONT}`;
        while (size > 16 && cx.measureText(value || '—').width > tw - 40) { size -= 1; cx.font = `900 ${size}px ${FONT}`; }
        put(value || '—', x + tw - 20, ty + 64, size, 900, C.ink);
      });
      y += 2 * 96 + 14;
    }

    // items table
    const cols = [
      { label: 'م', w: 50 },
      { label: 'الغرض', w: 340 },
      { label: 'المقاس', w: 130 },
      { label: 'الرقم التسلسلي', w: 220 },
      { label: 'الكمية', w: W - M * 2 - 50 - 340 - 130 - 220 },
    ];
    let cxr = W - M;
    const placed = cols.map((c) => { const p = { ...c, right: cxr }; cxr -= c.w; return p; });
    const rowH = 54;
    cx.fillStyle = C.head;
    cx.fillRect(M, y, W - M * 2, 48);
    placed.forEach((c) => put(c.label, c.right - 12, y + 32, 18, 900, '#ffffff'));
    y += 48;
    for (let k = 0; k < count; k++) {
      const it = items[cursor + k];
      if (k % 2 === 1) { cx.fillStyle = C.soft; cx.fillRect(M, y, W - M * 2, rowH); }
      cx.fillStyle = C.line;
      cx.fillRect(M, y + rowH - 1, W - M * 2, 1);
      const cells = [String(cursor + k + 1), it.type_name, it.size || '—', it.serial_number || '—', String(it.quantity)];
      cells.forEach((text, ci) => {
        let size = 20;
        cx.font = `700 ${size}px ${FONT}`;
        while (size > 13 && cx.measureText(text).width > placed[ci].w - 20) { size -= 1; cx.font = `700 ${size}px ${FONT}`; }
        put(text, placed[ci].right - 12, y + 35, size, ci === 1 ? 900 : 700, C.ink);
      });
      y += rowH;
    }
    cursor += count;

    if (isLast) {
      const total = items.reduce((n, it) => n + it.quantity, 0);
      put(`إجمالي القطع المسلَّمة: ${total}`, W - M, y + 36, 20, 900, C.head);
      y += 56;
      if (issue.notes) {
        cx.font = `700 18px ${FONT}`;
        const noteLines = wrapText(cx, `ملاحظات: ${issue.notes}`, W - M * 2).slice(0, 3);
        noteLines.forEach((l, i) => put(l, W - M, y + 24 + i * 28, 18, 700, C.ink2));
        y += noteLines.length * 28 + 16;
      }
      // pledge
      cx.fillStyle = '#fbf7ec';
      const pledgeLines = (() => { cx.font = `700 20px ${FONT}`; return wrapText(cx, PLEDGE, W - M * 2 - 56); })();
      const ph = 70 + pledgeLines.length * 36;
      roundRect(cx, M, y + 8, W - M * 2, ph, 16);
      cx.fill();
      cx.strokeStyle = C.gold;
      cx.lineWidth = 2;
      roundRect(cx, M, y + 8, W - M * 2, ph, 16);
      cx.stroke();
      put('تعهّد', W - M - 28, y + 50, 22, 900, '#9b783a');
      pledgeLines.forEach((l, i) => put(l, W - M - 28, y + 92 + i * 36, 20, 700, C.ink));
      y += ph + 40;

      // signatures
      const sigY = Math.max(y + 40, H - 330);
      const sigW = 380;
      [[W - M - sigW, 'توقيع العضو المستلِم', issue.member_name], [M, 'توقيع المسؤول عن التسليم', issue.issuer_name]].forEach(([x, label, name]) => {
        put(label, x + sigW / 2, sigY, 20, 900, C.ink, 'center');
        cx.fillStyle = C.ink3;
        cx.fillRect(x, sigY + 120, sigW, 2);
        put(name || '', x + sigW / 2, sigY + 156, 18, 700, C.ink2, 'center');
        put('الاسم والتوقيع', x + sigW / 2, sigY + 184, 15, 700, C.ink3, 'center');
      });
    }

    cx.fillStyle = C.line;
    cx.fillRect(M, H - 86, W - M * 2, 2);
    put(orgName, W - M, H - 50, 16, 700, C.ink3);
    put([settings.phone, formNo].filter(Boolean).join(' · '), M, H - 50, 16, 700, C.ink3, 'left');
  });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  canvases.forEach((cv, i) => {
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, ph);
  });
  return pdf;
}

export const voucherFilename = (issue) => `نموذج-استلام-عهدة-${String(issue.member_name || '').replace(/[\\/:*?"<>|]/g, '').trim()}-${issue.id}`;
