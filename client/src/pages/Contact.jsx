import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Phone, MessageCircle, Send, CheckCircle2, HeartHandshake, MessageSquare, Clock } from 'lucide-react';
import { FaInstagram, FaFacebookF } from 'react-icons/fa';
import { useSettings } from '../App.jsx';
import { api } from '../lib/api.js';
import { waLink } from '../lib/links.js';
import PageHeader from '../components/PageHeader.jsx';

const KINDS = {
  contact: { label: 'رسالة عامة', icon: MessageSquare },
  volunteer: { label: 'طلب تطوّع', icon: HeartHandshake },
};

export default function Contact() {
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const initialKind = params.get('kind') === 'volunteer' ? 'volunteer' : 'contact';
  const EMPTY = { kind: initialKind, name: '', phone: '', message: '' };
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, error: '', sent: false });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: '', sent: false });
    try {
      await api('/public/messages', { method: 'POST', body: form });
      setForm({ ...EMPTY, kind: form.kind });
      setState({ busy: false, error: '', sent: true });
    } catch (err) {
      setState({ busy: false, error: err.message, sent: false });
    }
  }

  const channels = [
    settings.phone && { key: 'phone', icon: Phone, label: 'الهاتف', value: settings.phone, href: `tel:${settings.phone}`, ltr: true },
    settings.whatsapp && { key: 'wa', icon: MessageCircle, label: 'واتساب', value: settings.whatsapp, href: waLink(settings.whatsapp), ltr: true, external: true },
    settings.instagram && { key: 'ig', icon: FaInstagram, label: 'إنستغرام', value: 'تابعنا على إنستغرام', href: settings.instagram, external: true },
    settings.facebook && { key: 'fb', icon: FaFacebookF, label: 'فيسبوك', value: 'تابعنا على فيسبوك', href: settings.facebook, external: true },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        icon={Mail}
        kicker="نحن هنا"
        title="تواصل معنا"
        lead="للحالات الطارئة اتصل مباشرة، ولا تستخدم النموذج. للاستفسارات وطلبات التطوّع، أرسل لنا رسالتك."
      />

      <section className="section tight">
        <div className="wrap contact-page">
          <aside className="contact-side">
            {settings.phone && (
              <div className="contact-hotline">
                <span className="contact-hotline-label"><Clock size={15} aria-hidden="true" /> الطوارئ</span>
                <a className="contact-hotline-number" href={`tel:${settings.phone}`}>
                  <bdi>{settings.phone}</bdi>
                </a>
                <a className="contact-hotline-cta" href={`tel:${settings.phone}`}>
                  <Phone size={17} aria-hidden="true" /> اتصل الآن
                </a>
              </div>
            )}

            {channels.length > 0 && (
              <ul className="contact-channels">
                {channels.map(({ key, icon: Icon, label, value, href, ltr, external }) => (
                  <li key={key}>
                    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
                      <span className="contact-channel-icon"><Icon size={18} aria-hidden="true" /></span>
                      <span className="contact-channel-text">
                        <small>{label}</small>
                        <strong dir={ltr ? 'ltr' : undefined}>{value}</strong>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <form className="contact-form" onSubmit={submit}>
            <div className="contact-form-head">
              <h2>أرسل رسالة</h2>
              <p>سنرد عليك في أقرب وقت ممكن.</p>
            </div>

            <div className="contact-kind" role="group" aria-label="نوع الرسالة">
              {Object.entries(KINDS).map(([key, { label, icon: Icon }]) => (
                <button
                  key={key}
                  type="button"
                  className={form.kind === key ? 'on' : ''}
                  aria-pressed={form.kind === key}
                  onClick={() => set({ kind: key })}
                >
                  <Icon size={16} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>

            <div className="contact-grid">
              <label className="field"><span>الاسم الكامل</span>
                <input required autoComplete="name" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field"><span>رقم الهاتف</span>
                <input type="tel" dir="ltr" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
            </div>

            <label className="field">
              <span>{form.kind === 'volunteer' ? 'عرّفنا بنفسك (العمر، البلدة، الخبرة)' : 'الرسالة'}</span>
              <textarea required rows={6} maxLength={2000} value={form.message} onChange={(e) => set({ message: e.target.value })} />
              <small className="contact-count">{form.message.length} / 2000</small>
            </label>

            {state.error && <p className="contact-alert error" role="alert">{state.error}</p>}
            {state.sent && (
              <p className="contact-alert success" role="status"><CheckCircle2 size={18} aria-hidden="true" /> وصلت رسالتك، شكراً لك.</p>
            )}

            <button className="btn primary contact-submit" disabled={state.busy}>
              <Send size={16} aria-hidden="true" /> {state.busy ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
