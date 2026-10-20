import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Trash2, Pencil, Plus, Activity, Check, X, Stethoscope, EyeOff, Hash, Users, Image, WandSparkles, Share2 } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, IconButton, EmptyPanel } from '../../components/admin/DataPage.jsx';
import ParamedicPicker from '../../components/ParamedicPicker.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import CoverGenerator from '../../components/CoverGenerator.jsx';
import SocialPost from '../../components/SocialPost.jsx';
import { api, formatDate, MONTHS_AR } from '../../lib/api.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { service_type_id: '', title: '', cover_url: '', member_ids: [], quantity: 1, service_date: today(), notes: '' };

export default function ServiceLogsAdmin() {
  const { confirm, notify } = useDialog();
  const { isAdmin } = useAdmin();
  const { settings } = useSettings();
  const types = useLoad('/admin/service-types', []);
  const team = useLoad('/admin/team', []);
  const { data, error, reload } = useLoad('/admin/service-logs', []);
  const [form, setForm] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
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
  const paramedicsThisMonth = new Set(thisMonth.flatMap((r) => (r.member_names ? r.member_names.split('، ') : []))).size;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (typeFilter && r.service_type_name !== typeFilter) return false;
      if (!q) return true;
      return [r.service_type_name, r.title, r.member_names, r.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, typeFilter]);

  function openNew() {
    setState({ busy: false, error: '' });
    setShowGenerator(false);
    setForm(EMPTY);
  }

  async function openEdit(row) {
    setState({ busy: false, error: '' });
    setShowGenerator(false);
    try {
      const full = await api(`/admin/service-logs/${row.id}`);
      setForm({
        id: full.id,
        service_type_id: full.service_type_id,
        title: full.title || '',
        cover_url: full.cover_url || '',
        member_ids: full.member_ids || [],
        quantity: full.quantity,
        service_date: full.service_date ? String(full.service_date).slice(0, 10) : today(),
        notes: full.notes || '',
      });
    } catch (err) {
      notify(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      if (form.id) await api(`/admin/service-logs/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/service-logs', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  async function remove(row) {
    if (!(await confirm(`حذف سجل "${row.service_type_name}"؟`, { danger: true }))) return;
    await api(`/admin/service-logs/${row.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  const selectedType = form ? types.data.find((t) => t.id === Number(form.service_type_id)) : null;
  const memberNames = form ? team.data.filter((m) => form.member_ids.includes(m.id)).map((m) => m.name) : [];
  const dateLabel = form ? formatDate(form.service_date) : '';
  const initialInfo = form ? { typeLabel: selectedType?.name || '', dateLabel, names: memberNames, body: form.notes } : null;

  return (
    <>
      <AdminHead
        kicker="الميدان"
        title="سجلّ الخدمات الطبية"
        subtitle="سجّل كل خدمة طبية تُؤدّى (تغيير جرح، تقطيب، تعليق مصل…) لتُحتسب في التقرير الشهري. لا تظهر هذه البيانات على الموقع العام."
        actions={<button type="button" className="btn primary" onClick={openNew}><Plus size={16} aria-hidden="true" /> خدمة جديدة</button>}
      />

      <StatTiles items={[
        { label: `خدمات ${MONTHS_AR[now.getMonth()]}`, value: thisMonth.length, sub: 'سجلات', tone: 'brand' },
        { label: 'مجموع الكميات هذا الشهر', value: monthQty, tone: 'gold' },
        { label: 'مسعفون سجّلوا خدمات', value: paramedicsThisMonth, sub: 'هذا الشهر', tone: 'brand' },
        { label: 'أكثر خدمة', value: byType[0]?.[0] || '—', sub: byType[0] ? `${byType[0][1]} كمية` : 'لا بيانات بعد', tone: 'warn' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Stethoscope} title={form.id ? 'تعديل الخدمة' : 'تسجيل خدمة'} help="اختر نوع الخدمة، ثم حدّد الكمية والتاريخ.">
            <div className="field-row">
              <label className="field"><span>نوع الخدمة</span>
                <select required value={form.service_type_id} onChange={(e) => set({ service_type_id: e.target.value })}>
                  <option value="">— اختر نوع الخدمة —</option>
                  {types.data.filter((t) => t.active || t.id === Number(form.service_type_id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="field"><span>العدد</span>
                <input type="number" min="1" required value={form.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>التاريخ</span>
                <input type="date" value={form.service_date} onChange={(e) => set({ service_date: e.target.value })} />
              </label>
              <label className="field"><span>العنوان (اختياري، لمولّد الصور)</span>
                <input maxLength={200} placeholder="مثال: حملة إسعافات أولية" value={form.title} onChange={(e) => set({ title: e.target.value })} />
              </label>
            </div>
            <label className="field field-wide"><span>التفاصيل / ملاحظات</span>
              <textarea rows={3} placeholder="اختياري" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {state.error && <p className="error" role="alert">{state.error}</p>}
          </FormSection>

          <FormSection icon={Users} title="الفريق المشارك" help="اختر من شارك في تأدية هذه الخدمة، ليُحتسبوا في تقرير المسعفين">
            <ParamedicPicker value={form.member_ids} onChange={(ids) => set({ member_ids: ids })} />
          </FormSection>

          <FormSection icon={Image} title="صورة الغلاف" help="ارفع صورة جاهزة، أو صمّم غلافاً بالمولّد">
            <ImageInput label="صورة الغلاف" value={form.cover_url} onChange={(url) => set({ cover_url: url })} />
            <button type="button" className="btn outline" onClick={() => setShowGenerator(!showGenerator)}>
              <WandSparkles size={16} aria-hidden="true" /> {showGenerator ? 'إغلاق المولّد' : 'فتح مولّد الصور'}
            </button>
            {showGenerator && (
              <div className="editor-gen">
                <p className="hint">صمّم غلافاً، ثم بطاقة معلومات بتفاصيل الخدمة، ونزّلهما معاً كمنشور من صورتين.</p>
                <CoverGenerator settings={settings} initialTitle={form.title} initialInfo={initialInfo} onUse={(url) => set({ cover_url: url })} />
              </div>
            )}
          </FormSection>

          <FormSection icon={Share2} title="صور التواصل الاجتماعي" help="تُنشأ تلقائياً من بيانات الخدمة أعلاه، بمقاس عمودي جاهز لإنستغرام وفيسبوك">
            <SocialPost
              settings={settings}
              title={form.title}
              coverUrl={form.cover_url}
              dateLabel={dateLabel}
              typeLabel={selectedType?.name || ''}
              summary={form.notes}
              body={form.notes}
              names={memberNames}
            />
          </FormSection>

          <SaveBar hint="هذه البيانات داخلية ولا تُنشر على الموقع.">
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={state.busy}><Check size={15} aria-hidden="true" /> {state.busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بنوع الخدمة أو العنوان أو اسم المسعف أو الملاحظات">
        <label className="field filter-select">
          <span>نوع الخدمة</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">كل الأنواع</option>
            {types.data.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Activity} title="لا سجلّات خدمات بعد" text="سجّل أول خدمة من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب تغيير البحث أو نوع الخدمة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>الخدمة</th><th>العدد</th><th>الفريق المشارك</th><th>ملاحظات</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.service_date)}</td>
                  <td>
                    <strong>{row.service_type_name}</strong>
                    {row.title && <span className="cell-note">{row.title}</span>}
                  </td>
                  <td><span className="qty-chip"><Hash size={12} aria-hidden="true" /> {row.quantity}</span></td>
                  <td>{row.member_names || <span className="muted-cell"><EyeOff size={12} aria-hidden="true" /> غير محدّد</span>}</td>
                  <td className="cell-wrap">{row.notes || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل السجل" onClick={() => openEdit(row)} />
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
