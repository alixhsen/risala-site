import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', sort_order: 0, active: true };

// Managed list of inventory categories (PPE, Wound Care, Respiratory...) -
// feeds the category dropdown on each inventory item, and can grow as new
// supply types show up without needing a code change.
export default function InventoryCategoriesAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/inventory-categories', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (form.id) await api(`/admin/inventory-categories/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/inventory-categories', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(c) {
    if (!(await confirm(`حذف فئة "${c.name}"؟ لن يتأثر ما سُجِّل بها مسبقاً في المخزون.`, { danger: true }))) return;
    await api(`/admin/inventory-categories/${c.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>فئات المخزون</h1>
        <button className="btn primary" onClick={() => setForm(EMPTY)}>فئة جديدة</button>
      </div>
      <p className="hint">مثل: مستلزمات الحماية الشخصية، العناية بالجروح، معدات التنفس… تظهر هذه عند اختيار فئة مادة في "المخزون الطبي".</p>
      {error && <p className="error">{error}</p>}

      {form && (
        <form className="card form" onSubmit={save}>
          <h2>{form.id ? 'تعديل فئة' : 'فئة جديدة'}</h2>
          <div className="field-row">
            <label className="field"><span>الاسم</span>
              <input required maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} />
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
            {data.map((c) => (
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
        {data.length === 0 && <p className="muted" style={{ padding: 16 }}>لا فئات بعد.</p>}
      </div>
    </>
  );
}
