import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Siren, Image, Users, Package, ClipboardList, HandCoins, Stethoscope, Activity, MessagesSquare, Settings, UserCog, LogOut, ExternalLink, Menu, X, WandSparkles, UserRound, Ruler, Tags, Wrench, Wallet, Truck, Clock, Droplet, Gift, CalendarRange, FileSignature } from 'lucide-react';
import { api, logout } from '../lib/api.js';
import { useSettings } from '../App.jsx';
import { LOGO } from '../lib/brand.js';

// Each item: [path, label, Icon, adminOnly, pageKey]. adminOnly items
// (settings/users) are admin-role-exclusive regardless of permissions.
// Everything else with a pageKey needs that exact page granted (see
// Users.jsx's per-page picker) unless the user is an admin. A null pageKey
// (the dashboard) is always visible to any logged-in user. pageKey matches
// the path's last segment, and must stay in sync with PAGE_GROUPS in
// Users.jsx and the route gating in server/src/routes/admin.js.
const GROUPS = [
  { title: 'الرئيسية', items: [
    ['/admin', 'نظرة عامة', LayoutDashboard, false, null],
  ] },
  { title: 'المحتوى', items: [
    ['/admin/posts', 'المنشورات', FileText, false, 'posts'],
    ['/admin/generator', 'مولّد الصور', WandSparkles, false, 'generator'],
    ['/admin/gallery', 'معرض الصور', Image, false, 'gallery'],
    ['/admin/team', 'الفريق', Users, false, 'team'],
    ['/admin/messages', 'الرسائل', MessagesSquare, false, 'messages'],
  ] },
  { title: 'الميدان', items: [
    ['/admin/mission-types', 'أنواع المهام', Siren, false, 'mission-types'],
    ['/admin/reports', 'التقارير الشهرية', BarChart3, false, 'reports'],
    ['/admin/yearly-report', 'التقرير السنوي', CalendarRange, false, 'yearly-report'],
    ['/admin/member-reports', 'تقارير المسعفين', UserRound, false, 'member-reports'],
    ['/admin/service-types', 'أنواع الخدمات', Stethoscope, false, 'service-types'],
    ['/admin/service-logs', 'سجلّ الخدمات', Activity, false, 'service-logs'],
    ['/admin/schedule', 'جدول المناوبات', Clock, false, 'schedule'],
  ] },
  { title: 'النماذج والمحاضر', items: [
    ['/admin/documents', 'المحاضر والنماذج', FileSignature, false, 'documents'],
  ] },
  { title: 'المخزون', items: [
    ['/admin/inventory', 'المخزون الطبي', Package, false, 'inventory'],
    ['/admin/inventory-assets', 'الأصول الثابتة', Wrench, false, 'inventory-assets'],
    ['/admin/inventory-units', 'وحدات القياس', Ruler, false, 'inventory-units'],
    ['/admin/inventory-categories', 'فئات المخزون', Tags, false, 'inventory-categories'],
    ['/admin/inventory-usage', 'سجلّ الاستخدام', ClipboardList, false, 'inventory-usage'],
    ['/admin/loaned-items', 'العُهد', HandCoins, false, 'loaned-items'],
    ['/admin/inventory-report', 'تقرير المخزون', BarChart3, false, 'inventory-report'],
  ] },
  { title: 'سيارة الإسعاف', items: [
    ['/admin/ambulance-finance', 'الإيرادات والمصروفات', Wallet, false, 'ambulance-finance'],
    ['/admin/ambulance-categories', 'فئات مالية السيارة', Tags, false, 'ambulance-categories'],
    ['/admin/ambulance-assets', 'معدات السيارة', Truck, false, 'ambulance-assets'],
  ] },
  { title: 'الخدمات المجتمعية', items: [
    ['/admin/blood-donations', 'التبرع بالدم', Droplet, false, 'blood-donations'],
    ['/admin/community-donations', 'خدمات عينية', Gift, false, 'community-donations'],
    ['/admin/donation-item-types', 'أصناف الخدمات العينية', Tags, false, 'donation-item-types'],
  ] },
  { title: 'الإدارة', items: [
    ['/admin/settings', 'الإعدادات', Settings, true, null],
    ['/admin/users', 'المستخدمون', UserCog, true, null],
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
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const canSee = ([, , , adminOnly, pageKey]) => isAdmin || (!adminOnly && (!pageKey || permissions.includes(pageKey)));
  const title = TITLES[location.pathname]
    || (location.pathname.startsWith('/admin/posts/') ? 'تحرير منشور'
      : location.pathname.startsWith('/admin/documents/') ? 'تعبئة نموذج'
        : 'مركز الإدارة');

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
            const items = g.items.filter(canSee);
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
        <Outlet context={{ user, isAdmin, permissions }} />
      </section>

      {open && <button type="button" className="admin-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}
    </div>
  );
}
