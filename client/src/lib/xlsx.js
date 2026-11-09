// Minimal .xlsx writer (no dependency): one right-to-left sheet with a bold
// header row, stored in an uncompressed ZIP. Opens in Excel/LibreOffice/Sheets.
const enc = new TextEncoder();

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const [name, text] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...chunks, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function colName(i) {
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// columns: [{ label, value }] where value is a key or function(row).
export function buildXlsx({ sheetName = 'تقرير', columns, rows }) {
  const cell = (v, ref, style) => {
    if (v === null || v === undefined || v === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const header = columns.map((c, i) => cell(c.label, `${colName(i)}1`, 1)).join('');
  const body = rows.map((row, r) => {
    const cells = columns.map((c, i) => cell(typeof c.value === 'function' ? c.value(row) : row[c.value], `${colName(i)}${r + 2}`)).join('');
    return `<row r="${r + 2}">${cells}</row>`;
  }).join('');
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData><row r="1">${header}</row>${body}</sheetData></worksheet>`;
  const safeName = esc(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'تقرير');
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF4EC"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

export function downloadXlsx(filename, options) {
  const blob = buildXlsx(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
