import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Droplet, Check, X, FileSpreadsheet } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, EmptyPanel, IconButton } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = { donor_name: '', donation_date: new Date().toISOString().slice(0, 10), blood_type: '', hospital: '', recipient_name: '', notes: '' };

// Blood donations the association coordinates between a donor and a
// recipient/hospital.
export default function BloodDonationsAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/blood-donations', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const now = new Date();
  const thisMonth = useMemo(() => data.filter((d) => {
    const dt = new Date(d.donation_date);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }), [data]);

  const topType = useMemo(() => {
    const counts = new Map();
    for (const d of data) if (d.blood_type) counts.set(d.blood_type, (counts.get(d.blood_type) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d) => [d.donor_name, d.hospital, d.recipient_name, d.blood_type, d.notes].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [data, search]);

  function exportRows() {
    const columns = [
      { label: 'التاريخ', value: (d) => String(d.donation_date).slice(0, 10) },
      { label: 'اسم المتبرّع', value: 'donor_name' },
      { label: 'فصيلة الدم', value: 'blood_type' },
      { label: 'المستشفى', value: 'hospital' },
      { label: 'اسم المستفيد', value: 'recipient_name' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`التبرع-بالدم-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/blood-donations/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/blood-donations', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    if (!(await confirm(`حذف تبرّع "${d.donor_name}" نهائياً؟`, { danger: true }))) return;
    await api(`/admin/blood-donations/${d.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الخدمات المجتمعية"
        title="التبرع بالدم"
        subtitle="سجّل كل عملية تبرّع بالدم ينسّقها الفريق بين متبرّع ومستفيد أو مستشفى."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportRows} disabled={rows.length === 0} title="تصدير التبرعات المعروضة في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> تبرّع جديد</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'عدد التبرعات', value: data.length, tone: 'brand' },
        { label: 'تبرعات هذا الشهر', value: thisMonth.length, tone: 'gold' },
        { label: 'الأكثر طلباً', value: topType?.[0] || '—', sub: topType ? `${topType[1]} تبرّع` : 'لا بيانات بعد', tone: 'warn' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Droplet} title={form.id ? 'تعديل تبرّع' : 'تبرّع جديد'} help="اسم المتبرّع والتاريخ مطلوبان، وباقي الحقول اختيارية.">
            <div className="field-row">
              <label className="field"><span>اسم المتبرّع</span>
                <input required maxLength={150} value={form.donor_name} onChange={(e) => set({ donor_name: e.target.value })} />
              </label>
              <label className="field"><span>التاريخ</span>
                <input required type="date" value={form.donation_date || ''} onChange={(e) => set({ donation_date: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>فصيلة الدم</span>
                <select value={form.blood_type || ''} onChange={(e) => set({ blood_type: e.target.value })}>
                  <option value="">— غير محدّدة —</option>
                  {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="field"><span>المستشفى</span>
                <input maxLength={150} value={form.hospital || ''} onChange={(e) => set({ hospital: e.target.value })} />
              </label>
            </div>
            <label className="field"><span>اسم المستفيد</span>
              <input maxLength={150} value={form.recipient_name || ''} onChange={(e) => set({ recipient_name: e.target.value })} />
            </label>
            <label className="field"><span>ملاحظات</span>
              <textarea rows={2} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ التبرّع'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو المستشفى أو فصيلة الدم" />

      {data.length === 0 && <EmptyPanel icon={Droplet} title="لا تبرعات مسجّلة بعد" text="أضف أول تبرّع من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>المتبرّع</th><th>الفصيلة</th><th>المستشفى</th><th>المستفيد</th><th>ملاحظات</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.donation_date)}</td>
                  <td><strong>{d.donor_name}</strong></td>
                  <td>{d.blood_type ? <span className="qty-chip">{d.blood_type}</span> : '—'}</td>
                  <td>{d.hospital || '—'}</td>
                  <td>{d.recipient_name || '—'}</td>
                  <td className="cell-wrap">{d.notes || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل التبرّع" onClick={() => { setFormError(''); setForm({ ...d, donation_date: d.donation_date ? String(d.donation_date).slice(0, 10) : '' }); }} />
                    <IconButton icon={Trash2} label="حذف التبرّع" tone="danger" onClick={() => remove(d)} />
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
