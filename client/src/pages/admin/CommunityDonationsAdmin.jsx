import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Gift, Check, X, FileSpreadsheet, EyeOff } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, EmptyPanel, IconButton } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const EMPTY = { item_type_id: '', item_detail: '', quantity: 1, team_member_id: '', recipient_name: '', donation_date: new Date().toISOString().slice(0, 10), notes: '' };

// In-kind aid handed out to the community (medicine, baby diapers, infant
// formula...). Item types are a managed list (see "أصناف الخدمات العينية").
export default function CommunityDonationsAdmin() {
  const { confirm, notify } = useDialog();
  const types = useLoad('/admin/donation-item-types', []);
  const team = useLoad('/admin/team', []);
  const { data, error, reload } = useLoad('/admin/community-donations', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const now = new Date();
  const thisMonth = useMemo(() => data.filter((d) => {
    const dt = new Date(d.donation_date);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }), [data]);

  const topType = useMemo(() => {
    const counts = new Map();
    for (const d of data) counts.set(d.item_type_name, (counts.get(d.item_type_name) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [data]);

  const totalQuantity = useMemo(() => data.reduce((s, d) => s + (Number(d.quantity) || 0), 0), [data]);
  const selectedItem = types.data.find((t) => t.id === Number(form?.item_type_id));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((d) => {
      if (typeFilter && d.item_type_name !== typeFilter) return false;
      if (!q) return true;
      return [d.item_type_name, d.item_detail, d.team_member_name, d.recipient_name, d.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, typeFilter, search]);

  function exportRows() {
    const columns = [
      { label: 'التاريخ', value: (d) => String(d.donation_date).slice(0, 10) },
      { label: 'الصنف', value: 'item_type_name' },
      { label: 'تفاصيل الصنف', value: 'item_detail' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'المتبرّع (عضو الفريق)', value: 'team_member_name' },
      { label: 'المستفيد', value: 'recipient_name' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`خدمات-عينية-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/community-donations/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/community-donations', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    if (!(await confirm(`حذف تبرّع "${d.item_type_name}" نهائياً؟`, { danger: true }))) return;
    await api(`/admin/community-donations/${d.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الخدمات المجتمعية"
        title="خدمات عينية"
        subtitle="سجّل المساعدات العينية التي يوزّعها الفريق (دواء، حفاضات أطفال، حليب أطفال…) ومن أعطاها ومن استلمها."
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
        { label: 'إجمالي الكميات الموزّعة', value: totalQuantity, tone: 'gold' },
        { label: 'تبرعات هذا الشهر', value: thisMonth.length, tone: 'ok' },
        { label: 'الأكثر توزيعاً', value: topType?.[0] || '—', sub: topType ? `${topType[1]} تبرّع` : 'لا بيانات بعد', tone: 'warn' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Gift} title={form.id ? 'تعديل تبرّع' : 'تبرّع جديد'} help="اختر الصنف، وأضف تفاصيله إن لزم (مثل اسم الدواء).">
            <div className="field-row">
              <label className="field"><span>الصنف</span>
                <select required value={form.item_type_id} onChange={(e) => set({ item_type_id: e.target.value })}>
                  <option value="">— اختر الصنف —</option>
                  {types.data.filter((t) => t.active || t.id === Number(form.item_type_id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <small className="field-help">
                  صنف جديد؟ أضفه من <a href="/admin/donation-item-types" target="_blank" rel="noreferrer">أصناف الخدمات العينية</a>.
                  {selectedItem && <> المتوفر حالياً: <strong>{selectedItem.quantity}</strong>.</>}
                </small>
              </label>
              <label className="field"><span>الكمية</span>
                <input required type="number" min="1" value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
                <small className="field-help">تُخصم تلقائياً من مخزون الصنف عند الحفظ.</small>
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>تفاصيل الصنف</span>
                <input maxLength={150} placeholder="مثال: اسم الدواء أو مقاس الحفاضات" value={form.item_detail || ''} onChange={(e) => set({ item_detail: e.target.value })} />
              </label>
              <label className="field"><span>عضو الفريق المتبرّع</span>
                <select value={form.team_member_id} onChange={(e) => set({ team_member_id: e.target.value })}>
                  <option value="">— غير محدّد —</option>
                  {team.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>التاريخ</span>
                <input required type="date" value={form.donation_date || ''} onChange={(e) => set({ donation_date: e.target.value })} />
              </label>
              <label className="field"><span>اسم المستفيد</span>
                <input maxLength={150} value={form.recipient_name || ''} onChange={(e) => set({ recipient_name: e.target.value })} />
              </label>
            </div>
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

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالصنف أو المتبرّع أو المستفيد أو الملاحظات">
        <label className="field filter-select">
          <span>الصنف</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">كل الأصناف</option>
            {types.data.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Gift} title="لا تبرعات مسجّلة بعد" text="أضف أول تبرّع من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الصنف." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>الصنف</th><th>التفاصيل</th><th>الكمية</th><th>عضو الفريق</th><th>المستفيد</th><th>ملاحظات</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.donation_date)}</td>
                  <td><strong>{d.item_type_name}</strong></td>
                  <td>{d.item_detail || '—'}</td>
                  <td><span className="qty">{d.quantity}</span></td>
                  <td>{d.team_member_name || <span className="muted-cell"><EyeOff size={12} aria-hidden="true" /> غير محدّد</span>}</td>
                  <td>{d.recipient_name || '—'}</td>
                  <td className="cell-wrap">{d.notes || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل التبرّع" onClick={() => { setFormError(''); setForm({ ...d, donation_date: d.donation_date ? String(d.donation_date).slice(0, 10) : '', item_type_id: d.item_type_id, quantity: d.quantity, team_member_id: d.team_member_id || '' }); }} />
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
