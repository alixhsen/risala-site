import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, Phone, X, ArrowLeft, MessageCircle, HeartHandshake } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import { useSettings } from '../App.jsx';
import { waLink } from '../lib/links.js';
import { LOGO } from '../lib/brand.js';

// The logo also leads home, and the volunteer button leads to contact, but an
// explicit link makes "back to the home page" obvious in the menu itself.
const NAV = [
  ['/', 'الرئيسية'],
  ['/missions', 'المهام'],
  ['/activities', 'الأنشطة'],
  ['/news', 'الأخبار'],
  ['/team', 'الفريق'],
  ['/gallery', 'المعرض'],
  ['/about', 'من نحن'],
];

const FOOTER_LINKS = [
  ['استكشف', [['/about', 'من نحن'], ['/team', 'الفريق'], ['/gallery', 'معرض الصور']]],
  ['الميدان', [['/missions', 'المهام'], ['/activities', 'الأنشطة'], ['/news', 'الأخبار']]],
];

export default function SiteLayout({ notFound }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Adds a soft shadow to the header once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const location = useLocation();
  const identity = [settings.line2, settings.line3].filter(Boolean).join(' — ');

  // Close the mobile drawer on navigation, and on Escape.
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="site">
      <div className="utility-bar">
        <div className="wrap utility-bar-inner">
          <span className="utility-message"><span className="live-dot" aria-hidden="true" /> في خدمتكم، عند كل نداء</span>
          <div className="utility-bar-links">
            {settings.phone && <a href={`tel:${settings.phone}`}><Phone size={13} aria-hidden="true" /> <bdi>{settings.phone}</bdi></a>}
            {settings.whatsapp && <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={13} aria-hidden="true" /> واتساب</a>}
          </div>
        </div>
      </div>

      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap header-inner">
          <Link to="/" className="brand" aria-label={settings.line1 || 'الصفحة الرئيسية'}>
            <span className="brand-mark"><img src={settings.logo_url || LOGO} alt="" /></span>
            <span className="brand-copy">
              <strong>{settings.line1 || settings.site_name}</strong>
              {settings.line2 && <small className="brand-line2">{settings.line2}</small>}
              {settings.line3 && <small className="brand-line3">{settings.line3}</small>}
            </span>
          </Link>

          <nav className={open ? 'open' : ''} aria-label="التنقل الرئيسي">
            <div className="mobile-nav-head">
              <span>القائمة</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
            </div>
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
            ))}
            {settings.phone && (
              <div className="mobile-nav-actions">
                <a className="call" href={`tel:${settings.phone}`}><Phone size={16} aria-hidden="true" /> اتصال بغرفة العمليات</a>
              </div>
            )}
          </nav>

          <div className="header-actions">
            <Link className="header-volunteer" to="/contact?kind=volunteer"><HeartHandshake size={17} aria-hidden="true" /> تطوّع معنا</Link>
            {settings.phone && (
              <a className="header-emergency" href={`tel:${settings.phone}`}>
                <Phone size={16} aria-hidden="true" /><span>طوارئ</span><bdi>{settings.phone}</bdi>
              </a>
            )}
            <button type="button" className="menu-toggle" aria-label="فتح القائمة" aria-expanded={open} onClick={() => setOpen(!open)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {open && <button type="button" className="nav-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}

      <main>
        {notFound
          ? (
            <section className="wrap section">
              <div className="empty-state">
                <strong>404</strong>
                <h1>الصفحة غير موجودة</h1>
                <p>ربما تغيّر الرابط، أو أن الصفحة لم تعد متاحة.</p>
                <Link className="btn primary" to="/">العودة إلى الرئيسية</Link>
              </div>
            </section>
          )
          : <Outlet />}
      </main>

      <footer className="site-footer">
        <div className="wrap footer-top">
          <div className="footer-brand">
            <img src={settings.logo_url || LOGO} alt="" />
            <div>
              <strong>{settings.line1 || settings.site_name}</strong>
              <p>{identity}</p>
            </div>
          </div>
          <div className="footer-statement">
            <span>رسالتنا</span>
            <p>{settings.tagline || 'الجهوزية، المسؤولية، وخدمة الإنسان.'}</p>
          </div>
        </div>

        <div className="wrap footer-grid">
          {FOOTER_LINKS.map(([title, links]) => (
            <div key={title} className="footer-col">
              <h4>{title}</h4>
              {links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
            </div>
          ))}
          <div className="footer-col">
            <h4>تواصل</h4>
            {settings.phone && <a href={`tel:${settings.phone}`}><bdi>{settings.phone}</bdi></a>}
            {settings.whatsapp && <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer">واتساب</a>}
            <Link to="/contact">نموذج التواصل</Link>
          </div>
          <div className="footer-col">
            <h4>تابعنا</h4>
            <div className="footer-social">
              {settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="إنستغرام"><FaInstagram size={17} aria-hidden="true" /></a>}
              {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="فيسبوك"><FaFacebookF size={16} aria-hidden="true" /></a>}
              {settings.whatsapp_channel && <a href={settings.whatsapp_channel} target="_blank" rel="noreferrer" aria-label="قناة واتساب"><FaWhatsapp size={17} aria-hidden="true" /></a>}
            </div>
          </div>
        </div>

        <div className="wrap footer-bottom">
          <span>© {new Date().getFullYear()} جميع الحقوق محفوظة</span>
          <Link to="/contact">تواصل معنا <ArrowLeft size={14} aria-hidden="true" /></Link>
        </div>
      </footer>
    </div>
  );
}
