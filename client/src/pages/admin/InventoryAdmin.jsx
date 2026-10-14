import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Package, Check, X, AlertTriangle, FileSpreadsheet, PackageX } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const EMPTY = {
  name: '', manufacturer: '', category: '', unit: '', quantity: 0, min_quantity: '',
  expiry_date: '', source: '', image_url: '', notes: '', is_asset: false,
};
const EXPIRY_LABEL = { none: 'لا ينتهي', expired: 'منتهي الصلاحية', expiring: 'قريب الانتهاء', ok: 'صالح' };

function expiryStatus(dateStr) {
  if (!dateStr) return { label: EXPIRY_LABEL.none, cls: 'none', key: 'none' };
  const days = (new Date(dateStr) - new Date(new Date().toDateString())) / 86400000;
  if (days < 0) return { label: EXPIRY_LABEL.expired, cls: 'expired', key: 'expired' };
  if (days <= 30) return { label: EXPIRY_LABEL.expiring, cls: 'expiring', key: 'expiring' };
  return { label: EXPIRY_LABEL.ok, cls: 'ok', key: 'ok' };
}

// Consumable medical stock only - durable equipment (أصل ثابت) lives on its
// own page (`InventoryAssetsAdmin.jsx`) since it's tracked differently
// (location/condition/serial, not expiry or reorder thresholds).
export default function InventoryAdmin() {
  const { confirm, notify } = useDialog();
  const { data: allItems, error, reload } = useLoad('/admin/inventory-items', []);
  const units = useLoad('/admin/inventory-units', []);
  const categories = useLoad('/admin/inventory-categories', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const data = useMemo(() => allItems.filter((it) => !it.is_asset), [allItems]);
  const isLowStock = (it) => it.min_quantity != null && Number(it.quantity) <= Number(it.min_quantity);

  const enriched = useMemo(() => data.map((it) => ({ ...it, ex: expiryStatus(it.expiry_date), low: isLowStock(it) })), [data]);
  const counts = useMemo(() => ({
    all: enriched.length,
    expired: enriched.filter((i) => i.ex.key === 'expired').length,
    expiring: enriched.filter((i) => i.ex.key === 'expiring').length,
    ok: enriched.filter((i) => i.ex.key === 'ok' || i.ex.key === 'none').length,
    low: enriched.filter((i) => i.low).length,
    quantity: enriched.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
  }), [enriched]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((it) => {
      if (filter === 'expired' && it.ex.key !== 'expired') return false;
      if (filter === 'expiring' && it.ex.key !== 'expiring') return false;
      if (filter === 'ok' && !(it.ex.key === 'ok' || it.ex.key === 'none')) return false;
      if (filter === 'low' && !it.low) return false;
      if (!q) return true;
      return [it.name, it.manufacturer, it.category, it.unit, it.source].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [enriched, filter, search]);

  // Exports the items currently listed (so a filter applies to the file too).
  function exportItems() {
    const columns = [
      { label: 'المادة', value: 'name' },
      { label: 'الشركة المصنّعة', value: 'manufacturer' },
      { label: 'الفئة', value: 'category' },
      { label: 'الوحدة', value: 'unit' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'حد إعادة الطلب', value: 'min_quantity' },
      { label: 'حالة الصلاحية', value: (it) => it.ex.label },
      { label: 'تاريخ انتهاء الصلاحية', value: (it) => (it.expiry_date ? String(it.expiry_date).slice(0, 10) : '') },
      { label: 'المصدر', value: 'source' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`المخزون-الطبي-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/inventory-items/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/inventory-items', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!(await confirm(`حذف "${item.name}" نهائياً؟`, { danger: true }))) return;
    await api(`/admin/inventory-items/${item.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="المخزون"
        title="المخزون الطبي"
        subtitle="المواد المستهلكة كالشاش والمحاليل والشريط الطبي. سجّل الكمية والمصدر وتاريخ الانتهاء."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportItems} disabled={rows.length === 0} title="تصدير المواد المعروضة في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> مادة جديدة</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'عدد المواد', value: counts.all, tone: 'brand' },
        { label: 'إجمالي الكميات', value: counts.quantity, sub: 'بمختلف الوحدات', tone: 'gold' },
        { label: 'قريبة الانتهاء', value: counts.expiring, sub: 'خلال 30 يوماً', tone: 'warn' },
        { label: 'منتهية الصلاحية', value: counts.expired, sub: 'تحتاج إزالة', tone: 'danger' },
        { label: 'منخفض المخزون', value: counts.low, sub: 'عند حد إعادة الطلب أو أقل', tone: 'danger' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Package} title={form.id ? 'تعديل مادة' : 'مادة جديدة'} help="الكمية تُعدَّل هنا، وتتغيّر تلقائياً عند تسجيل الاستخدام.">
            <div className="field-row">
              <label className="field"><span>الاسم</span>
                <input required maxLength={150} placeholder="مثال: شاش معقّم" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>الشركة المصنّعة</span>
                <input maxLength={150} placeholder="مثال: Elsada" value={form.manufacturer || ''} onChange={(e) => set({ manufacturer: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الفئة</span>
                <select value={form.category || ''} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">— اختر الفئة —</option>
                  {categories.data
                    .filter((c) => c.active || c.name === form.category)
                    .map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <small className="field-help">فئة جديدة؟ أضفها من <a href="/admin/inventory-categories" target="_blank" rel="noreferrer">فئات المخزون</a>.</small>
              </label>
              <label className="field"><span>الوحدة</span>
                <select value={form.unit || ''} onChange={(e) => set({ unit: e.target.value })}>
                  <option value="">— اختر الوحدة —</option>
                  {units.data
                    .filter((u) => u.active || u.name === form.unit)
                    .map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <small className="field-help">وحدة جديدة؟ أضفها من <a href="/admin/inventory-units" target="_blank" rel="noreferrer">وحدات القياس</a>.</small>
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الكمية</span>
                <input type="number" min="0" value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
              </label>
              <label className="field"><span>حد إعادة الطلب</span>
                <input type="number" min="0" placeholder="اتركه فارغاً إن لم يُحدَّد" value={form.min_quantity ?? ''} onChange={(e) => set({ min_quantity: e.target.value === '' ? '' : Number(e.target.value) })} />
                <small className="field-help">تنبيه "منخفض المخزون" يظهر عندما تصل الكمية لهذا الحد أو أقل.</small>
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>تاريخ انتهاء الصلاحية</span>
                <input type="date" value={form.expiry_date || ''} onChange={(e) => set({ expiry_date: e.target.value })} />
                <small className="field-help">اتركه فارغاً إن كانت المادة لا تنتهي.</small>
              </label>
              <label className="field"><span>المصدر</span>
                <input maxLength={200} placeholder="جهة مانحة، شراء، مستشفى…" value={form.source || ''} onChange={(e) => set({ source: e.target.value })} />
              </label>
            </div>
            <ImageInput label="صورة المادة" value={form.image_url || ''} onChange={(url) => set({ image_url: url })} />
            <label className="field"><span>ملاحظات</span>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ المادة'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الفئة أو الوحدة أو المصدر">
        <ChipFilter
          label="حالة الصلاحية"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'الكل', counts.all],
            ['expiring', 'قريبة الانتهاء', counts.expiring],
            ['expired', 'منتهية', counts.expired],
            ['ok', 'صالحة', counts.ok],
            ['low', 'منخفض المخزون', counts.low],
          ]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Package} title="المخزون فارغ" text="أضف أول مادة من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الصلاحية." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>الصورة</th><th>المادة</th><th>الفئة</th><th>الشركة المصنّعة</th><th>الكمية</th><th>الصلاحية</th><th>المصدر</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id} className={`row-${it.ex.key}`}>
                  <td><Thumb src={it.image_url} alt={it.name} /></td>
                  <td><strong>{it.name}</strong>{it.unit && <small>{it.unit}</small>}</td>
                  <td>{it.category || '—'}</td>
                  <td>{it.manufacturer || '—'}</td>
                  <td>
                    <span className={`qty ${Number(it.quantity) <= 0 ? 'is-zero' : ''}`}>{it.quantity}</span>
                    {it.low && (
                      <span className="status danger" title={`حد إعادة الطلب: ${it.min_quantity}`}>
                        <PackageX size={12} aria-hidden="true" /> منخفض
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status ${it.ex.cls}`}>
                      {it.ex.key === 'expired' && <AlertTriangle size={12} aria-hidden="true" />}
                      {it.ex.label}
                    </span>
                    {it.expiry_date && <small className="cell-date">{formatDate(it.expiry_date)}</small>}
                  </td>
                  <td>{it.source || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل المادة" onClick={() => { setFormError(''); setForm({
                      ...it,
                      expiry_date: it.expiry_date ? String(it.expiry_date).slice(0, 10) : '',
                      min_quantity: it.min_quantity ?? '',
                    }); }} />
                    <IconButton icon={Trash2} label="حذف المادة" tone="danger" onClick={() => remove(it)} />
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
