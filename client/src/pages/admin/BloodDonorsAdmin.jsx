import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Droplet, Check, X, FileSpreadsheet, HeartHandshake, Power } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, EmptyPanel, IconButton } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = { name: '', phone: '', blood_type: '', birth_date: '', area: '', notes: '' };
const TODAY = new Date().toISOString().slice(0, 10);

// Public self-registered blood donors. Staff search this list by blood type
// when a need comes in, then mark whoever actually gave blood so they drop
// out of the "available" list for six months.
export default function BloodDonorsAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/blood-donors', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const available = useMemo(() => data.filter((d) => d.available), [data]);
  const discarded = useMemo(() => data.filter((d) => d.discarded), [data]);
  const topType = useMemo(() => {
    const counts = new Map();
    for (const d of available) counts.set(d.blood_type, (counts.get(d.blood_type) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [available]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((d) => {
      if (typeFilter && d.blood_type !== typeFilter) return false;
      if (availFilter === 'available' && !d.available) return false;
      if (availFilter === 'cooldown' && (d.available || d.discarded)) return false;
      if (availFilter === 'discarded' && !d.discarded) return false;
      if (!q) return true;
      return [d.name, d.phone, d.area, d.blood_type, d.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, typeFilter, availFilter]);

  function exportRows() {
    const columns = [
      { label: 'الاسم', value: 'name' },
      { label: 'الهاتف', value: 'phone' },
      { label: 'فصيلة الدم', value: 'blood_type' },
      { label: 'المنطقة', value: 'area' },
      { label: 'تاريخ الميلاد', value: (d) => d.birth_date ? String(d.birth_date).slice(0, 10) : '' },
      { label: 'آخر تبرّع', value: (d) => d.last_donation_date ? String(d.last_donation_date).slice(0, 10) : '' },
      { label: 'الحالة', value: (d) => (d.discarded ? 'دون السن القانونية' : d.active ? (d.available ? 'متاح' : 'ضمن فترة الانتظار') : 'معطّل') },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`متبرعو-الدم-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/blood-donors/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/blood-donors', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markDonated(d) {
    if (!(await confirm(`تسجيل تبرّع "${d.name}" اليوم؟ لن يظهر في قائمة المتاحين لمدة 6 أشهر.`))) return;
    await api(`/admin/blood-donors/${d.id}/mark-donated`, { method: 'POST', body: {} }).catch((err) => notify(err.message));
    reload();
  }

  async function toggleActive(d) {
    await api(`/admin/blood-donors/${d.id}/active`, { method: 'PUT', body: { active: !d.active } }).catch((err) => notify(err.message));
    reload();
  }

  async function remove(d) {
    if (!(await confirm(`حذف المتبرّع "${d.name}" نهائياً؟`, { danger: true }))) return;
    await api(`/admin/blood-donors/${d.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الخدمات المجتمعية"
        title="سجلّ متبرعي الدم"
        subtitle="القائمة العامة للمتبرعين الذين سجّلوا بياناتهم من الموقع. عند الحاجة لفصيلة معيّنة، صفِّ القائمة وتواصل مع المتاحين منهم."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportRows} disabled={rows.length === 0} title="تصدير القائمة المعروضة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> متبرّع جديد</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'إجمالي المسجّلين', value: data.length, tone: 'brand' },
        { label: 'متاحون الآن', value: available.length, tone: 'gold' },
        { label: 'الأكثر توفّراً', value: topType?.[0] || '—', sub: topType ? `${topType[1]} متبرّع` : 'لا بيانات بعد', tone: 'warn' },
        { label: 'دون السن القانونية', value: discarded.length, sub: 'تلقائياً عند التسجيل', tone: 'danger' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Droplet} title={form.id ? 'تعديل متبرّع' : 'متبرّع جديد'} help="الاسم والهاتف وفصيلة الدم مطلوبة.">
            <div className="field-row">
              <label className="field"><span>الاسم</span>
                <input required maxLength={150} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>الهاتف</span>
                <input required dir="ltr" maxLength={40} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>فصيلة الدم</span>
                <select required value={form.blood_type || ''} onChange={(e) => set({ blood_type: e.target.value })}>
                  <option value="">— اختر —</option>
                  {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="field"><span>تاريخ الميلاد</span>
                <input type="date" max={TODAY} value={form.birth_date || ''} onChange={(e) => set({ birth_date: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>المنطقة</span>
                <input maxLength={100} value={form.area || ''} onChange={(e) => set({ area: e.target.value })} />
              </label>
            </div>
            <label className="field"><span>ملاحظات</span>
              <textarea rows={2} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الهاتف أو المنطقة">
        <ChipFilter label="فصيلة الدم" value={typeFilter} onChange={setTypeFilter} options={[['', 'كل الفصائل'], ...BLOOD_TYPES.map((t) => [t, t])]} />
        <ChipFilter label="الحالة" value={availFilter} onChange={setAvailFilter} options={[['', 'الكل'], ['available', 'متاح'], ['cooldown', 'ضمن الانتظار'], ['discarded', 'دون السن القانونية']]} />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Droplet} title="لا متبرعون مسجّلون بعد" text="ينضم المتبرعون تلقائياً عبر صفحة التبرع بالدم في الموقع، أو أضف واحداً يدوياً." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب تصفية أخرى." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>الفصيلة</th><th>المنطقة</th><th>تاريخ الميلاد</th><th>آخر تبرّع</th><th>الحالة</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={!d.active || d.discarded ? 'row-muted' : ''}>
                  <td><strong>{d.name}</strong></td>
                  <td dir="ltr">{d.phone}</td>
                  <td><span className="qty-chip">{d.blood_type}</span></td>
                  <td>{d.area || '—'}</td>
                  <td>{d.birth_date ? formatDate(d.birth_date) : '—'}</td>
                  <td>{d.last_donation_date ? formatDate(d.last_donation_date) : '—'}</td>
                  <td>
                    {d.discarded
                      ? <span className="status-btn danger">دون السن القانونية</span>
                      : !d.active
                        ? <span className="muted-cell">معطّل</span>
                        : d.available ? <span className="status-btn ok">متاح</span> : <span className="status-btn warn">ضمن الانتظار</span>}
                  </td>
                  <td className="row-actions-icons">
                    <IconButton icon={HeartHandshake} label="تسجيل تبرّع اليوم" onClick={() => markDonated(d)} disabled={!d.active || d.discarded} />
                    <IconButton icon={Power} label={d.active ? 'تعطيل' : 'تفعيل'} onClick={() => toggleActive(d)} />
                    <IconButton icon={Pencil} label="تعديل" onClick={() => { setFormError(''); setForm(d); }} />
                    <IconButton icon={Trash2} label="حذف" tone="danger" onClick={() => remove(d)} />
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
