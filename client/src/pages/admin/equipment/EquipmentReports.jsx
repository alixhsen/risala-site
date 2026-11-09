import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileDown, Printer, Play } from 'lucide-react';
import { useLoad, useSettings } from '../../../App.jsx';
import { useDialog } from '../../../components/admin/Dialog.jsx';
import { AdminHead } from '../../../components/admin/AdminPage.jsx';
import { EmptyPanel } from '../../../components/admin/DataPage.jsx';
import { MemberPicker } from '../../../components/admin/EquipmentParts.jsx';
import { api, formatDate } from '../../../lib/api.js';
import { MEMBER_STATUS, KIND_LABELS, CONDITION_LABELS, dayOf, memberNo } from '../../../lib/equipment.js';
import { downloadXlsx } from '../../../lib/xlsx.js';

const d = (v) => (v ? formatDate(v) : '');
const item = (r) => [r.type_name, r.size, r.serial_number && `رقم ${r.serial_number}`].filter(Boolean).join(' · ');
const daysOut = (r) => Math.max(0, Math.floor((Date.now() - new Date(`${dayOf(r.issued_on)}T00:00:00`).getTime()) / 86400000));

const txColumns = [
  { label: 'التاريخ', value: (r) => d(r.occurred_on), weight: 1.1 },
  { label: 'العملية', value: (r) => `${KIND_LABELS[r.kind]}${r.direction === 'in' && r.kind === 'replace' ? ' (استلام القديم)' : r.direction === 'out' && r.kind === 'replace' ? ' (تسليم الجديد)' : ''}`, weight: 1.3 },
  { label: 'العضو', value: (r) => r.member_name || '—', weight: 1.6 },
  { label: 'الغرض', value: (r) => r.type_name, weight: 1.5 },
  { label: 'المقاس / الرقم', value: (r) => [r.size, r.serial_number && `رقم ${r.serial_number}`].filter(Boolean).join(' · ') || '—', weight: 1.1 },
  { label: 'الكمية', value: 'quantity', weight: 0.7 },
  { label: 'الحالة', value: (r) => CONDITION_LABELS[r.condition] || '—', weight: 0.9 },
  { label: 'المسؤول', value: (r) => r.party_name || '—', weight: 1.2 },
  { label: 'الملاحظات', value: (r) => r.notes || '—', weight: 2 },
];

// Each report: which filters apply, its columns, and a summary line.
const REPORTS = {
  'member-custody': {
    title: 'تقرير العُهدة لكل مسعف',
    filters: ['member', 'type', 'custody', 'issued', 'returned'],
    needsMember: true,
    columns: [
      { label: 'الغرض', value: (r) => r.type_name, weight: 1.6 },
      { label: 'المقاس / الرقم', value: (r) => [r.size, r.serial_number && `رقم ${r.serial_number}`].filter(Boolean).join(' · ') || '—', weight: 1.2 },
      { label: 'سُلِّم', value: 'quantity', weight: 0.7 },
      { label: 'مسترجع', value: (r) => r.returned_qty + r.returned_damaged_qty, weight: 0.8 },
      { label: 'تالف', value: (r) => r.damaged_qty, weight: 0.7 },
      { label: 'مفقود', value: (r) => r.lost_qty, weight: 0.7 },
      { label: 'المتبقي', value: 'outstanding', weight: 0.8 },
      { label: 'الحالة', value: (r) => (r.outstanding > 0 ? 'مفتوحة' : 'مغلقة'), weight: 0.8 },
      { label: 'تاريخ التسليم', value: (r) => d(r.issued_on), weight: 1.1 },
      { label: 'آخر استرجاع', value: (r) => d(r.last_return_on) || '—', weight: 1.1 },
      { label: 'المسؤول عن التسليم', value: 'issuer_name', weight: 1.3 },
    ],
    summary: (rows) => [['البنود', rows.length], ['المتبقي بحوزته', rows.reduce((n, r) => n + r.outstanding, 0)]],
  },
  held: {
    title: 'تقرير الأغراض الموجودة بحوزة الأعضاء',
    filters: ['type', 'member', 'memberStatus', 'issued'],
    columns: [
      { label: 'الغرض', value: 'type_name', weight: 1.8 },
      { label: 'التصنيف', value: (r) => r.category || '—', weight: 1.2 },
      { label: 'المقاس', value: (r) => r.size || '—', weight: 0.8 },
      { label: 'الأرقام التسلسلية', value: (r) => r.serials || '—', weight: 1.6 },
      { label: 'الكمية بحوزة الأعضاء', value: 'held', weight: 1.2 },
      { label: 'عدد الأعضاء', value: 'members', weight: 1 },
    ],
    summary: (rows) => [['إجمالي القطع', rows.reduce((n, r) => n + r.held, 0)], ['الأصناف', rows.length]],
  },
  warehouse: {
    title: 'تقرير الأغراض الموجودة في المستودع',
    filters: ['type'],
    columns: [
      { label: 'الغرض', value: 'type_name', weight: 1.8 },
      { label: 'التصنيف', value: (r) => r.category || '—', weight: 1.2 },
      { label: 'المقاس', value: (r) => r.size || '—', weight: 0.8 },
      { label: 'الرقم التسلسلي', value: (r) => r.serial_number || '—', weight: 1.2 },
      { label: 'متوفر', value: 'in_stock', weight: 0.8 },
      { label: 'تالف / صيانة', value: 'damaged', weight: 1 },
      { label: 'بحوزة الأعضاء', value: 'with_members', weight: 1 },
      { label: 'الحد الأدنى', value: (r) => r.min_stock ?? '—', weight: 0.9 },
    ],
    summary: (rows) => [['متوفر', rows.reduce((n, r) => n + r.in_stock, 0)], ['تالف / صيانة', rows.reduce((n, r) => n + r.damaged, 0)]],
  },
  unreturned: {
    title: 'تقرير الأغراض غير المسترجعة',
    filters: ['member', 'type', 'memberStatus', 'issued', 'returned'],
    columns: [
      { label: 'العضو', value: 'member_name', weight: 1.7 },
      { label: 'رقم العضو', value: (r) => memberNo(r.member_id), weight: 0.9 },
      { label: 'حالة العضو', value: (r) => MEMBER_STATUS[r.member_status], weight: 1.2 },
      { label: 'الغرض', value: (r) => item(r), weight: 2 },
      { label: 'المتبقي', value: 'outstanding', weight: 0.8 },
      { label: 'تاريخ التسليم', value: (r) => d(r.issued_on), weight: 1.1 },
      { label: 'مدة الاحتفاظ (يوم)', value: daysOut, weight: 1.1 },
      { label: 'المسؤول عن التسليم', value: 'issuer_name', weight: 1.3 },
    ],
    summary: (rows) => [['البنود', rows.length], ['القطع', rows.reduce((n, r) => n + r.outstanding, 0)], ['الأعضاء', new Set(rows.map((r) => r.member_id)).size]],
  },
  'inactive-members': {
    title: 'تقرير الأعضاء المتوقفين أو المفصولين الذين لديهم عُهد',
    filters: ['member', 'type', 'memberStatusInactive', 'issued'],
    columns: [
      { label: 'العضو', value: 'member_name', weight: 1.7 },
      { label: 'رقم العضو', value: (r) => memberNo(r.member_id), weight: 0.9 },
      { label: 'حالة العضو', value: (r) => MEMBER_STATUS[r.member_status], weight: 1.3 },
      { label: 'الهاتف', value: (r) => r.member_phone || '—', weight: 1.2 },
      { label: 'الغرض', value: (r) => item(r), weight: 2 },
      { label: 'المتبقي', value: 'outstanding', weight: 0.8 },
      { label: 'تاريخ التسليم', value: (r) => d(r.issued_on), weight: 1.1 },
    ],
    summary: (rows) => [['الأعضاء', new Set(rows.map((r) => r.member_id)).size], ['القطع غير المستردة', rows.reduce((n, r) => n + r.outstanding, 0)]],
  },
  movements: {
    title: 'تقرير عمليات التسليم والاسترجاع',
    filters: ['member', 'type', 'period'],
    columns: txColumns,
    summary: (rows) => [['العمليات', rows.length], ['تسليم', rows.filter((r) => r.kind === 'issue' || (r.kind === 'replace' && r.direction === 'out')).length], ['استرجاع', rows.filter((r) => r.kind === 'return' || (r.kind === 'replace' && r.direction === 'in')).length]],
  },
  'damaged-lost': {
    title: 'تقرير الأغراض التالفة أو المفقودة',
    filters: ['member', 'type', 'period'],
    columns: txColumns,
    summary: (rows) => [['السجلات', rows.length], ['القطع', rows.reduce((n, r) => n + r.quantity, 0)]],
  },
};

export default function EquipmentReports() {
  const { settings } = useSettings();
  const { notify } = useDialog();
  const { data: members } = useLoad('/admin/equipment/members', []);
  const { data: types } = useLoad('/admin/equipment/types', []);
  const [kind, setKind] = useState('unreturned');
  const [f, setF] = useState({ member_id: null, type_id: '', custody_status: '', member_status: '', issued_from: '', issued_to: '', returned_from: '', returned_to: '', from: '', to: '' });
  const [result, setResult] = useState(null); // { kind, rows, filters }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileBusy, setFileBusy] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const rep = REPORTS[kind];
  const has = (name) => rep.filters.includes(name);

  useEffect(() => { setResult(null); setError(''); }, [kind]);

  const filterLines = useMemo(() => {
    if (!result) return [];
    const lines = [];
    const q = result.query;
    if (q.member_id) lines.push(`العضو: ${members.find((m) => m.id === Number(q.member_id))?.name || ''}`);
    if (q.type_id) lines.push(`الغرض: ${types.find((t) => t.id === Number(q.type_id))?.name || ''}`);
    if (q.custody_status) lines.push(`حالة العُهدة: ${q.custody_status === 'active' ? 'نشطة' : 'مغلقة'}`);
    if (q.member_status) lines.push(`حالة العضو: ${MEMBER_STATUS[q.member_status]}`);
    if (q.issued_from || q.issued_to) lines.push(`تاريخ التسليم: ${d(q.issued_from) || '…'} – ${d(q.issued_to) || '…'}`);
    if (q.returned_from || q.returned_to) lines.push(`تاريخ الاسترجاع: ${d(q.returned_from) || '…'} – ${d(q.returned_to) || '…'}`);
    if (q.from || q.to) lines.push(`الفترة: ${d(q.from) || '…'} – ${d(q.to) || '…'}`);
    return lines;
  }, [result, members, types]);

  async function run() {
    setError('');
    if (rep.needsMember && !f.member_id) return setError('اختر المسعف أولاً');
    const q = {};
    if (has('member') && f.member_id) q.member_id = f.member_id;
    if (has('type') && f.type_id) q.type_id = f.type_id;
    if (has('custody') && f.custody_status) q.custody_status = f.custody_status;
    if ((has('memberStatus') || has('memberStatusInactive')) && f.member_status) q.member_status = f.member_status;
    if (has('issued')) { if (f.issued_from) q.issued_from = f.issued_from; if (f.issued_to) q.issued_to = f.issued_to; }
    if (has('returned')) { if (f.returned_from) q.returned_from = f.returned_from; if (f.returned_to) q.returned_to = f.returned_to; }
    if (has('period')) { if (f.from) q.from = f.from; if (f.to) q.to = f.to; }
    setBusy(true);
    try {
      const res = await api(`/admin/equipment/reports/${kind}?${new URLSearchParams(q)}`);
      setResult({ kind, rows: res.rows, query: q });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const current = result && REPORTS[result.kind];
  const fileName = () => `${current.title}-${new Date().toISOString().slice(0, 10)}`;

  async function exportPdf(mode) {
    setFileBusy(mode);
    try {
      const [{ buildTablePdf, savePdf, printPdf }] = await Promise.all([import('../../../lib/tablePdf.js')]);
      const pdf = await buildTablePdf({ settings, title: current.title, filters: filterLines, columns: current.columns, rows: result.rows, summary: current.summary(result.rows) });
      if (mode === 'print') printPdf(pdf); else savePdf(pdf, fileName());
    } catch (err) { notify(err.message); } finally { setFileBusy(''); }
  }
  function exportXlsx() {
    downloadXlsx(fileName(), { sheetName: current.title, columns: current.columns.map((c) => ({ ...c, width: Math.round((c.weight || 1) * 16) })), rows: result.rows });
  }

  return (
    <>
      <AdminHead kicker="العُهد والتجهيزات" title="التقارير" subtitle="اختر التقرير وحدّد التصفية، ثم اطبعه أو صدّره إلى PDF أو Excel." />

      <div className="eq-tabs" role="tablist" aria-label="التقارير">
        {Object.entries(REPORTS).map(([k, r]) => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>{r.title}</button>
        ))}
      </div>

      <div className="eq-filters">
        {has('member') && <div className="field"><span>العضو{rep.needsMember && ' (مطلوب)'}</span><MemberPicker members={members} value={f.member_id} onChange={(id) => set({ member_id: id })} placeholder="كل الأعضاء — ابحث لتحديد عضو" /></div>}
        {has('type') && (
          <label className="field"><span>نوع الغرض</span>
            <select value={f.type_id} onChange={(e) => set({ type_id: e.target.value })}><option value="">الكل</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
        )}
        {has('custody') && (
          <label className="field"><span>حالة العُهدة</span>
            <select value={f.custody_status} onChange={(e) => set({ custody_status: e.target.value })}><option value="">الكل</option><option value="active">نشطة (لم تُغلق)</option><option value="closed">مغلقة</option></select>
          </label>
        )}
        {has('memberStatus') && (
          <label className="field"><span>حالة العضو</span>
            <select value={f.member_status} onChange={(e) => set({ member_status: e.target.value })}><option value="">الكل</option>{Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        )}
        {has('memberStatusInactive') && (
          <label className="field"><span>حالة العضو</span>
            <select value={f.member_status} onChange={(e) => set({ member_status: e.target.value })}><option value="">كل غير الفعّالين</option>{Object.entries(MEMBER_STATUS).filter(([k]) => k !== 'active').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        )}
        {has('issued') && <><label className="field"><span>تسليم من</span><input type="date" value={f.issued_from} onChange={(e) => set({ issued_from: e.target.value })} /></label><label className="field"><span>تسليم إلى</span><input type="date" value={f.issued_to} onChange={(e) => set({ issued_to: e.target.value })} /></label></>}
        {has('returned') && <><label className="field"><span>استرجاع من</span><input type="date" value={f.returned_from} onChange={(e) => set({ returned_from: e.target.value })} /></label><label className="field"><span>استرجاع إلى</span><input type="date" value={f.returned_to} onChange={(e) => set({ returned_to: e.target.value })} /></label></>}
        {has('period') && <><label className="field"><span>من تاريخ</span><input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label><label className="field"><span>إلى تاريخ</span><input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label></>}
        <div className="eq-filters-go"><button type="button" className="btn primary" onClick={run} disabled={busy}><Play size={15} aria-hidden="true" /> {busy ? 'جارٍ التحميل…' : 'عرض التقرير'}</button></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {!result && !error && <EmptyPanel title={rep.title} text="اضغط «عرض التقرير» لتحميل النتائج." />}
      {result && (
        <section className="eq-report">
          <header className="eq-report-head">
            <div>
              <h2>{current.title}</h2>
              {filterLines.length > 0 && <p className="hint">{filterLines.join(' · ')}</p>}
              <p className="eq-report-sum">{current.summary(result.rows).map(([l, v]) => <span key={l}>{l}: <strong>{v}</strong></span>)}</p>
            </div>
            <div className="eq-report-actions">
              <button type="button" className="btn" disabled={!!fileBusy} onClick={() => exportPdf('print')}><Printer size={15} aria-hidden="true" /> {fileBusy === 'print' ? 'جارٍ التجهيز…' : 'طباعة'}</button>
              <button type="button" className="btn" disabled={!!fileBusy} onClick={() => exportPdf('pdf')}><FileDown size={15} aria-hidden="true" /> {fileBusy === 'pdf' ? 'جارٍ التجهيز…' : 'PDF'}</button>
              <button type="button" className="btn" onClick={exportXlsx}><FileSpreadsheet size={15} aria-hidden="true" /> Excel</button>
            </div>
          </header>
          {result.rows.length === 0 ? <EmptyPanel title="لا بيانات" text="لا توجد سجلات مطابقة لهذه التصفية." /> : (
            <div className="table-wrap admin-table">
              <table>
                <thead><tr>{current.columns.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i}>{current.columns.map((c) => <td key={c.label}>{String(typeof c.value === 'function' ? c.value(r) : r[c.value] ?? '—')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
