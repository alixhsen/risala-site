import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Eye, EyeOff, ShieldCheck, Activity, BarChart3, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSettings } from '../../App.jsx';
import { LOGO } from '../../lib/brand.js';

const FEATURES = [
  [ShieldCheck, 'وصول آمن لكل عضو حسب صلاحياته'],
  [Activity, 'متابعة المهام والخدمات الميدانية لحظة بلحظة'],
  [BarChart3, 'تقارير شهرية وسنوية جاهزة للمشاركة'],
];

// Two sides: a branded panel (team photo, logo, a short pitch for the admin
// panel) and a plain, focused sign-in form - the panel collapses to a slim
// header on narrow screens so the form stays front and center.
export default function Login() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logo = settings.logo_url || LOGO;
  const name = settings.line1 || settings.site_name;
  const identity = [settings.line2, settings.line3].filter(Boolean).join(' — ');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: form });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-stage">
      <aside className="login-brand">
        {settings.hero_url && (
          <div className="login-brand-photo" aria-hidden="true">
            <img src={settings.hero_url} alt="" />
          </div>
        )}
        <div className="login-brand-texture" aria-hidden="true" />
        <div className="login-brand-shade" aria-hidden="true" />

        <div className="login-brand-top">
          <span className="login-brand-mark"><img src={logo} alt="" /></span>
          <div>
            <strong className="login-brand-name">{name}</strong>
            {identity && <span className="login-brand-identity">{identity}</span>}
          </div>
        </div>

        <div className="login-brand-mid">
          <h2>مركز الإدارة</h2>
          <p>كل ما يحتاجه الفريق لإدارة المهام والخدمات والمحتوى من مكان واحد.</p>
          <ul className="login-features">
            {FEATURES.map(([Icon, text]) => (
              <li key={text}><Icon size={18} aria-hidden="true" /> {text}</li>
            ))}
          </ul>
        </div>

        <p className="login-brand-foot">© {new Date().getFullYear()} {name}</p>
      </aside>

      <div className="login-center">
        <span className="login-mobile-mark"><img src={logo} alt="" /></span>

        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <p className="login-kicker">مركز الإدارة</p>
            <h1>تسجيل الدخول</h1>
            <p className="hint">أدخل اسم المستخدم وكلمة المرور الخاصة بحسابك.</p>
          </div>

          <label className="field"><span>اسم المستخدم</span>
            <div className="login-input">
              <User size={16} aria-hidden="true" />
              <input
                dir="ltr" autoComplete="username" required autoFocus
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
          </label>

          <label className="field"><span>كلمة المرور</span>
            <div className="login-input">
              <Lock size={16} aria-hidden="true" />
              <input
                dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </label>

          {error && <p className="login-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</p>}

          <button className="btn primary block login-submit" disabled={busy}>
            <LogIn size={17} aria-hidden="true" /> {busy ? 'جارٍ الدخول…' : 'دخول'}
          </button>

          <a className="login-back" href="/"><ArrowLeft size={14} aria-hidden="true" /> العودة إلى الموقع</a>
        </form>

        <p className="login-foot">© {new Date().getFullYear()} {name} — جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
