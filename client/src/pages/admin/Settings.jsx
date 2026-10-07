import { useEffect, useState } from 'react';
import { useLoad, useSettings } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { api } from '../../lib/api.js';

const parseList = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

const Text = ({ label, k, form, set, ...rest }) => (
  <label className="field"><span>{label}</span>
    <input value={form[k] || ''} onChange={(e) => set({ [k]: e.target.value })} {...rest} />
  </label>
);

export default function Settings() {
  const { settings, reload } = useSettings();
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, error: '', saved: false });
  const gallery = useLoad('/admin/gallery', []);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setState((s) => ({ ...s, saved: false })); };

  // Fill the form once, when the settings first arrive.
  useEffect(() => {
    if (!form && Object.keys(settings).length) setForm(settings);
  }, [settings, form]);

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: '', saved: false });
    try {
      await api('/admin/settings', { method: 'PUT', body: form });
      reload();
      setState({ busy: false, error: '', saved: true });
    } catch (err) {
      setState({ busy: false, error: err.message, saved: false });
    }
  }

  if (!form) return <p className="muted">جارٍ التحميل…</p>;
  const p = { form, set };

  return (
    <form onSubmit={save}>
      <h1>الإعدادات</h1>

      <div className="card form">
        <h2>الهوية (تظهر في الموقع وفي إطار الصور)</h2>
        <Text label="السطر الأول: اسم الجمعية" k="line1" {...p} />
        <Text label="السطر الثاني" k="line2" {...p} />
        <Text label="السطر الثالث: اسم المركز / الفريق" k="line3" {...p} />
        <Text label="عنوان الموقع (تبويب المتصفح)" k="site_name" {...p} />
        <Text label="العبارة التعريفية" k="tagline" {...p} />
        <ImageInput label="الشعار (PNG بخلفية شفافة أفضل)" value={form.logo_url} onChange={(url) => set({ logo_url: url })} />
        <ImageInput label="صورة الصفحة الرئيسية" value={form.hero_url} onChange={(url) => set({ hero_url: url })} />
      </div>

      <div className="card form">
        <h2>اقتباس الصفحة الرئيسية (اتركه فارغاً لإخفائه)</h2>
        <label className="field"><span>نص الاقتباس</span>
          <textarea rows={3} value={form.hero_quote || ''} onChange={(e) => set({ hero_quote: e.target.value })} />
        </label>
        <Text label="التوقيع (مثال: الإمام السيد موسى الصدر)" k="hero_quote_author" {...p} />
      </div>

      <div className="card form">
        <h2>النصوص</h2>
        <label className="field"><span>من نحن</span>
          <textarea rows={5} value={form.about_text || ''} onChange={(e) => set({ about_text: e.target.value })} />
        </label>
        <label className="field"><span>تاريخنا</span>
          <textarea rows={8} value={form.history_text || ''} onChange={(e) => set({ history_text: e.target.value })} />
        </label>
      </div>

      <div className="card form">
        <h2>التواصل</h2>
        <div className="field-row">
          <Text label="رقم الطوارئ" k="phone" dir="ltr" {...p} />
          <Text label="واتساب (مع رمز البلد)" k="whatsapp" dir="ltr" placeholder="9617xxxxxxx" {...p} />
        </div>
        <div className="field-row">
          <Text label="رابط فيسبوك" k="facebook" dir="ltr" placeholder="https://" {...p} />
          <Text label="رابط إنستغرام" k="instagram" dir="ltr" placeholder="https://" {...p} />
        </div>
        <Text label="رابط منصة التبرع بالدم (تظهر في الصفحة الرئيسية)" k="donate_url" dir="ltr" placeholder="https://" {...p} />
        <Text label="رابط قناة واتساب (تظهر في الصفحة الرئيسية)" k="whatsapp_channel" dir="ltr" placeholder="https://whatsapp.com/channel/…" {...p} />
      </div>

      <div className="card form">
        <h2>الأرقام في الصفحة الرئيسية (اتركها فارغة لإخفائها)</h2>
        <div className="field-row">
          <Text label="المتطوّعون" k="stat_volunteers" {...p} />
          <Text label="الآليات" k="stat_vehicles" {...p} />
          <Text label="المهمات هذا العام" k="stat_missions" {...p} />
          <Text label="سنوات الخدمة" k="stat_years" {...p} />
        </div>
      </div>

      <div className="card form">
        <h2>صور تقرير السوشال ميديا</h2>
        <p className="hint">اختر الصور التي تظهر في خلفية صورة التقرير الشهري. الرقم على الصورة هو ترتيبها. إن لم تختر شيئاً، تُستخدم صورة الصفحة الرئيسية وصور المعرض.</p>
        {gallery.data.length === 0 && <p className="muted">أضف صوراً إلى معرض الصور أولاً.</p>}
        <div className="report-pick">
          {gallery.data.map((img) => {
            const list = parseList(form.report_photos);
            const idx = list.indexOf(img.url);
            return (
              <button
                key={img.id}
                type="button"
                className={`report-pick-item${idx >= 0 ? ' on' : ''}`}
                aria-pressed={idx >= 0}
                onClick={() => set({ report_photos: JSON.stringify(idx >= 0 ? list.filter((u) => u !== img.url) : [...list, img.url]) })}
              >
                <img src={img.url} alt="" loading="lazy" />
                {idx >= 0 && <span className="report-pick-n">{idx + 1}</span>}
              </button>
            );
          })}
        </div>
        <p className="hint">{parseList(form.report_photos).length} صورة مختارة</p>
      </div>

      {state.error && <p className="error">{state.error}</p>}
      {state.saved && <p className="success">تم الحفظ.</p>}
      <div className="actions sticky-actions">
        <button className="btn primary" disabled={state.busy}>{state.busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
      </div>
    </form>
  );
}
