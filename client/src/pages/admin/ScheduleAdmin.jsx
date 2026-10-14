import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Clock, Check, X, Download, Users, Image as ImageIcon } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, EmptyPanel, IconButton } from '../../components/admin/DataPage.jsx';
import ParamedicPicker from '../../components/ParamedicPicker.jsx';
import { api, formatDate } from '../../lib/api.js';
import { generateScheduleReport } from '../../lib/scheduleReport.js';

const EMPTY = { shift_date: '', start_time: '', end_time: '', notes: '', member_ids: [] };

function todayIso() { return new Date().toISOString().slice(0, 10); }
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
// SQL Server's TIME columns come back from the API as a full ISO datetime
// ("1970-01-01T08:00:00.000Z"), not the plain "08:00" the <input type="time">
// needs - pull the HH:MM out with a regex so it works for either shape.
function toHHMM(t) {
  const m = String(t || '').match(/(\d{2}:\d{2})/);
  return m ? m[1] : '';
}
function timeLabel(t) {
  const hhmm = toHHMM(t);
  if (!hhmm) return t || '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Shift-schedule CRUD (date, time range, members on duty) plus a canvas
// generator that turns a date range's shifts into a branded poster image,
// same spirit and code as the activity cover generator.
export default function ScheduleAdmin() {
  const { confirm, notify } = useDialog();
  const { settings } = useSettings();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDays(todayIso(), 6));
  const { data, error, reload } = useLoad(`/admin/shifts?from=${from}&to=${to}`, []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const counts = useMemo(() => {
    const days = new Set(data.map((s) => s.shift_date));
    return { shifts: data.length, days: days.size };
  }, [data]);

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/shifts/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/shifts', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(shift) {
    if (!(await confirm('حذف هذه المناوبة نهائياً؟', { danger: true }))) return;
    await api(`/admin/shifts/${shift.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="الميدان"
        title="جدول المناوبات"
        subtitle="سجّل أوقات المناوبات والمسعفين المكلّفين بها، ثم ولّد صورة جاهزة للمشاركة."
        actions={(
          <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> مناوبة جديدة</button>
        )}
      />

      <div className="field-row" style={{ marginBottom: 16 }}>
        <label className="field"><span>من</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field"><span>إلى</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => { setFrom(todayIso()); setTo(addDays(todayIso(), 6)); }}>هذا الأسبوع</button>
      </div>

      <StatTiles items={[
        { label: 'عدد المناوبات', value: counts.shifts, tone: 'brand' },
        { label: 'عدد الأيام المغطاة', value: counts.days, tone: 'gold' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Clock} title={form.id ? 'تعديل مناوبة' : 'مناوبة جديدة'} help="اختر التاريخ والوقت، ثم المسعفين المكلّفين بهذه المناوبة.">
            <div className="field-row">
              <label className="field"><span>التاريخ</span>
                <input required type="date" value={form.shift_date || ''} onChange={(e) => set({ shift_date: e.target.value })} />
              </label>
              <label className="field"><span>من الساعة</span>
                <input required type="time" value={form.start_time || ''} onChange={(e) => set({ start_time: e.target.value })} />
              </label>
              <label className="field"><span>إلى الساعة</span>
                <input required type="time" value={form.end_time || ''} onChange={(e) => set({ end_time: e.target.value })} />
              </label>
            </div>
            <label className="field"><span><Users size={14} aria-hidden="true" /> المسعفون المكلّفون</span></label>
            <ParamedicPicker value={form.member_ids} onChange={(ids) => set({ member_ids: ids })} />
            <label className="field"><span>ملاحظات</span>
              <textarea rows={2} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ المناوبة'}</button>
          </SaveBar>
        </form>
      )}

      {data.length === 0 && <EmptyPanel icon={Clock} title="لا مناوبات في هذه الفترة" text="أضف أول مناوبة من الزر أعلاه." />}

      {data.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ</th><th>الوقت</th><th>المسعفون</th><th>ملاحظات</th><th aria-label="إجراءات"></th></tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.shift_date)}</td>
                  <td>{timeLabel(s.start_time)} – {timeLabel(s.end_time)}</td>
                  <td>{s.members.length ? s.members.map((m) => m.name).join('، ') : '—'}</td>
                  <td>{s.notes || '—'}</td>
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل المناوبة" onClick={() => { setFormError(''); setForm({ ...s, shift_date: s.shift_date?.slice(0, 10), start_time: toHHMM(s.start_time), end_time: toHHMM(s.end_time), member_ids: s.members.map((m) => m.id) }); }} />
                    <IconButton icon={Trash2} label="حذف المناوبة" tone="danger" onClick={() => remove(s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ScheduleImageGenerator settings={settings} shifts={data} from={from} to={to} />
    </>
  );
}

// One-click poster: a photo-mosaic background (team/gallery photos picked in
// Settings, same source as the monthly report) under a table of every shift
// in the selected range. Same generation flow as the monthly report's
// "share as image" button - no live preview, just generate and download.
function ScheduleImageGenerator({ settings, shifts, from, to }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rangeLabel = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;

  async function generate() {
    setBusy(true);
    setError('');
    try {
      let chosen = [];
      try { chosen = JSON.parse(settings.report_photos || '[]'); } catch { chosen = []; }
      let urls;
      if (Array.isArray(chosen) && chosen.length) {
        urls = chosen;
      } else {
        const gallery = await api('/public/gallery').catch(() => []);
        urls = [settings.hero_url, ...gallery.map((g) => g.url)];
      }
      await generateScheduleReport({ settings, shifts, rangeLabel, photoUrls: [...new Set(urls.filter(Boolean))].slice(0, 9) });
    } catch (err) {
      setError(err.message || 'تعذّر إنشاء الصورة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fsec" style={{ marginTop: 28 }}>
      <header className="fsec-head">
        <span className="fsec-icon"><ImageIcon size={18} aria-hidden="true" /></span>
        <div className="fsec-title">
          <h2>توليد صورة الجدول</h2>
          <p>صورة بتصميم احترافي لمناوبات الفترة المختارة أعلاه (نفس تصميم التقرير الشهري)، جاهزة للتنزيل والمشاركة.</p>
        </div>
      </header>
      <div className="fsec-body">
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn primary" disabled={busy || shifts.length === 0} onClick={generate}>
          <Download size={16} aria-hidden="true" /> {busy ? 'جارٍ التوليد…' : 'توليد وتنزيل الصورة'}
        </button>
        {shifts.length === 0 && <p className="muted">أضف مناوبة واحدة على الأقل في الفترة المختارة أولاً.</p>}
      </div>
    </section>
  );
}
