import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Wrench, Check, X, FileSpreadsheet } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const ASSET_CONDITIONS = ['ممتاز', 'جيد', 'يحتاج صيانة', 'خارج الخدمة'];
const EMPTY = {
  name: '', manufacturer: '', category: '', unit: 'pcs', quantity: 1,
  location: '', asset_condition: '', serial_number: '', last_maintenance_date: '',
  source: '', image_url: '', notes: '', is_asset: true,
};

// Durable, reusable equipment (wheelchairs, monitors, trolleys...) - tracked
// by location/condition/serial/maintenance rather than expiry or reorder
// thresholds, so it gets its own page separate from consumable stock
// (`InventoryAdmin.jsx`).
export default function InventoryAssetsAdmin() {
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

  const data = useMemo(() => allItems.filter((it) => it.is_asset), [allItems]);
  const counts = useMemo(() => ({
    all: data.length,
    needsMaintenance: data.filter((i) => i.asset_condition === 'يحتاج صيانة').length,
    outOfService: data.filter((i) => i.asset_condition === 'خارج الخدمة').length,
  }), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((it) => {
      if (filter !== 'all' && it.asset_condition !== filter) return false;
      if (!q) return true;
      return [it.name, it.manufacturer, it.category, it.location, it.serial_number].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  function exportItems() {
    const columns = [
      { label: 'المعدة', value: 'name' },
      { label: 'الشركة المصنّعة', value: 'manufacturer' },
      { label: 'الفئة', value: 'category' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'الموقع', value: 'location' },
      { label: 'الحالة الفنية', value: 'asset_condition' },
      { label: 'الرقم التسلسلي', value: 'serial_number' },
      { label: 'تاريخ آخر صيانة', value: (it) => (it.last_maintenance_date ? String(it.last_maintenance_date).slice(0, 10) : '') },
      { label: 'المصدر', value: 'source' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`الأصول-الثابتة-${stamp}`, toCsv(columns, rows));
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
        title="الأصول الثابتة"
        subtitle="المعدات القابلة لإعادة الاستخدام كالكراسي المتحركة والأجهزة. سجّل الموقع والحالة الفنية والرقم التسلسلي."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportItems} disabled={rows.length === 0} title="تصدير المعدات المعروضة في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> معدة جديدة</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'عدد المعدات', value: counts.all, tone: 'brand' },
        { label: 'تحتاج صيانة', value: counts.needsMaintenance, sub: 'حالة فنية', tone: 'warn' },
        { label: 'خارج الخدمة', value: counts.outOfService, sub: 'حالة فنية', tone: 'danger' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Wrench} title={form.id ? 'تعديل معدة' : 'معدة جديدة'} help="هذه المعدات لا تُستهلك، بل تُتابَع بموقعها وحالتها الفنية.">
            <div className="field-row">
              <label className="field"><span>الاسم</span>
                <input required maxLength={150} placeholder="مثال: كرسي متحرك" value={form.name} onChange={(e) => set({ name: e.target.value })} />
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
              <label className="field"><span>الكمية</span>
                <input type="number" min="0" value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الموقع</span>
                <input maxLength={120} placeholder="مثال: مركز الإسعاف الرئيسي" value={form.location || ''} onChange={(e) => set({ location: e.target.value })} />
              </label>
              <label className="field"><span>الحالة الفنية</span>
                <select value={form.asset_condition || ''} onChange={(e) => set({ asset_condition: e.target.value })}>
                  <option value="">— اختر الحالة —</option>
                  {ASSET_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الرقم التسلسلي</span>
                <input maxLength={100} value={form.serial_number || ''} onChange={(e) => set({ serial_number: e.target.value })} />
              </label>
              <label className="field"><span>تاريخ آخر صيانة</span>
                <input type="date" value={form.last_maintenance_date || ''} onChange={(e) => set({ last_maintenance_date: e.target.value })} />
              </label>
            </div>
            <label className="field"><span>المصدر</span>
              <input maxLength={200} placeholder="جهة مانحة، شراء، مستشفى…" value={form.source || ''} onChange={(e) => set({ source: e.target.value })} />
            </label>
            <ImageInput label="صورة المعدة" value={form.image_url || ''} onChange={(url) => set({ image_url: url })} />
            <label className="field"><span>ملاحظات</span>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ المعدة'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الفئة أو الموقع أو الرقم التسلسلي">
        <ChipFilter
          label="الحالة الفنية"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'الكل', counts.all],
            ['يحتاج صيانة', 'تحتاج صيانة', counts.needsMaintenance],
            ['خارج الخدمة', 'خارج الخدمة', counts.outOfService],
          ]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Wrench} title="لا أصول ثابتة بعد" text="أضف أول معدة من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الحالة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>الصورة</th><th>المعدة</th><th>الفئة</th><th>الكمية</th><th>الموقع</th><th>الحالة الفنية</th><th>الرقم التسلسلي</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td><Thumb src={it.image_url} alt={it.name} /></td>
                  <td><strong>{it.name}</strong>{it.manufacturer && <small>{it.manufacturer}</small>}</td>
                  <td>{it.category || '—'}</td>
                  <td><span className="qty">{it.quantity}</span></td>
                  <td>{it.location || '—'}</td>
                  <td>
                    {it.asset_condition
                      ? <span className={`status ${it.asset_condition === 'خارج الخدمة' ? 'danger' : it.asset_condition === 'يحتاج صيانة' ? 'expiring' : 'ok'}`}>{it.asset_condition}</span>
                      : '—'}
                    {it.last_maintenance_date && <small className="cell-date">آخر صيانة: {formatDate(it.last_maintenance_date)}</small>}
                  </td>
                  <td>{it.serial_number || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل المعدة" onClick={() => { setFormError(''); setForm({
                      ...it,
                      last_maintenance_date: it.last_maintenance_date ? String(it.last_maintenance_date).slice(0, 10) : '',
                    }); }} />
                    <IconButton icon={Trash2} label="حذف المعدة" tone="danger" onClick={() => remove(it)} />
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
