import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Gift, Check, X, AlertTriangle } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';

const EMPTY = { name: '', image_url: '', quantity: 0, expiry_date: '', sort_order: 0, active: true };
const EXPIRY_LABEL = { none: 'لا ينتهي', expired: 'منتهي الصلاحية', expiring: 'قريب الانتهاء', ok: 'صالح' };

function expiryStatus(dateStr) {
  if (!dateStr) return { label: EXPIRY_LABEL.none, cls: 'none', key: 'none' };
  const days = (new Date(dateStr) - new Date(new Date().toDateString())) / 86400000;
  if (days < 0) return { label: EXPIRY_LABEL.expired, cls: 'expired', key: 'expired' };
  if (days <= 30) return { label: EXPIRY_LABEL.expiring, cls: 'expiring', key: 'expiring' };
  return { label: EXPIRY_LABEL.ok, cls: 'ok', key: 'ok' };
}

// Donation items now carry their own stock (دواء، حفاضات أطفال، حليب
// أطفال...) with a photo, quantity on hand and an optional expiry -
// feeds the item select on the community-donations page.
export default function DonationItemTypesAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/donation-item-types', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const enriched = useMemo(() => data.map((t) => ({ ...t, ex: expiryStatus(t.expiry_date) })), [data]);
  const counts = useMemo(() => ({
    all: enriched.length,
    quantity: enriched.reduce((s, t) => s + (Number(t.quantity) || 0), 0),
    expiring: enriched.filter((t) => t.ex.key === 'expiring').length,
    expired: enriched.filter((t) => t.ex.key === 'expired').length,
  }), [enriched]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((t) => {
      if (filter === 'expired' && t.ex.key !== 'expired') return false;
      if (filter === 'expiring' && t.ex.key !== 'expiring') return false;
      if (!q) return true;
      return String(t.name || '').toLowerCase().includes(q);
    });
  }, [enriched, filter, search]);

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/donation-item-types/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/donation-item-types', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!(await confirm(`حذف صنف "${t.name}"؟ لن يتأثر ما سُجِّل به مسبقاً من تبرعات.`, { danger: true }))) return;
    await api(`/admin/donation-item-types/${t.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الخدمات المجتمعية"
        title="أصناف الخدمات العينية"
        subtitle="المواد المتوفرة للتبرع (دواء، حفاضات أطفال، حليب أطفال...) بصورتها وكميتها. تظهر هذه عند تسجيل تبرع جديد."
        actions={(
          <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> صنف جديد</button>
        )}
      />

      <StatTiles items={[
        { label: 'عدد الأصناف', value: counts.all, tone: 'brand' },
        { label: 'إجمالي الكميات', value: counts.quantity, tone: 'gold' },
        { label: 'قريبة الانتهاء', value: counts.expiring, sub: 'خلال 30 يوماً', tone: 'warn' },
        { label: 'منتهية الصلاحية', value: counts.expired, sub: 'تحتاج إزالة', tone: 'danger' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Gift} title={form.id ? 'تعديل صنف' : 'صنف جديد'} help="الصورة وتاريخ الانتهاء اختياريان.">
            <div className="field-row">
              <label className="field"><span>الاسم</span>
                <input required maxLength={100} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>الكمية</span>
                <input type="number" min="0" value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>تاريخ انتهاء الصلاحية</span>
                <input type="date" value={form.expiry_date || ''} onChange={(e) => set({ expiry_date: e.target.value })} />
                <small className="field-help">اتركه فارغاً إن كانت المادة لا تنتهي.</small>
              </label>
              <label className="field"><span>الترتيب</span>
                <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
              </label>
            </div>
            <ImageInput label="صورة الصنف" value={form.image_url || ''} onChange={(url) => set({ image_url: url })} />
            <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> ظاهر عند اختيار صنف</label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ الصنف'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم">
        <ChipFilter
          label="حالة الصلاحية"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'الكل', counts.all],
            ['expiring', 'قريبة الانتهاء', counts.expiring],
            ['expired', 'منتهية', counts.expired],
          ]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Gift} title="لا أصناف بعد" text="أضف أول صنف من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الصلاحية." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>الصورة</th><th>الاسم</th><th>الكمية</th><th>الصلاحية</th><th>ظاهر</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className={`row-${t.ex.key}`}>
                  <td><Thumb src={t.image_url} alt={t.name} /></td>
                  <td><strong>{t.name}</strong></td>
                  <td><span className={`qty ${Number(t.quantity) <= 0 ? 'is-zero' : ''}`}>{t.quantity}</span></td>
                  <td>
                    <span className={`status ${t.ex.cls}`}>
                      {t.ex.key === 'expired' && <AlertTriangle size={12} aria-hidden="true" />}
                      {t.ex.label}
                    </span>
                    {t.expiry_date && <small className="cell-date">{formatDate(t.expiry_date)}</small>}
                  </td>
                  <td>{t.active ? 'نعم' : 'لا'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل الصنف" onClick={() => { setFormError(''); setForm({ ...t, active: !!t.active, expiry_date: t.expiry_date ? String(t.expiry_date).slice(0, 10) : '' }); }} />
                    <IconButton icon={Trash2} label="حذف الصنف" tone="danger" onClick={() => remove(t)} />
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
