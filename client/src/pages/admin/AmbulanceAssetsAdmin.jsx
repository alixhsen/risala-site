import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Siren, Check, X, FileSpreadsheet } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const ASSET_CONDITIONS = ['ممتاز', 'جيد', 'يحتاج صيانة', 'خارج الخدمة'];
const EMPTY = {
  name: '', manufacturer: '', category: '', quantity: 1, ambulance_number: '160',
  asset_condition: '', serial_number: '', last_maintenance_date: '', source: '', image_url: '', notes: '',
};

// Durable equipment carried on the ambulance itself (spinal board, scoop
// stretcher, field stretcher...) - separate from the warehouse assets page
// since it's vehicle gear, not general medical stock.
export default function AmbulanceAssetsAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/ambulance-assets', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

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
      return [it.name, it.manufacturer, it.category, it.ambulance_number, it.serial_number].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  function exportItems() {
    const columns = [
      { label: 'المعدة', value: 'name' },
      { label: 'الشركة المصنّعة', value: 'manufacturer' },
      { label: 'الفئة', value: 'category' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'رقم السيارة', value: 'ambulance_number' },
      { label: 'الحالة الفنية', value: 'asset_condition' },
      { label: 'الرقم التسلسلي', value: 'serial_number' },
      { label: 'تاريخ آخر صيانة', value: (it) => (it.last_maintenance_date ? String(it.last_maintenance_date).slice(0, 10) : '') },
      { label: 'المصدر', value: 'source' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`معدات-سيارة-الإسعاف-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/ambulance-assets/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/ambulance-assets', { method: 'POST', body: form });
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
    await api(`/admin/ambulance-assets/${item.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="سيارة الإسعاف"
        title="معدات السيارة"
        subtitle="المعدات الثابتة على متن السيارة كلوح التثبيت والنقّالات. سجّل الحالة الفنية والرقم التسلسلي."
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
          <FormSection icon={Siren} title={form.id ? 'تعديل معدة' : 'معدة جديدة'} help="هذه المعدات ثابتة على متن السيارة، تُتابَع بحالتها الفنية وصيانتها.">
            <div className="field-row">
              <label className="field"><span>الاسم</span>
                <input required maxLength={150} placeholder="مثال: لوح تثبيت (Spinal Board)" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>الشركة المصنّعة</span>
                <input maxLength={150} value={form.manufacturer || ''} onChange={(e) => set({ manufacturer: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الفئة</span>
                <input maxLength={60} placeholder="مثال: نقل وتثبيت المصابين" value={form.category || ''} onChange={(e) => set({ category: e.target.value })} />
              </label>
              <label className="field"><span>الكمية</span>
                <input type="number" min="0" value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>رقم السيارة</span>
                <input maxLength={20} value={form.ambulance_number || ''} onChange={(e) => set({ ambulance_number: e.target.value })} />
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

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الفئة أو رقم السيارة">
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

      {data.length === 0 && <EmptyPanel icon={Siren} title="لا معدات مسجّلة بعد" text="أضف أول معدة من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الحالة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>الصورة</th><th>المعدة</th><th>الفئة</th><th>الكمية</th><th>رقم السيارة</th><th>الحالة الفنية</th><th>الرقم التسلسلي</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td><Thumb src={it.image_url} alt={it.name} /></td>
                  <td><strong>{it.name}</strong>{it.manufacturer && <small>{it.manufacturer}</small>}</td>
                  <td>{it.category || '—'}</td>
                  <td><span className="qty">{it.quantity}</span></td>
                  <td>{it.ambulance_number}</td>
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
