import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Siren, Image, Users, Package, ClipboardList, HandCoins, Stethoscope, Activity, MessagesSquare, Settings, UserCog, LogOut, ExternalLink, Menu, X, WandSparkles, UserRound } from 'lucide-react';
import { api, logout } from '../lib/api.js';
import { useSettings } from '../App.jsx';
import { LOGO } from '../lib/brand.js';

const GROUPS = [
  { title: 'الرئيسية', items: [
    ['/admin', 'نظرة عامة', LayoutDashboard, false],
  ] },
  { title: 'المحتوى', items: [
    ['/admin/posts', 'المنشورات', FileText, false],
    ['/admin/generator', 'مولّد الصور', WandSparkles, false],
    ['/admin/gallery', 'معرض الصور', Image, true],
    ['/admin/team', 'الفريق', Users, true],
    ['/admin/messages', 'الرسائل', MessagesSquare, true],
  ] },
  { title: 'الميدان', items: [
    ['/admin/mission-types', 'أنواع المهام', Siren, true],
    ['/admin/reports', 'التقارير الشهرية', BarChart3, true],
    ['/admin/member-reports', 'تقارير المسعفين', UserRound, true],
    ['/admin/service-types', 'أنواع الخدمات', Stethoscope, true],
    ['/admin/service-logs', 'سجلّ الخدمات', Activity, true],
  ] },
  { title: 'المخزون', items: [
    ['/admin/inventory', 'المخزون الطبي', Package, true],
    ['/admin/inventory-usage', 'سجلّ الاستخدام', ClipboardList, true],
    ['/admin/loaned-items', 'العُهد', HandCoins, true],
    ['/admin/inventory-report', 'تقرير المخزون', BarChart3, true],
  ] },
  { title: 'الإدارة', items: [
    ['/admin/settings', 'الإعدادات', Settings, true],
    ['/admin/users', 'المستخدمون', UserCog, true],
  ] },
];

const TITLES = Object.fromEntries(GROUPS.flatMap((g) => g.items.map(([to, label]) => [to, label])));
TITLES['/admin/posts/new'] = 'منشور جديد';
TITLES['/admin/generator'] = 'مولّد الصور';

export const useAdmin = () => useOutletContext();

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => navigate('/admin/login', { replace: true }));
  }, [navigate]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (!user) return <div className="admin-loading"><span className="loader" /> جارٍ التحميل…</div>;
  const isAdmin = user.role === 'admin';
  const title = TITLES[location.pathname] || (location.pathname.startsWith('/admin/posts/') ? 'تحرير منشور' : 'مركز الإدارة');

  return (
    <div className="admin">
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <div className="admin-side-head">
          <span className="admin-logo"><img src={settings.logo_url || LOGO} alt="" /></span>
          <div>
            <span className="admin-kicker">{settings.line1 || 'مركز الإدارة'}</span>
            <div className="admin-title">لوحة التحكم</div>
          </div>
          <button type="button" className="admin-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} aria-hidden="true" /></button>
        </div>

        <nav className="admin-nav" aria-label="قائمة الإدارة">
          {GROUPS.map((g) => {
            const items = g.items.filter(([, , , adminOnly]) => isAdmin || !adminOnly);
            if (items.length === 0) return null;
            return (
              <div key={g.title} className="admin-nav-group">
                <p className="admin-nav-title">{g.title}</p>
                {items.map(([to, label, Icon]) => (
                  <NavLink key={to} to={to} end={to === '/admin'}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="admin-user">
          <div className="admin-avatar">{user.display_name?.trim()?.charAt(0)}</div>
          <span>
            {user.display_name}
            <small>{isAdmin ? 'مدير النظام' : 'محرّر'}</small>
          </span>
          <div className="admin-user-actions">
            <a href="/" target="_blank" rel="noreferrer" title="عرض الموقع"><ExternalLink size={17} aria-hidden="true" /></a>
            <button type="button" title="تسجيل الخروج" onClick={async () => { await logout(); navigate('/admin/login'); }}><LogOut size={17} aria-hidden="true" /></button>
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <div className="admin-mobilebar">
          <button type="button" onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu size={20} aria-hidden="true" /></button>
          <strong>{title}</strong>
        </div>
        <div className="admin-topbar">
          <nav className="admin-crumbs" aria-label="المسار">
            <span>الإدارة</span>
            <span aria-hidden="true">/</span>
            <strong>{title}</strong>
          </nav>
        </div>
        <Outlet context={{ user, isAdmin }} />
      </section>

      {open && <button type="button" className="admin-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}
    </div>
  );
}
