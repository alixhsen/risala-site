import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { useLoad } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { api } from '../../lib/api.js';

// Every grantable admin page, grouped the same way as the sidebar nav.
// Keep in sync with MODULE_KEYS in server/src/routes/admin.js and the nav
// paths (and pageKey column) in AdminLayout.jsx.
const PAGE_GROUPS = [
  ['المحتوى', [
    ['posts', 'المنشورات'],
    ['generator', 'مولّد الصور'],
    ['gallery', 'معرض الصور'],
    ['team', 'الفريق'],
    ['messages', 'الرسائل'],
  ]],
  ['الميدان', [
    ['mission-types', 'أنواع المهام'],
    ['reports', 'التقارير الشهرية'],
    ['yearly-report', 'التقرير السنوي'],
    ['member-reports', 'تقارير المسعفين'],
    ['service-types', 'أنواع الخدمات'],
    ['service-logs', 'سجلّ الخدمات'],
    ['schedule', 'جدول المناوبات'],
  ]],
  ['النماذج والمحاضر', [
    ['documents', 'المحاضر والنماذج'],
  ]],
  ['المخزون', [
    ['inventory', 'المخزون الطبي'],
    ['inventory-assets', 'الأصول الثابتة'],
    ['inventory-units', 'وحدات القياس'],
    ['inventory-categories', 'فئات المخزون'],
    ['inventory-usage', 'سجلّ الاستخدام'],
    ['loaned-items', 'العُهد'],
    ['inventory-report', 'تقرير المخزون'],
  ]],
  ['سيارة الإسعاف', [
    ['ambulance-finance', 'الإيرادات والمصروفات'],
    ['ambulance-categories', 'فئات مالية السيارة'],
    ['ambulance-assets', 'معدات السيارة'],
  ]],
  ['الخدمات المجتمعية', [
    ['blood-donations', 'التبرع بالدم'],
    ['community-donations', 'خدمات عينية'],
    ['donation-item-types', 'أصناف الخدمات العينية'],
  ]],
];
const PAGE_LABELS = Object.fromEntries(PAGE_GROUPS.flatMap(([, pages]) => pages));

const EMPTY = { username: '', display_name: '', password: '', role: 'editor', permissions: [] };

function togglePermission(list, key) {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

function PermissionPicker({ role, permissions, onToggle }) {
  if (role === 'admin') return <p className="hint">المدير لديه صلاحية كاملة على كل الصفحات تلقائياً.</p>;
  return (
    <div className="perm-picker">
      {PAGE_GROUPS.map(([group, pages]) => (
        <div key={group} className="perm-group">
          <p className="perm-group-title">{group}</p>
          <div className="chip-filter" role="group" aria-label={group}>
            {pages.map(([key, label]) => (
              <button key={key} type="button" className={permissions.includes(key) ? 'on' : ''} aria-pressed={permissions.includes(key)} onClick={() => onToggle(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Users() {
  const { confirm, notify } = useDialog();
  const { user } = useAdmin();
  const { data, error, reload } = useLoad('/admin/users', []);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [pw, setPw] = useState(null); // { id, username, value, confirm } while the password form is open
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [perm, setPerm] = useState(null); // { id, username, role, permissions } while the permissions form is open
  const [permBusy, setPermBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setFormError('');
    try {
      await api('/admin/users', { method: 'POST', body: form });
      setForm(EMPTY);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function update(u, body) {
    await api(`/admin/users/${u.id}`, { method: 'PUT', body }).then(reload).catch((err) => notify(err.message));
  }

  function openPassword(u) {
    setPwError('');
    setPw({ id: u.id, username: u.username, value: '', confirm: '' });
  }

  function openPermissions(u) {
    setPerm({ id: u.id, username: u.username, role: u.role, permissions: u.permissions || [] });
  }

  async function savePermissions(e) {
    e.preventDefault();
    setPermBusy(true);
    try {
      await api(`/admin/users/${perm.id}`, { method: 'PUT', body: { role: perm.role, permissions: perm.permissions } });
      setPerm(null);
      reload();
    } catch (err) {
      notify(err.message);
    } finally {
      setPermBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pw.value.length < 8) { setPwError('كلمة المرور 8 أحرف على الأقل'); return; }
    if (pw.value !== pw.confirm) { setPwError('كلمتا المرور غير متطابقتين'); return; }
    setPwBusy(true);
    try {
      await api(`/admin/users/${pw.id}`, { method: 'PUT', body: { password: pw.value } });
      setPw(null);
      reload();
      notify(`تم تغيير كلمة مرور ${pw.username}.`);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <h1>المستخدمون</h1>
      <p className="hint">المدير يتحكم بكل شيء. المحرّر يحضّر المنشورات فقط، ولا تُنشر إلا بموافقة المدير.</p>
      {error && <p className="error">{error}</p>}

      {pw && (
        <form className="card form" onSubmit={savePassword}>
          <h2>كلمة مرور جديدة لـ <bdi dir="ltr">{pw.username}</bdi></h2>
          <div className="field-row">
            <label className="field"><span>كلمة المرور الجديدة</span>
              <input dir="ltr" type="password" autoComplete="new-password" required minLength={8} autoFocus value={pw.value} onChange={(e) => setPw({ ...pw, value: e.target.value })} />
            </label>
            <label className="field"><span>تأكيد كلمة المرور</span>
              <input dir="ltr" type="password" autoComplete="new-password" required minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </label>
          </div>
          {pwError && <p className="error">{pwError}</p>}
          <div className="actions">
            <button className="btn primary" disabled={pwBusy}>{pwBusy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button>
            <button type="button" className="btn" onClick={() => setPw(null)} disabled={pwBusy}>إلغاء</button>
          </div>
        </form>
      )}

      {perm && (
        <form className="card form" onSubmit={savePermissions}>
          <h2>صلاحيات <bdi dir="ltr">{perm.username}</bdi></h2>
          <label className="field"><span>الدور</span>
            <select
              value={perm.role}
              onChange={(e) => setPerm({ ...perm, role: e.target.value })}
              disabled={perm.id === user.id}
            >
              <option value="editor">محرّر</option>
              <option value="admin">مدير</option>
            </select>
          </label>
          <label className="field"><span>الصفحات المسموح الوصول إليها</span>
            <PermissionPicker
              role={perm.role}
              permissions={perm.permissions}
              onToggle={(key) => setPerm({ ...perm, permissions: togglePermission(perm.permissions, key) })}
            />
          </label>
          <div className="actions">
            <button className="btn primary" disabled={permBusy}>{permBusy ? 'جارٍ الحفظ…' : 'حفظ الصلاحيات'}</button>
            <button type="button" className="btn" onClick={() => setPerm(null)} disabled={permBusy}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>المستخدم</th><th>الاسم</th><th>الدور</th><th>الصفحات</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td dir="ltr">{u.username}</td>
                <td>{u.display_name}</td>
                <td>{u.role === 'admin' ? 'مدير' : 'محرّر'}</td>
                <td>
                  {u.role === 'admin'
                    ? 'الكل'
                    : (u.permissions?.length
                      ? u.permissions.map((k) => PAGE_LABELS[k] || k).join('، ')
                      : <span className="muted">لا شيء</span>)}
                </td>
                <td>{u.active ? 'فعّال' : 'معطّل'}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => openPermissions(u)}>الصلاحيات</button>
                  <button className="link" onClick={() => openPassword(u)}>تغيير كلمة المرور</button>
                  {u.id !== user.id && (
                    <button className="link danger" onClick={() => update(u, { active: !u.active })}>{u.active ? 'تعطيل' : 'تفعيل'}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card form" onSubmit={create}>
        <h2>مستخدم جديد</h2>
        <div className="field-row">
          <label className="field"><span>اسم المستخدم (بالإنجليزية)</span>
            <input dir="ltr" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </label>
          <label className="field"><span>الاسم الظاهر</span>
            <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>كلمة المرور</span>
            <input dir="ltr" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label className="field"><span>الدور</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="editor">محرّر</option>
              <option value="admin">مدير</option>
            </select>
          </label>
        </div>
        <label className="field"><span>الصفحات المسموح الوصول إليها</span>
          <PermissionPicker
            role={form.role}
            permissions={form.permissions}
            onToggle={(key) => setForm({ ...form, permissions: togglePermission(form.permissions, key) })}
          />
        </label>
        {formError && <p className="error">{formError}</p>}
        <button className="btn primary">إضافة</button>
      </form>
    </>
  );
}
