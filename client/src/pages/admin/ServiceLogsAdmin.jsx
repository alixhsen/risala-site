import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Trash2, Activity, Check, Stethoscope, EyeOff, Hash } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, IconButton, EmptyPanel } from '../../components/admin/DataPage.jsx';
import { api, formatDate, MONTHS_AR } from '../../lib/api.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { service_type_id: '', team_member_id: '', quantity: 1, service_date: today(), notes: '' };

export default function ServiceLogsAdmin() {
  const { confirm, notify } = useDialog();
  const { isAdmin } = useAdmin();
  const types = useLoad('/admin/service-types', []);
  const team = useLoad('/admin/team', []);
  const { data, error, reload } = useLoad('/admin/service-logs', []);
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, error: '' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const now = new Date();
  const thisMonth = data.filter((r) => {
    const d = new Date(r.service_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthQty = thisMonth.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const byType = useMemo(() => {
    const m = new Map();
    thisMonth.forEach((r) => m.set(r.service_type_name, (m.get(r.service_type_name) || 0) + Number(r.quantity || 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [thisMonth]);
  const paramedicsThisMonth = new Set(thisMonth.map((r) => r.team_member_id).filter(Boolean)).size;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (typeFilter && r.service_type_name !== typeFilter) return false;
      if (!q) return true;
      return [r.service_type_name, r.team_member_name, r.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, typeFilter]);

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api('/admin/service-logs', { method: 'POST', body: form });
      setForm(EMPTY);
      reload();
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  async function remove(row) {
    if (!(await confirm(`حذف سجل "${row.service_type_name}"؟`, { danger: true }))) return;
    await api(`/admin/service-logs/${row.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الميدان"
        title="سجلّ الخدمات الطبية"
        subtitle="سجّل كل خدمة طبية تُؤدّى (تغيير جرح، تقطيب، تعليق مصل…) لتُحتسب في التقرير الشهري. لا تظهر هذه البيانات على الموقع العام."
      />

      <StatTiles items={[
        { label: `خدمات ${MONTHS_AR[now.getMonth()]}`, value: thisMonth.length, sub: 'سجلات', tone: 'brand' },
        { label: 'مجموع الكميات هذا الشهر', value: monthQty, tone: 'gold' },
        { label: 'مسعفون سجّلوا خدمات', value: paramedicsThisMonth, sub: 'هذا الشهر', tone: 'brand' },
        { label: 'أكثر خدمة', value: byType[0]?.[0] || '—', sub: byType[0] ? `${byType[0][1]} كمية` : 'لا بيانات بعد', tone: 'warn' },
      ]} />

      <form className="drawer-form" onSubmit={save}>
        <FormSection icon={Stethoscope} title="تسجيل خدمة" help="اختر نوع الخدمة والمسعف، ثم حدّد الكمية والتاريخ.">
          <div className="field-row">
            <label className="field"><span>نوع الخدمة</span>
              <select required value={form.service_type_id} onChange={(e) => set({ service_type_id: e.target.value })}>
                <option value="">— اختر نوع الخدمة —</option>
                {types.data.filter((t) => t.active || t.id === Number(form.service_type_id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="field"><span>المسعف</span>
              <select value={form.team_member_id} onChange={(e) => set({ team_member_id: e.target.value })}>
                <option value="">— غير محدّد —</option>
                {team.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <small className="field-help">اختياري، ويُستخدم لتقرير المسعف الفردي.</small>
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>العدد</span>
              <input type="number" min="1" required value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
            </label>
            <label className="field"><span>التاريخ</span>
              <input type="date" value={form.service_date} onChange={(e) => set({ service_date: e.target.value })} />
            </label>
          </div>
          <label className="field field-wide"><span>ملاحظات</span>
            <textarea rows={2} placeholder="اختياري" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          {state.error && <p className="error" role="alert">{state.error}</p>}
        </FormSection>
        <SaveBar hint="هذه البيانات داخلية ولا تُنشر على الموقع.">
          <button type="button" className="btn" onClick={() => setForm(EMPTY)} disabled={state.busy}>مسح الحقول</button>
          <button className="btn primary" disabled={state.busy}><Check size={15} aria-hidden="true" /> {state.busy ? 'جارٍ الحفظ…' : 'تسجيل الخدمة'}</button>
        </SaveBar>
      </form>

      {error && <p className="error">{error}</p>}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بنوع الخدمة أو اسم المسعف أو الملاحظات">
        <label className="field filter-select">
          <span>نوع الخدمة</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">كل الأنواع</option>
            {types.data.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Activity} title="لا سجلّات خدمات بعد" text="سجّل أول خدمة من النموذج أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب تغيير البحث أو نوع الخدمة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>الخدمة</th><th>العدد</th><th>المسعف</th><th>ملاحظات</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.service_date)}</td>
                  <td><strong>{row.service_type_name}</strong></td>
                  <td><span className="qty-chip"><Hash size={12} aria-hidden="true" /> {row.quantity}</span></td>
                  <td>{row.team_member_name || <span className="muted-cell"><EyeOff size={12} aria-hidden="true" /> غير محدّد</span>}</td>
                  <td className="cell-wrap">{row.notes || '—'}</td>
                  <td className="row-actions-icons">
                    {isAdmin && <IconButton icon={Trash2} label="حذف السجل" tone="danger" onClick={() => remove(row)} />}
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
