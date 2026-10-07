import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSettings } from '../../App.jsx';
import { LOGO } from '../../lib/brand.js';

// Two sides: a form panel, and a panel showing the team's own field photo
// (dark-washed for legibility) with the large logo overlaid on it.
export default function Login() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logo = settings.logo_url || LOGO;
  const name = settings.line1 || settings.site_name;

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
            <div className="login-brand-shade" />
          </div>
        )}
        <span className="login-brand-mark"><img src={logo} alt={name} /></span>
        <strong className="login-brand-name">{name}</strong>
      </aside>

      <div className="login-center">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <h1>تسجيل الدخول</h1>
            <p className="hint">أدخل اسم المستخدم وكلمة المرور الخاصة بحسابك.</p>
          </div>

          <label className="field"><span>اسم المستخدم</span>
            <div className="login-input">
              <User size={16} aria-hidden="true" />
              <input
                dir="ltr" autoComplete="username" required
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

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn primary block" disabled={busy}>
            <LogIn size={17} aria-hidden="true" /> {busy ? 'جارٍ الدخول…' : 'دخول'}
          </button>
        </form>

        <p className="login-foot">© {new Date().getFullYear()} {name}</p>
      </div>
    </div>
  );
}
