import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', sort_order: 0, active: true };

export default function ServiceTypesAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/service-types', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (form.id) await api(`/admin/service-types/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/service-types', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(t) {
    if (!(await confirm(`حذف خدمة "${t.name}"؟`, { danger: true }))) return;
    await api(`/admin/service-types/${t.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>أنواع الخدمات الطبية</h1>
        <button className="btn primary" onClick={() => setForm(EMPTY)}>خدمة جديدة</button>
      </div>
      <p className="hint">مثل: تغيير جرح، تقطيب، تعليق مصل… تظهر هذه عند تسجيل خدمة في "سجلّ الخدمات الطبية"، ولا تظهر على الموقع العام.</p>
      {error && <p className="error">{error}</p>}

      {form && (
        <form className="card form" onSubmit={save}>
          <h2>{form.id ? 'تعديل خدمة' : 'خدمة جديدة'}</h2>
          <div className="field-row">
            <label className="field"><span>الاسم</span>
              <input required maxLength={100} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field"><span>الترتيب</span>
              <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> ظاهرة عند تسجيل خدمة</label>
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
            {data.map((t) => (
              <tr key={t.id}>
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
        {data.length === 0 && <p className="muted" style={{ padding: 16 }}>لا أنواع خدمات بعد.</p>}
      </div>
    </>
  );
}
