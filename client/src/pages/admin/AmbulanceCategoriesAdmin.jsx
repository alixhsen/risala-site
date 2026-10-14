import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', kind: 'income', sort_order: 0, active: true };
const KIND_LABEL = { income: 'إيراد', outcome: 'مصروف' };

// Managed lists of income sources (تبرعات، دعم جهة...) and outcome types
// (وقود، صيانة...) for the ambulance ledger - one table, split by `kind`.
export default function AmbulanceCategoriesAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/ambulance-categories', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [tab, setTab] = useState('income');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const rows = useMemo(() => data.filter((c) => c.kind === tab), [data, tab]);

  async function save(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (form.id) await api(`/admin/ambulance-categories/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/ambulance-categories', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(c) {
    if (!(await confirm(`حذف فئة "${c.name}"؟ لن يتأثر ما سُجِّل بها مسبقاً في السجل المالي.`, { danger: true }))) return;
    await api(`/admin/ambulance-categories/${c.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>فئات مالية سيارة الإسعاف</h1>
        <button className="btn primary" onClick={() => setForm({ ...EMPTY, kind: tab })}>فئة جديدة</button>
      </div>
      <p className="hint">مصادر الإيرادات (تبرعات، دعم جهة...) وأنواع المصروفات (وقود، صيانة...) تظهر عند تسجيل حركة مالية جديدة.</p>
      {error && <p className="error">{error}</p>}

      <div className="field-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn ${tab === 'income' ? 'primary' : ''}`} onClick={() => setTab('income')}>الإيرادات</button>
        <button type="button" className={`btn ${tab === 'outcome' ? 'primary' : ''}`} onClick={() => setTab('outcome')}>المصروفات</button>
      </div>

      {form && (
        <form className="card form" onSubmit={save}>
          <h2>{form.id ? 'تعديل فئة' : 'فئة جديدة'}</h2>
          <div className="field-row">
            <label className="field"><span>الاسم</span>
              <input required maxLength={100} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field"><span>النوع</span>
              <select value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="income">إيراد</option>
                <option value="outcome">مصروف</option>
              </select>
            </label>
            <label className="field"><span>الترتيب</span>
              <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> ظاهرة عند اختيار فئة</label>
          {formError && <p className="error">{formError}</p>}
          <div className="actions">
            <button className="btn primary">حفظ</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>الاسم</th><th>ظاهرة</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.active ? 'نعم' : 'لا'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => setForm({ ...c, active: !!c.active })}>تعديل</button>
                  <button className="link danger" onClick={() => remove(c)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted" style={{ padding: 16 }}>لا فئات {KIND_LABEL[tab]} بعد.</p>}
      </div>
    </>
  );
}
