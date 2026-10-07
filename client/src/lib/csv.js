// CSV export helpers. The file starts with a UTF-8 byte-order mark so Excel
// shows the Arabic text correctly.

// Cells that start with = + - @ are read as formulas by spreadsheets, so they
// get a leading apostrophe to keep them as plain text.
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ label, value }] where value is a key or a function(row).
export function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv(filename, text) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
