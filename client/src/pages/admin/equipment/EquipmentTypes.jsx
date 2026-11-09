import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Boxes, Check, X, Warehouse, SlidersHorizontal } from 'lucide-react';
import { useLoad } from '../../../App.jsx';
import { useAdmin } from '../../../components/AdminLayout.jsx';
import { useDialog } from '../../../components/admin/Dialog.jsx';
import { AdminHead, FormSection, SaveBar } from '../../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, IconButton, EmptyPanel } from '../../../components/admin/DataPage.jsx';
import { Modal, useEqAccess } from '../../../components/admin/EquipmentParts.jsx';
import { api } from '../../../lib/api.js';

const EMPTY = { name: '', category: '', description: '', sizes: '', tracks_serial: false, min_stock: '', active: true };
const today = () => new Date().toISOString().slice(0, 10);

export default function EquipmentTypes() {
  const admin = useAdmin();
  const { canManage } = useEqAccess(admin);
  const { confirm, notify } = useDialog();
  const { data: types, error, reload } = useLoad('/admin/equipment/types', []);
  const { data: lines, reload: reloadLines } = useLoad('/admin/equipment/inventory', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [openType, setOpenType] = useState(null);
  const [stockForm, setStockForm] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const categories = useMemo(() => [...new Set(types.map((t) => t.category).filter(Boolean))], [types]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return types.filter((t) => !q || `${t.name} ${t.category || ''}`.toLowerCase().includes(q));
  }, [types, search]);
  const totals = useMemo(() => ({
    types: types.length,
    stock: types.reduce((n, t) => n + t.in_stock, 0),
    out: types.reduce((n, t) => n + t.with_members, 0),
    low: types.filter((t) => t.active && t.min_stock !== null && t.in_stock < t.min_stock).length,
  }), [types]);
  const refresh = () => { reload(); reloadLines(); };

  async function save(e) {
    e.preventDefault();
    setFormError(''); setBusy(true);
    try {
      const body = { ...form, sizes: form.sizes };
      if (form.id) await api(`/admin/equipment/types/${form.id}`, { method: 'PUT', body });
      else await api('/admin/equipment/types', { method: 'POST', body });
      setForm(null); refresh();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }

  async function removeType(t) {
    if (!(await confirm(`حذف النوع «${t.name}»؟ (لا يُحذف إن كان له مخزون أو سجل حركات)`, { danger: true }))) return;
    await api(`/admin/equipment/types/${t.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    refresh();
  }
  async function removeLine(l) {
    if (!(await confirm('حذف سطر المخزون هذا؟', { danger: true }))) return;
    await api(`/admin/equipment/inventory/${l.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    refresh();
  }

  const typeLines = (id) => lines.filter((l) => l.type_id === id);

  return (
    <>
      <AdminHead kicker="العُهد والتجهيزات" title="أنواع التجهيزات والمخزون"
        subtitle="عرّف أي نوع من الأغراض (بدلة، خوذة، لاسلكي…) وأضف مخزونه بمقاساته أو أرقامه التسلسلية. الأنواع الجديدة لا تحتاج تعديلاً في الكود."
        actions={canManage && <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> نوع جديد</button>} />

      <StatTiles items={[
        { label: 'أنواع الأغراض', value: totals.types, tone: 'brand' },
        { label: 'متوفر في المستودع', value: totals.stock, tone: 'ok' },
        { label: 'بحوزة الأعضاء', value: totals.out, tone: 'warn' },
        { label: 'تحت الحد الأدنى', value: totals.low, tone: totals.low ? 'danger' : 'ok' },
      ]} />
      {error && <p className="error">{error}</p>}

      {form && canManage && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Boxes} title={form.id ? 'تعديل نوع الغرض' : 'نوع غرض جديد'}>
            <div className="field-row">
              <label className="field"><span>اسم الغرض</span>
                <input required maxLength={120} placeholder="مثال: الخوذة" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>التصنيف</span>
                <input maxLength={80} list="eq-cats" placeholder="مثال: لباس، حماية، اتصالات" value={form.category || ''} onChange={(e) => set({ category: e.target.value })} />
                <datalist id="eq-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            </div>
            <label className="field"><span>الوصف</span>
              <textarea rows={2} maxLength={500} value={form.description || ''} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <div className="field-row">
              <label className="field"><span>المقاسات المتاحة (افصل بفاصلة، اتركها فارغة إن لم يوجد)</span>
                <input placeholder="S, M, L, XL" value={form.sizes} onChange={(e) => set({ sizes: e.target.value })} />
              </label>
              <label className="field"><span>الحد الأدنى للمخزون (اختياري)</span>
                <input type="number" min="0" value={form.min_stock ?? ''} onChange={(e) => set({ min_stock: e.target.value })} />
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={!!form.tracks_serial} onChange={(e) => set({ tracks_serial: e.target.checked })} /> لكل قطعة رقم تسلسلي أو رقم تعريف (مثل اللاسلكي وبطاقة التعريف)</label>
            <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => set({ active: e.target.checked })} /> مفعّل (يظهر في التسليم)</label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث باسم الغرض أو تصنيفه" />
      {types.length === 0 && <EmptyPanel icon={Boxes} title="لا أنواع بعد" text="أضف أول نوع من الزر أعلاه، مثل «الخوذة» أو «جهاز اللاسلكي»." />}

      <div className="eq-cards">
        {rows.map((t) => {
          const low = t.active && t.min_stock !== null && t.in_stock < t.min_stock;
          const isOpen = openType === t.id;
          return (
            <article key={t.id} className={`eq-card ${t.active ? '' : 'is-off'}`}>
              <header>
                <div>
                  <h3>{t.name} {!t.active && <span className="eq-badge gray">معطّل</span>}{t.tracks_serial && <span className="eq-badge gray">رقم تسلسلي</span>}</h3>
                  <p className="hint">{t.category || 'بلا تصنيف'}{t.description && ` — ${t.description}`}</p>
                </div>
                {canManage && (
                  <span className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل النوع" onClick={() => { setFormError(''); setForm({ ...t, sizes: t.sizes.join(', '), min_stock: t.min_stock ?? '' }); }} />
                    {admin.isAdmin && <IconButton icon={Trash2} label="حذف النوع" tone="danger" onClick={() => removeType(t)} />}
                  </span>
                )}
              </header>
              <dl className="eq-card-stats">
                <div><dt>متوفر</dt><dd className={low ? 'bad' : ''}>{t.in_stock}</dd></div>
                <div><dt>بحوزة الأعضاء</dt><dd>{t.with_members}</dd></div>
                <div><dt>تالف / صيانة</dt><dd>{t.damaged}</dd></div>
                <div><dt>الحد الأدنى</dt><dd>{t.min_stock ?? '—'}</dd></div>
              </dl>
              {low && <p className="eq-low">تحت الحد الأدنى للمخزون</p>}
              {t.sizes.length > 0 && <p className="hint">المقاسات: {t.sizes.join(' · ')}</p>}
              <button type="button" className="btn" onClick={() => setOpenType(isOpen ? null : t.id)}><Warehouse size={15} aria-hidden="true" /> {isOpen ? 'إخفاء المخزون' : 'المخزون'}</button>

              {isOpen && (
                <div className="eq-stock">
                  {canManage && <button type="button" className="btn primary" onClick={() => setStockForm({ type: t, size: t.sizes[0] || '', serial_number: '', quantity: 1 })}><Plus size={15} aria-hidden="true" /> إضافة مخزون</button>}
                  {typeLines(t.id).length === 0 && <p className="hint">لا مخزون مسجّل لهذا النوع بعد.</p>}
                  {typeLines(t.id).length > 0 && (
                    <div className="table-wrap admin-table">
                      <table>
                        <thead><tr>{t.tracks_serial ? <th>الرقم التسلسلي</th> : null}<th>المقاس</th><th>متوفر</th><th>تالف/صيانة</th><th>مع الأعضاء</th><th aria-label="إجراءات"></th></tr></thead>
                        <tbody>
                          {typeLines(t.id).map((l) => (
                            <tr key={l.id}>
                              {t.tracks_serial ? <td><bdi dir="ltr">{l.serial_number}</bdi></td> : null}
                              <td>{l.size || '—'}</td><td>{l.in_stock}</td><td>{l.damaged}</td><td>{l.with_members}</td>
                              <td className="row-actions-icons">
                                {canManage && <IconButton icon={SlidersHorizontal} label="تعديل الكمية" onClick={() => setAdjust({ line: l, in_stock: l.in_stock, damaged: l.damaged, reason: '' })} />}
                                {admin.isAdmin && <IconButton icon={Trash2} label="حذف السطر" tone="danger" onClick={() => removeLine(l)} />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {stockForm && <StockModal state={stockForm} onClose={() => setStockForm(null)} onDone={() => { setStockForm(null); refresh(); }} />}
      {adjust && <AdjustModal state={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); refresh(); }} />}
    </>
  );
}

function StockModal({ state, onClose, onDone }) {
  const t = state.type;
  const [f, setF] = useState({ size: state.size, serial_number: '', quantity: 1, notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/admin/equipment/inventory', { method: 'POST', body: { type_id: t.id, size: f.size, serial_number: f.serial_number, quantity: Number(f.quantity), notes: f.notes, date: today() } });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={`إضافة مخزون — ${t.name}`} onClose={onClose}>
      <form className="eq-modal-form" onSubmit={submit}>
        {t.sizes.length > 0 && (
          <label className="field"><span>المقاس</span>
            <select required value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}>{t.sizes.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>
        )}
        {t.tracks_serial
          ? <label className="field"><span>الرقم التسلسلي / رقم التعريف</span><input required dir="ltr" maxLength={80} value={f.serial_number} onChange={(e) => setF({ ...f, serial_number: e.target.value })} /></label>
          : <label className="field"><span>الكمية المضافة</span><input type="number" min="1" required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></label>}
        <label className="field"><span>ملاحظات</span><input maxLength={500} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="eq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'إضافة'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustModal({ state, onClose, onDone }) {
  const [f, setF] = useState({ in_stock: state.in_stock, damaged: state.damaged, reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/admin/equipment/inventory/${state.line.id}/adjust`, { method: 'POST', body: { in_stock: Number(f.in_stock), damaged: Number(f.damaged), reason: f.reason, date: today() } });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={`تعديل كمية — ${state.line.type_name}${state.line.size ? ` (${state.line.size})` : ''}`} onClose={onClose}>
      <form className="eq-modal-form" onSubmit={submit}>
        <p className="hint">ما بحوزة الأعضاء ({state.line.with_members}) لا يتأثر. يُسجَّل كل تغيير في سجل الحركات مع السبب.</p>
        <div className="field-row">
          <label className="field"><span>متوفر في المستودع</span><input type="number" min="0" required value={f.in_stock} onChange={(e) => setF({ ...f, in_stock: e.target.value })} /></label>
          <label className="field"><span>تالف / يحتاج صيانة</span><input type="number" min="0" required value={f.damaged} onChange={(e) => setF({ ...f, damaged: e.target.value })} /></label>
        </div>
        <label className="field"><span>سبب التعديل (مطلوب)</span><input required maxLength={500} placeholder="مثال: جرد، إصلاح، شطب" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="eq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ التعديل'}</button>
        </div>
      </form>
    </Modal>
  );
}
