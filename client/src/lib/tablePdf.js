// Generic report-table PDF (A4 landscape). Like the other report PDFs it is
// drawn on a canvas, so Arabic shaping and right-to-left order come from the
// browser; the pages are then placed into a jsPDF document.
import { formatDate } from './api.js';
import { loadBrandLogo, drawBrandLogo } from './pdfLogo.js';

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';
const W = 1754;
const H = 1240;
const M = 60;
const HEAD = 150;
const FOOT = 60;
const C = { green: '#0b2415', gold: '#c5a059', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', line: '#e2e8f0', soft: '#f1f5f2', head: '#1a5130', warn: '#8a5b00', warnBg: '#fbf1d9', bad: '#c0272d', badBg: '#fdf0f0' };

// columns: [{ label, value, weight }]; value is a key or function(row).
// summary: [[label, value], …] shown under the title. filters: text lines.
export async function buildTablePdf({ settings, title, filters = [], columns, rows, summary = [] }) {
  const logo = await loadBrandLogo(settings);
  if (document.fonts) await Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Cairo"`, 'أ'))).catch(() => {});
  const orgName = settings.line1 || settings.site_name || 'جمعية الرسالة للإسعاف الصحي';
  const generated = formatDate(new Date().toISOString());

  const totalWeight = columns.reduce((n, c) => n + (c.weight || 1), 0);
  const usable = W - M * 2;
  // First column sits at the right edge (RTL).
  let x = W - M;
  const cols = columns.map((c) => {
    const w = (usable * (c.weight || 1)) / totalWeight;
    const col = { ...c, right: x, w };
    x -= w;
    return col;
  });

  const pages = [];
  let cv;
  let cx;
  let y;
  const font = (size, weight = 700) => { cx.font = `${weight} ${size}px ${FONT}`; };
  const put = (str, px, py, size, weight, color, align = 'right') => {
    font(size, weight);
    cx.fillStyle = color;
    cx.textAlign = align;
    cx.textBaseline = 'alphabetic';
    cx.fillText(str, px, py);
  };
  const lines = (text, maxW, maxLines) => {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const out = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (cx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
    if (out.length > maxLines) {
      out.length = maxLines;
      let last = out[maxLines - 1];
      while (last.length > 1 && cx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      out[maxLines - 1] = `${last}…`;
    }
    return out.length ? out : [''];
  };

  const drawHeaderRow = () => {
    cx.fillStyle = C.head;
    cx.fillRect(M, y, usable, 46);
    cols.forEach((c) => put(c.label, c.right - 12, y + 31, 19, 900, '#ffffff'));
    y += 46;
  };

  const newPage = () => {
    cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    cx = cv.getContext('2d');
    cx.direction = 'rtl';
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, W, H);
    pages.push(cv);
    cx.fillStyle = C.green;
    cx.fillRect(0, 0, W, 104);
    cx.fillStyle = C.gold;
    cx.fillRect(0, 104, W, 5);
    if (logo) drawBrandLogo(cx, logo, W, M);
    const textRight = W - M - (logo ? 112 : 0);
    put(orgName, textRight, 48, 32, 900, '#ffffff');
    put(title, textRight, 86, 22, 700, '#cfe0d4');
    put(`تاريخ الإصدار ${generated}`, M, 86, 20, 700, C.gold, 'left');
    y = 140;
  };

  newPage();
  if (filters.length) {
    put(filters.join('  ·  '), W - M, y + 20, 18, 700, C.ink2);
    y += 38;
  }
  if (summary.length) {
    let sx = W - M;
    for (const [label, value] of summary) {
      font(19, 900);
      const text = `${label}: ${value}`;
      const w = cx.measureText(text).width + 36;
      cx.fillStyle = C.soft;
      cx.beginPath();
      cx.roundRect(sx - w, y, w, 40, 10);
      cx.fill();
      put(text, sx - 18, y + 27, 19, 900, C.head);
      sx -= w + 12;
    }
    y += 58;
  }
  y += 6;
  drawHeaderRow();

  rows.forEach((row, ri) => {
    font(18, 700);
    const cells = cols.map((c) => {
      const raw = typeof c.value === 'function' ? c.value(row) : row[c.value];
      return lines(raw === null || raw === undefined || raw === '' ? '—' : raw, c.w - 24, 2);
    });
    const rowH = Math.max(...cells.map((l) => l.length)) * 25 + 18;
    if (y + rowH > H - FOOT - 10) {
      newPage();
      drawHeaderRow();
    }
    if (ri % 2 === 1) { cx.fillStyle = C.soft; cx.fillRect(M, y, usable, rowH); }
    cx.fillStyle = C.line;
    cx.fillRect(M, y + rowH - 1, usable, 1);
    cells.forEach((ls, ci) => ls.forEach((l, li) => put(l, cols[ci].right - 12, y + 30 + li * 25, 18, 700, C.ink)));
    y += rowH;
  });

  if (rows.length === 0) put('لا توجد بيانات مطابقة لهذه التصفية', W / 2, y + 60, 22, 700, C.ink3, 'center');

  pages.forEach((p, i) => {
    const g = p.getContext('2d');
    g.direction = 'rtl';
    g.fillStyle = C.line;
    g.fillRect(M, H - FOOT, usable, 2);
    g.font = `700 16px ${FONT}`;
    g.fillStyle = C.ink3;
    g.textAlign = 'right';
    g.fillText(`${orgName} — ${title}`, W - M, H - 24);
    g.textAlign = 'left';
    g.fillText(`صفحة ${i + 1} من ${pages.length}`, M, H - 24);
  });

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage('a4', 'landscape');
    pdf.addImage(p.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
  });
  return pdf;
}

export function savePdf(pdf, filename) {
  pdf.save(`${filename}.pdf`);
}

// Opens the browser's print dialog for the PDF without leaving the page.
export function printPdf(pdf) {
  const url = URL.createObjectURL(pdf.output('blob'));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  };
  document.body.appendChild(frame);
}
