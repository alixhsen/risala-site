import { useEffect, useMemo, useState } from 'react';
import { UserRound, IdCard, Phone, ClipboardList, Plus, Eye, Pencil, Trash2, X, Check, Siren, Stethoscope, FileSpreadsheet, Car } from 'lucide-react';
import { toCsv, downloadCsv } from '../../lib/csv.js';
import { useDialog } from '../../components/admin/Dialog.jsx';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate, MONTHS_AR } from '../../lib/api.js';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = {
  first_name: '', family_name: '', role_title: '', group_name: '', photo_url: '', sort_order: 0, visible: true,
  nickname: '', father_name: '', mother_name: '', birth_date: '', birth_place: '', blood_type: '',
  registry_no: '', education: '', phone: '', address: '', joined_on: '', scout_unit: '',
  district: '', region: '', town: '', notes: '',
  has_license: false, license_number: '', license_front_url: '', license_back_url: '',
};

// Dates come back as ISO timestamps; the form and the age maths want YYYY-MM-DD.
// Pages of 10 records per list (matches HISTORY_PAGE on the server).
const PAGE = 10;

const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

// Age in whole years from a YYYY-MM-DD date, using local calendar parts (no timezone shift).
function ageOf(v) {
  const s = dayOf(v);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

// Turns a stored member into form values: nulls become empty strings so inputs stay controlled.
function toForm(m) {
  const out = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (m[k] !== null && m[k] !== undefined) out[k] = m[k];
  // Members saved before the name parts existed only have the full name: use it as the first name.
  if (!m.first_name) out.first_name = m.name || '';
  return { ...out, id: m.id, visible: !!m.visible, has_license: !!m.has_license, birth_date: dayOf(m.birth_date), joined_on: dayOf(m.joined_on) };
}

// Previous / next controls under a paged list.
function Pager({ page, total, onPage }) {
  if (total <= PAGE) return null;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="pager">
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>السابق</button>
      <span>صفحة {page} من {pages}</span>
      <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>التالي</button>
    </div>
  );
}

export default function TeamAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/team', []);
  const [form, setForm] = useState(null); // null = closed
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [viewer, setViewer] = useState(null);
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [pages, setPages] = useState({ m: 1, s: 1 });
  const [history, setHistory] = useState({ id: null, data: null, loading: false, error: '' });
  const [search, setSearch] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const members = useMemo(() => data.map((m) => ({ ...m, age: ageOf(m.birth_date) })), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lo = ageMin === '' ? null : Number(ageMin);
    const hi = ageMax === '' ? null : Number(ageMax);
    return members.filter((m) => {
      if (q && !String(m.name || '').toLowerCase().includes(q)) return false;
      if (bloodFilter && m.blood_type !== bloodFilter) return false;
      if (lo !== null || hi !== null) {
        if (m.age === null) return false;
        if (lo !== null && m.age < lo) return false;
        if (hi !== null && m.age > hi) return false;
      }
      return true;
    });
  }, [members, search, bloodFilter, ageMin, ageMax]);

  const filtering = Boolean(search.trim() || bloodFilter || ageMin !== '' || ageMax !== '');
  const withAge = members.filter((m) => m.age !== null);
  const avgAge = withAge.length ? Math.round(withAge.reduce((s, m) => s + m.age, 0) / withAge.length) : null;
  const viewed = members.find((m) => m.id === viewId) || null;
  const photos = viewed ? [
    viewed.photo_url && { key: 'photo', url: viewed.photo_url, caption: viewed.name },
    viewed.license_front_url && { key: 'front', url: viewed.license_front_url, caption: 'الرخصة - الوجه' },
    viewed.license_back_url && { key: 'back', url: viewed.license_back_url, caption: 'الرخصة - الخلف' },
  ].filter(Boolean) : [];
  useEffect(() => setViewer(null), [viewId]);
  const hist = viewed && history.id === viewed.id ? history.data : null;
  const yearOptions = [...new Set([period.year, now.getFullYear(), ...(history.data?.years || [])])].sort((a, b) => b - a);

  function resetFilters() {
    setSearch('');
    setBloodFilter('');
    setAgeMin('');
    setAgeMax('');
  }

  // Loads the selected member's history for the chosen period and page.
  useEffect(() => {
    if (!viewId) return undefined;
    let alive = true;
    setHistory((h) => ({ ...h, id: viewId, loading: true, error: '' }));
    const q = new URLSearchParams({ year: period.year, month: period.month, mpage: pages.m, spage: pages.s });
    api(`/admin/team/${viewId}/history?${q}`)
      .then((data) => alive && setHistory({ id: viewId, data, loading: false, error: '' }))
      .catch((err) => alive && setHistory({ id: viewId, data: null, loading: false, error: err.message }));
    return () => { alive = false; };
  }, [viewId, period, pages]);

  // Changing the period or opening another member starts again from page 1.
  function setYearMonth(patch) {
    setPeriod((p) => ({ ...p, ...patch }));
    setPages({ m: 1, s: 1 });
  }

  function openFile(id) {
    if (viewId === id) { setViewId(null); return; }
    setPages({ m: 1, s: 1 });
    setViewId(id);
  }

  // Exports the members currently listed (so a filter applies to the file too).
  function exportMembers() {
    const columns = [
      { label: 'الاسم الكامل', value: 'name' },
      { label: 'الصفة', value: 'role_title' },
      { label: 'المجموعة', value: 'group_name' },
      { label: 'الشهرة', value: 'nickname' },
      { label: 'اسم الأب', value: 'father_name' },
      { label: 'اسم الأم', value: 'mother_name' },
      { label: 'تاريخ الولادة', value: (m) => dayOf(m.birth_date) },
      { label: 'العمر', value: 'age' },
      { label: 'محل الولادة', value: 'birth_place' },
      { label: 'فئة الدم', value: 'blood_type' },
      { label: 'رقم السجل', value: 'registry_no' },
      { label: 'المستوى العلمي', value: 'education' },
      { label: 'رقم الهاتف', value: 'phone' },
      { label: 'عنوان السكن', value: 'address' },
      { label: 'تاريخ الانتساب', value: (m) => dayOf(m.joined_on) },
      { label: 'الوحدة الكشفية', value: 'scout_unit' },
      { label: 'المفوضية', value: 'district' },
      { label: 'المنطقة', value: 'region' },
      { label: 'البلدة', value: 'town' },
      { label: 'رخصة قيادة', value: (m) => (m.has_license ? 'نعم' : 'لا') },
      { label: 'رقم الرخصة', value: 'license_number' },
      { label: 'ظاهر على الموقع', value: (m) => (m.visible ? 'نعم' : 'لا') },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`سجل-الفريق-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/team/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/team', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m) {
    if (!(await confirm(`حذف ${m.name}؟ سيُحذف ملفه وسجلّه مع العضو.`, { danger: true }))) return;
    await api(`/admin/team/${m.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    if (viewId === m.id) setViewId(null);
    reload();
  }

  const text = (k, props = {}) => (
    <input value={form[k] || ''} onChange={(e) => set({ [k]: e.target.value })} {...props} />
  );

  const fileRows = viewed ? [
    ['الشهرة', viewed.nickname],
    ['العمر', viewed.age !== null ? `${viewed.age} سنة` : null],
    ['تاريخ الولادة', viewed.birth_date ? formatDate(viewed.birth_date) : null],
    ['محل الولادة', viewed.birth_place],
    ['اسم الأب', viewed.father_name],
    ['اسم الأم', viewed.mother_name],
    ['فئة الدم', viewed.blood_type],
    ['السجل', viewed.registry_no],
    ['المستوى العلمي', viewed.education],
    ['رقم الهاتف', viewed.phone ? <bdi dir="ltr">{viewed.phone}</bdi> : null],
    ['عنوان السكن', viewed.address],
    ['تاريخ الانتساب', viewed.joined_on ? formatDate(viewed.joined_on) : null],
    ['الوحدة الكشفية', viewed.scout_unit],
    ['المفوضية', viewed.district],
    ['المنطقة', viewed.region],
    ['البلدة', viewed.town],
    ['رخصة القيادة', viewed.has_license ? (viewed.license_number || 'نعم') : 'لا يملك'],
  ] : [];

  return (
    <>
      <AdminHead
        kicker="الميدان"
        title="أعضاء الفريق"
        subtitle="سجلّ كامل لكل عضو: بياناته الشخصية وبيانات القيد ومهامه وخدماته. هذه المعلومات تظهر للإدارة فقط ولا تُنشر على الموقع."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportMembers} disabled={rows.length === 0} title="تصدير الأعضاء المعروضين في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => setForm(EMPTY)}><Plus size={16} aria-hidden="true" /> إضافة عضو</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'إجمالي الأعضاء', value: data.length, tone: 'brand' },
        { label: 'ظاهرون على الموقع', value: data.filter((m) => m.visible).length, tone: 'ok' },
        { label: 'فئة الدم مسجّلة', value: data.filter((m) => m.blood_type).length, sub: 'من إجمالي الأعضاء', tone: 'gold' },
        { label: 'متوسط العمر', value: avgAge !== null ? `${avgAge} سنة` : '–', sub: `${withAge.length} عضو لديهم تاريخ ولادة`, tone: 'brand' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={UserRound} title={form.id ? 'تعديل بيانات العضو' : 'عضو جديد'} help="الاسم والصفة والمجموعة والصورة تظهر على الموقع إذا كان العضو ظاهراً. باقي البيانات للإدارة فقط.">
            <div className="field-row">
              <label className="field"><span>الاسم الأول</span>{text('first_name', { required: true, maxLength: 120 })}</label>
              <label className="field"><span>اسم العائلة</span>{text('family_name', { maxLength: 120 })}</label>
            </div>
            <p className="hint">الاسم الكامل كما يظهر: <strong>{[form.first_name, form.father_name, form.family_name].filter(Boolean).join(' ') || '—'}</strong> <span>(يُبنى من الاسم الأول واسم الأب واسم العائلة)</span></p>
            <div className="field-row">
              <label className="field"><span>الصفة</span>{text('role_title', { maxLength: 120, placeholder: 'مسعف، سائق، إطفائي…' })}</label>
              <label className="field"><span>المجموعة</span>{text('group_name', { maxLength: 80, placeholder: 'الإسعاف، الإطفاء، الإنقاذ…' })}</label>
            </div>
            <div className="field-row">
              <label className="field"><span>الترتيب على الموقع</span>
                <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
              </label>
            </div>
            <ImageInput label="الصورة" value={form.photo_url || ''} onChange={(url) => set({ photo_url: url })} />
            <label className="check"><input type="checkbox" checked={!!form.visible} onChange={(e) => set({ visible: e.target.checked })} /> ظاهر على الموقع</label>
          </FormSection>

          <FormSection icon={IdCard} title="بيانات الهوية" help="تُستخدم في السجل والتقارير الفردية.">
            <div className="field-row">
              <label className="field"><span>اسم الأب</span>{text('father_name', { maxLength: 120 })}</label>
              <label className="field"><span>اسم الأم</span>{text('mother_name', { maxLength: 120 })}</label>
            </div>
            <div className="field-row">
              <label className="field"><span>تاريخ الولادة</span>{text('birth_date', { type: 'date' })}</label>
              <label className="field"><span>محل الولادة</span>{text('birth_place', { maxLength: 120 })}</label>
            </div>
            <div className="field-row">
              <label className="field"><span>فئة الدم</span>
                <select value={form.blood_type || ''} onChange={(e) => set({ blood_type: e.target.value })}>
                  <option value="">غير محدد</option>
                  {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="field"><span>رقم السجل</span>{text('registry_no', { maxLength: 40 })}</label>
            </div>
            <div className="field-row">
              <label className="field"><span>المستوى العلمي</span>{text('education', { maxLength: 80, placeholder: 'مثال: جامعي، ثانوي…' })}</label>
              <label className="field"><span>الشهرة</span>{text('nickname', { maxLength: 80 })}</label>
            </div>
          </FormSection>

          <FormSection icon={Car} title="رخصة القيادة" help="للأعضاء الذين يقودون آليات الجمعية.">
            <label className="check"><input type="checkbox" checked={!!form.has_license} onChange={(e) => set({ has_license: e.target.checked })} /> يملك رخصة قيادة</label>
            {form.has_license && (
              <>
                <label className="field"><span>رقم الرخصة</span>{text('license_number', { maxLength: 50 })}</label>
                <div className="field-row">
                  <ImageInput label="صورة الرخصة (الوجه)" value={form.license_front_url || ''} onChange={(url) => set({ license_front_url: url })} />
                  <ImageInput label="صورة الرخصة (الخلف)" value={form.license_back_url || ''} onChange={(url) => set({ license_back_url: url })} />
                </div>
              </>
            )}
          </FormSection>

          <FormSection icon={Phone} title="الاتصال والسكن">
            <div className="field-row">
              <label className="field"><span>رقم الهاتف</span>{text('phone', { dir: 'ltr', type: 'tel', maxLength: 40 })}</label>
              <label className="field"><span>عنوان السكن</span>{text('address', { maxLength: 200 })}</label>
            </div>
          </FormSection>

          <FormSection icon={ClipboardList} title="بيانات القيد في الجمعية" help="تاريخ الانتساب والوحدة والموقع الإداري.">
            <div className="field-row">
              <label className="field"><span>تاريخ الانتساب</span>{text('joined_on', { type: 'date' })}</label>
              <label className="field"><span>الوحدة الكشفية</span>{text('scout_unit', { maxLength: 120 })}</label>
            </div>
            <div className="field-row">
              <label className="field"><span>المفوضية</span>{text('district', { maxLength: 120 })}</label>
              <label className="field"><span>المنطقة</span>{text('region', { maxLength: 120 })}</label>
              <label className="field"><span>البلدة</span>{text('town', { maxLength: 120 })}</label>
            </div>
          </FormSection>

          <FormSection title="ملاحظات">
            <label className="field"><span>ملاحظات داخلية</span>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
          </FormSection>

          {formError && <p className="error" role="alert">{formError}</p>}
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ العضو'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم">
        <label className="field"><span>فئة الدم</span>
          <select value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)}>
            <option value="">الكل</option>
            {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="field"><span>العمر من</span>
          <input type="number" min="0" max="120" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
        </label>
        <label className="field"><span>إلى</span>
          <input type="number" min="0" max="120" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
        </label>
        {filtering && <button type="button" className="btn" onClick={resetFilters}>مسح التصفية</button>}
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={UserRound} title="لا أعضاء بعد" text="أضف أول عضو من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب اسماً آخر، أو غيّر فئة الدم أو نطاق العمر." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead>
              <tr><th>الصورة</th><th>الاسم</th><th>العمر</th><th>فئة الدم</th><th>المجموعة</th><th>الهاتف</th><th>ظاهر</th><th aria-label="إجراءات"></th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.id === viewId ? 'is-selected' : ''}>
                  <td><Thumb src={m.photo_url} alt={m.name} /></td>
                  <td><strong>{m.name}</strong>{m.role_title && <small className="cell-note">{m.role_title}</small>}</td>
                  <td>{m.age !== null ? `${m.age} سنة` : '—'}</td>
                  <td>{m.blood_type ? <strong>{m.blood_type}</strong> : '—'}</td>
                  <td>{m.group_name || '—'}</td>
                  <td>{m.phone ? <bdi dir="ltr">{m.phone}</bdi> : '—'}</td>
                  <td>{m.visible ? 'نعم' : 'لا'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Eye} label={m.id === viewId ? 'إغلاق الملف' : 'عرض الملف والسجل'} onClick={() => openFile(m.id)} tone="brand" />
                    <IconButton icon={Pencil} label="تعديل العضو" onClick={() => { setFormError(''); setForm(toForm(m)); }} />
                    <IconButton icon={Trash2} label="حذف العضو" onClick={() => remove(m)} tone="danger" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewed && (
        <section className="panel member-file">
          <header className="member-detail-head">
            <div className="member-detail-who">
              {viewed.photo_url
                ? <button type="button" className="member-photo-btn" onClick={() => setViewer(photos.findIndex((p) => p.key === 'photo'))}>
                    <img className="member-photo" src={viewed.photo_url} alt="" />
                  </button>
                : <span className="member-photo member-photo-init">{viewed.name.trim().charAt(0)}</span>}
              <div>
                <h2>{viewed.name}</h2>
                <p>{[viewed.role_title, viewed.group_name].filter(Boolean).join(' · ') || 'عضو في الفريق'}</p>
              </div>
            </div>
            <IconButton icon={X} label="إغلاق الملف" onClick={() => setViewId(null)} />
          </header>

          <dl className="info-grid">
            {fileRows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
            ))}
          </dl>
          {viewed.notes && <p className="member-note">{viewed.notes}</p>}
          {viewed.has_license && (viewed.license_front_url || viewed.license_back_url) && (
            <div className="license-photos">
              {viewed.license_front_url && (
                <button type="button" onClick={() => setViewer(photos.findIndex((p) => p.key === 'front'))}>
                  <img src={viewed.license_front_url} alt="صورة الرخصة - الوجه" />
                  <span>الرخصة - الوجه</span>
                </button>
              )}
              {viewed.license_back_url && (
                <button type="button" onClick={() => setViewer(photos.findIndex((p) => p.key === 'back'))}>
                  <img src={viewed.license_back_url} alt="صورة الرخصة - الخلف" />
                  <span>الرخصة - الخلف</span>
                </button>
              )}
            </div>
          )}
          <Lightbox items={photos} index={viewer} onClose={() => setViewer(null)} onChange={setViewer} />

          <div className="member-history-head">
            <div>
              <h3>السجل</h3>
              <p>{period.month ? `${MONTHS_AR[period.month - 1]} ${period.year}` : `كل ${period.year}`}</p>
            </div>
            <div className="rep-tools">
              <label className="field"><span>الشهر</span>
                <select value={period.month} onChange={(e) => setYearMonth({ month: Number(e.target.value) })}>
                  <option value={0}>كل الشهور</option>
                  {MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <label className="field"><span>السنة</span>
                <select value={period.year} onChange={(e) => setYearMonth({ year: Number(e.target.value) })}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
          </div>

          {history.error && <p className="error">{history.error}</p>}
          {!hist && !history.error && <div className="chart-loading" />}

          {hist && (
            <>
              <div className="kpi-grid member-file-kpis">
                <article className="kpi kpi-brand">
                  <span className="kpi-icon"><Siren size={20} aria-hidden="true" /></span>
                  <span className="kpi-label">المهام في الفترة</span>
                  <strong className="kpi-value">{hist.missions.total}</strong>
                  <span className="kpi-sub">{period.month ? MONTHS_AR[period.month - 1] : 'كل الشهور'} {period.year}</span>
                </article>
                <article className="kpi kpi-gold">
                  <span className="kpi-icon"><Stethoscope size={20} aria-hidden="true" /></span>
                  <span className="kpi-label">الخدمات في الفترة</span>
                  <strong className="kpi-value">{hist.services.quantity}</strong>
                  <span className="kpi-sub">{hist.services.total} سجل خدمة</span>
                </article>
              </div>

              <div className="member-lists">
                <div className="panel">
                  <header className="panel-head"><div><h3>المهام</h3><p>المشاركة في العمليات</p></div></header>
                  {hist.missions.total === 0 ? <p className="muted">لا مشاركة في مهام خلال هذه الفترة.</p> : (
                    <ul className="member-items">
                      {hist.missions.items.map((m) => (
                        <li key={m.id}>
                          <span className="member-item-title">{m.title}</span>
                          <span className="member-item-meta">{m.type_name || 'مهمة'} · {formatDate(m.event_date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pager page={hist.missions.page} total={hist.missions.total} onPage={(p) => setPages((x) => ({ ...x, m: p }))} />
                </div>
                <div className="panel">
                  <header className="panel-head"><div><h3>الخدمات الطبية</h3><p>ما نفّذه من خدمات</p></div></header>
                  {hist.services.total === 0 ? <p className="muted">لا خدمات مسجّلة خلال هذه الفترة.</p> : (
                    <ul className="member-items">
                      {hist.services.items.map((s) => (
                        <li key={s.id}>
                          <span className="member-item-title">{s.type_name} <small>×{s.quantity || 1}</small></span>
                          <span className="member-item-meta">{formatDate(s.service_date)}{s.notes ? ` · ${s.notes}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pager page={hist.services.page} total={hist.services.total} onPage={(p) => setPages((x) => ({ ...x, s: p }))} />
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
