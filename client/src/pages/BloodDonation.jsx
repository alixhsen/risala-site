import { useState } from 'react';
import { Droplet, Phone, MessageCircle, Send, CheckCircle2, HeartPulse, Users } from 'lucide-react';
import { useSettings, useLoad } from '../App.jsx';
import { api } from '../lib/api.js';
import { waLink } from '../lib/links.js';
import PageHeader from '../components/PageHeader.jsx';
import useReveal from '../hooks/useReveal.js';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = { name: '', phone: '', blood_type: '', birth_date: '', area: '' };
const TODAY = new Date().toISOString().slice(0, 10);

export default function BloodDonation() {
  const { settings } = useSettings();
  const donateRef = useReveal();
  const stats = useLoad('/public/blood-stats', null);
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, error: '', sent: false });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: '', sent: false });
    try {
      await api('/public/blood-donors', { method: 'POST', body: form });
      setForm(EMPTY);
      setState({ busy: false, error: '', sent: true });
    } catch (err) {
      setState({ busy: false, error: err.message, sent: false });
    }
  }

  const totalAvailable = stats.data
    ? BLOOD_TYPES.reduce((sum, t) => sum + (stats.data.by_type[t]?.available || 0), 0)
    : 0;

  let bloodPhones = [];
  try { bloodPhones = JSON.parse(settings.blood_phones || '[]').filter(Boolean); } catch { bloodPhones = []; }
  const callNumbers = bloodPhones.length ? bloodPhones : (settings.phone ? [settings.phone] : []);

  return (
    <>
      <PageHeader
        icon={Droplet}
        kicker="أنقذ حياة"
        title="التبرّع بالدم"
        lead="عند الحاجة إلى دم نتواصل مع المتبرعين المسجلين لدينا حسب فئة الدم. سجّل بياناتك لتكون من ضمن قائمة المتبرعين الجاهزين."
        count={'مركز الإمام علي الهادي (ع) التطوعي\nو المكتب الصحي لحركة أمل - شعبة بئر حسن'}
        divider
      />

      {/* ============ CALL US ============ */}
      {callNumbers.length > 0 && (
        <section className="section tight">
          <div className="wrap">
            <div ref={donateRef} className="donate reveal">
              <span className="donate-icon"><Phone size={32} aria-hidden="true" /></span>
              <div>
                <h2>بحاجة إلى دم الآن؟</h2>
                <p>اتصل بأحد الأرقام التالية مباشرة، نراجع قائمة المتبرعين المتاحين حسب الفئة المطلوبة ونتواصل معهم فوراً.</p>
              </div>
              <div className="actions">
                {callNumbers.map((n) => (
                  <a key={n} className="btn hi" href={`tel:${n}`}><Phone size={16} aria-hidden="true" /> <bdi>{n}</bdi></a>
                ))}
                {settings.whatsapp && (
                  <a className="btn outline" href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer">
                    <MessageCircle size={16} aria-hidden="true" /> واتساب
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ STATS ============ */}
      <section className="section soft">
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>المتبرعون المتاحون حالياً</h2>
              <p className="section-head-lead">عدد المتبرعين الجاهزين لكل فئة دم (لم يتبرعوا خلال آخر 6 أشهر).</p>
            </div>
          </div>
          <div className="blood-stat-grid">
            {BLOOD_TYPES.map((t) => (
              <div key={t} className="blood-stat-tile">
                <strong>{t}</strong>
                <span>{stats.data ? stats.data.by_type[t]?.available ?? 0 : '—'}</span>
              </div>
            ))}
          </div>
          <div className="blood-stat-foot">
            <span><Users size={15} aria-hidden="true" /> {totalAvailable} متبرع جاهز إجمالاً</span>
            {stats.data && <span><HeartPulse size={15} aria-hidden="true" /> {stats.data.total_donations} عملية تبرّع موثّقة حتى الآن</span>}
          </div>
        </div>
      </section>

      {/* ============ REGISTER FORM ============ */}
      <section className="section tight">
        <div className="wrap">
          <form className="contact-form" onSubmit={submit}>
            <div className="contact-form-head">
              <h2>سجّل كمتبرع</h2>
              <p>بياناتك تبقى لدينا فقط، ونتواصل معك عند الحاجة إلى فئة دمك تحديداً.</p>
            </div>

            <div className="contact-grid">
              <label className="field"><span>الاسم الكامل</span>
                <input required autoComplete="name" maxLength={150} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>رقم الهاتف</span>
                <input required type="tel" dir="ltr" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
            </div>
            <div className="contact-grid">
              <label className="field"><span>فئة الدم</span>
                <select required value={form.blood_type} onChange={(e) => set({ blood_type: e.target.value })}>
                  <option value="">اختر الفئة</option>
                  {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field"><span>تاريخ الميلاد</span>
                <input required type="date" max={TODAY} value={form.birth_date} onChange={(e) => set({ birth_date: e.target.value })} />
              </label>
            </div>
            <div className="contact-grid">
              <label className="field"><span>المنطقة (اختياري)</span>
                <input maxLength={100} value={form.area} onChange={(e) => set({ area: e.target.value })} />
              </label>
            </div>

            {state.error && <p className="contact-alert error" role="alert">{state.error}</p>}
            {state.sent && (
              <p className="contact-alert success" role="status"><CheckCircle2 size={18} aria-hidden="true" /> شكراً لتسجيلك، سنتواصل معك عند الحاجة.</p>
            )}

            <button className="btn primary contact-submit" disabled={state.busy}>
              <Send size={16} aria-hidden="true" /> {state.busy ? 'جارٍ التسجيل…' : 'تسجيل كمتبرع'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
