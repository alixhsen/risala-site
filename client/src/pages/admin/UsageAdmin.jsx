import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Trash2, ClipboardList, Check, Boxes, CalendarDays, Activity, FileSpreadsheet } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, IconButton, EmptyPanel } from '../../components/admin/DataPage.jsx';
import { api, formatDate, MONTHS_AR } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { item_id: '', quantity: 1, purpose: '', used_at: today() };

export default function UsageAdmin() {
  const { confirm, notify } = useDialog();
  const { isAdmin } = useAdmin();
  const items = useLoad('/admin/inventory-items', []);
  const { data, error, reload } = useLoad('/admin/inventory-usage', []);
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, error: '' });
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const selected = items.data.find((it) => it.id === Number(form.item_id));

  const now = new Date();
  const thisMonth = data.filter((r) => {
    const d = new Date(r.used_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthQty = thisMonth.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const distinctItems = new Set(data.map((r) => r.item_id)).size;
  const latest = data.length ? formatDate(data[0].used_at) : '—';

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (itemFilter && String(r.item_id) !== itemFilter) return false;
      if (!q) return true;
      return [r.item_name, r.purpose, r.used_by_name].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, itemFilter]);

  // Exports the usage rows currently listed (so a filter applies to the file too).
  function exportUsage() {
    const columns = [
      { label: 'التاريخ', value: (r) => String(r.used_at).slice(0, 10) },
      { label: 'المادة', value: 'item_name' },
      { label: 'الكمية', value: (r) => `${r.quantity}${r.unit ? ` ${r.unit}` : ''}` },
      { label: 'استُخدمت من أجل', value: 'purpose' },
      { label: 'المسجِّل', value: 'used_by_name' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`سجل-استخدام-المخزون-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api('/admin/inventory-usage', { method: 'POST', body: form });
      setForm(EMPTY);
      reload();
      items.reload();
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  async function remove(row) {
    if (!(await confirm(`حذف سجل استخدام "${row.item_name}"؟ سيتم إعادة الكمية إلى المخزون.`, { danger: true }))) return;
    await api(`/admin/inventory-usage/${row.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
    items.reload();
  }

  return (
    <>
      <AdminHead
        kicker="المخزون"
        title="سجلّ الاستخدام"
        subtitle="كل مرة تُستخدم فيها مادة من المخزون، سجّلها هنا. الكمية تُخصم تلقائياً من المخزون."
        actions={(
          <button type="button" className="btn" onClick={exportUsage} disabled={rows.length === 0} title="تصدير سجلّ الاستخدام المعروض في القائمة">
            <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
          </button>
        )}
      />

      <StatTiles items={[
        { label: `استخدامات ${MONTHS_AR[now.getMonth()]}`, value: thisMonth.length, tone: 'brand' },
        { label: 'الكمية المستهلكة هذا الشهر', value: monthQty, tone: 'gold' },
        { label: 'مواد استُخدمت', value: distinctItems, sub: 'مختلفة منذ البداية', tone: 'brand' },
        { label: 'آخر استخدام', value: latest, tone: 'warn' },
      ]} />

      <form className="drawer-form" onSubmit={save}>
        <FormSection icon={ClipboardList} title="تسجيل استخدام" help="اختر المادة والكمية، واكتب سبب الاستخدام بإيجاز.">
          <div className="field-row">
            <label className="field"><span>المادة</span>
              <select required value={form.item_id} onChange={(e) => set({ item_id: e.target.value })}>
                <option value="">— اختر المادة —</option>
                {items.data.map((it) => (
                  <option key={it.id} value={it.id}>{it.name} (متوفر: {it.quantity}{it.unit ? ` ${it.unit}` : ''})</option>
                ))}
              </select>
              {selected && <small className="field-help">المتوفر حالياً: {selected.quantity}{selected.unit ? ` ${selected.unit}` : ''}</small>}
            </label>
            <label className="field"><span>الكمية المستخدَمة</span>
              <input type="number" min="1" max={selected?.quantity || undefined} required value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
            </label>
            <label className="field"><span>التاريخ</span>
              <input type="date" value={form.used_at} onChange={(e) => set({ used_at: e.target.value })} />
            </label>
          </div>
          <label className="field field-wide"><span>استُخدمت من أجل</span>
            <textarea required rows={2} placeholder="مثال: مهمة إسعاف في بئر حسن، تجهيز سيارة الإسعاف…" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </label>
          {state.error && <p className="error" role="alert">{state.error}</p>}
        </FormSection>
        <SaveBar>
          <button type="button" className="btn" onClick={() => setForm(EMPTY)} disabled={state.busy}>مسح الحقول</button>
          <button className="btn primary" disabled={state.busy}><Check size={15} aria-hidden="true" /> {state.busy ? 'جارٍ الحفظ…' : 'تسجيل الاستخدام'}</button>
        </SaveBar>
      </form>

      {error && <p className="error">{error}</p>}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالمادة أو السبب أو اسم المسجِّل">
        <label className="field filter-select">
          <span>المادة</span>
          <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
            <option value="">كل المواد</option>
            {items.data.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Activity} title="لا سجلّات استخدام بعد" text="سجّل أول استخدام من النموذج أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب تغيير البحث أو المادة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>المادة</th><th>الكمية</th><th>السبب</th><th>المسجِّل</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="cell-date-strong"><CalendarDays size={13} aria-hidden="true" /> {formatDate(row.used_at)}</span></td>
                  <td><strong>{row.item_name}</strong></td>
                  <td><span className="qty-chip"><Boxes size={13} aria-hidden="true" /> {row.quantity}{row.unit ? ` ${row.unit}` : ''}</span></td>
                  <td className="cell-wrap">{row.purpose}</td>
                  <td>{row.used_by_name || '—'}</td>
                  <td className="row-actions-icons">
                    {isAdmin && <IconButton icon={Trash2} label="حذف السجل وإعادة الكمية" tone="danger" onClick={() => remove(row)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
