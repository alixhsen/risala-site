import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', color: '#2f9e3a', sort_order: 0, active: true };

export default function MissionTypesAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/mission-types', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (form.id) await api(`/admin/mission-types/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/mission-types', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(t) {
    if (!(await confirm(`حذف نوع "${t.name}"؟ المهام المرتبطة به تبقى، بدون نوع.`, { danger: true }))) return;
    await api(`/admin/mission-types/${t.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>أنواع المهام</h1>
        <button className="btn primary" onClick={() => setForm(EMPTY)}>نوع جديد</button>
      </div>
      <p className="hint">هذه الأنواع تظهر عند إضافة مهمة جديدة، مثل: حالة مرضية، حادث سير، غارة…</p>
      {error && <p className="error">{error}</p>}

      {form && (
        <form className="card form" onSubmit={save}>
          <h2>{form.id ? 'تعديل نوع' : 'نوع جديد'}</h2>
          <div className="field-row">
            <label className="field"><span>الاسم</span>
              <input required maxLength={80} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field"><span>اللون</span>
              <input type="color" value={form.color} onChange={(e) => set({ color: e.target.value })} />
            </label>
            <label className="field"><span>الترتيب</span>
              <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> ظاهر عند إضافة مهمة</label>
          {formError && <p className="error">{formError}</p>}
          <div className="actions">
            <button className="btn primary">حفظ</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>اللون</th><th>الاسم</th><th>ظاهر</th><th></th></tr></thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id}>
                <td><span className="color-dot" style={{ background: t.color }} /></td>
                <td>{t.name}</td>
                <td>{t.active ? 'نعم' : 'لا'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => setForm({ ...t, active: !!t.active })}>تعديل</button>
                  <button className="link danger" onClick={() => remove(t)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
