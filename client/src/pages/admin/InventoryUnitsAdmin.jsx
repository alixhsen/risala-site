import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', sort_order: 0, active: true };

// Managed list of inventory units (box, pack, bottle, pcs...) - feeds the
// unit dropdown on each inventory item, and can grow as new packaging types
// show up without needing a code change.
export default function InventoryUnitsAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/inventory-units', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (form.id) await api(`/admin/inventory-units/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/inventory-units', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(u) {
    if (!(await confirm(`حذف وحدة "${u.name}"؟ لن يتأثر ما سُجِّل بها مسبقاً في المخزون.`, { danger: true }))) return;
    await api(`/admin/inventory-units/${u.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>وحدات القياس</h1>
        <button className="btn primary" onClick={() => setForm(EMPTY)}>وحدة جديدة</button>
      </div>
      <p className="hint">مثل: قطعة، صندوق، عبوة، زجاجة… تظهر هذه عند اختيار وحدة مادة في "المخزون الطبي".</p>
      {error && <p className="error">{error}</p>}

      {form && (
        <form className="card form" onSubmit={save}>
          <h2>{form.id ? 'تعديل وحدة' : 'وحدة جديدة'}</h2>
          <div className="field-row">
            <label className="field"><span>الاسم</span>
              <input required maxLength={30} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field"><span>الترتيب</span>
              <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> ظاهرة عند اختيار وحدة</label>
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
            {data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.active ? 'نعم' : 'لا'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => setForm({ ...u, active: !!u.active })}>تعديل</button>
                  <button className="link danger" onClick={() => remove(u)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="muted" style={{ padding: 16 }}>لا وحدات بعد.</p>}
      </div>
    </>
  );
}
