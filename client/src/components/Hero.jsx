import { Link } from 'react-router-dom';
import { ArrowLeft, HeartHandshake, Phone, Siren, Activity, Newspaper, Camera } from 'lucide-react';
import { LOGO } from '../lib/brand.js';

const LINKS = [
  ['/missions', 'المهام', Siren],
  ['/activities', 'الأنشطة', Activity],
  ['/news', 'الأخبار', Newspaper],
  ['/gallery', 'المعرض', Camera],
];

// Hero: a focused text column beside the team photo shown in full (never
// cropped or shaded - some members were lost under a background treatment in
// an earlier version). A status badge floats on the photo's corner, and a
// row of quick-link chips gives one-tap access to the main sections.
export default function Hero({ settings }) {
  const name = settings.line1 || settings.site_name;
  // The center name (line2) and the team name (line3) each get their own row
  // instead of being squeezed onto one line - that way neither ever has to be
  // dropped to fit a phone screen; each just truncates on its own if needed.
  const eyebrowLines = [settings.line2, settings.line3].filter(Boolean);

  return (
    <section className="hero" id="home">
      <div className="wrap hv">
        <div className="hv-text">
          <p className="hv-eyebrow">
            <span className="hv-eyebrow-mark"><img src={settings.logo_url || LOGO} alt="" /></span>
            <span className="hv-eyebrow-lines">
              {eyebrowLines.length > 0
                ? eyebrowLines.map((line) => <span key={line} className="hv-eyebrow-line">{line}</span>)
                : <span className="hv-eyebrow-line">{name}</span>}
            </span>
          </p>

          <h1>
            رسالتنا خدمة الإنسان
            <span>جاهزيةٌ دائمة، عطاءٌ مستمر، ومسؤولية</span>
          </h1>

          <p className="hv-lead">
            المنصة الرسمية لمتابعة مهامنا وأنشطتنا وأخبارنا، والتواصل المباشر مع الفريق.
          </p>

          <div className="hv-actions">
            <a className="btn primary" href="#services">خدماتنا <ArrowLeft size={16} aria-hidden="true" /></a>
            <Link className="btn outline" to="/contact?kind=volunteer">
              <HeartHandshake size={16} aria-hidden="true" /> تطوّع معنا
            </Link>
          </div>

          <nav className="hv-links" aria-label="روابط سريعة">
            {LINKS.map(([to, label, Icon]) => (
              <Link key={to} to={to} className="hv-link-chip">
                <Icon size={15} aria-hidden="true" /> {label}
              </Link>
            ))}
          </nav>

          {settings.phone && (
            <a className="hv-phone" href={`tel:${settings.phone}`}>
              <span className="hv-phone-icon"><Phone size={18} aria-hidden="true" /></span>
              <span className="hv-phone-text">
                <small>الطوارئ على مدار الساعة</small>
                <bdi>{settings.phone}</bdi>
              </span>
            </a>
          )}
        </div>

        <figure className="hv-figure">
          <div className="hv-frame">
            <div className={`hv-photo${settings.hero_url ? '' : ' fallback'}`}>
              {settings.hero_url && <img src={settings.hero_url} alt={`فريق ${name} في الميدان`} />}
            </div>
          </div>
          <div className="hv-live">
            <span className="hv-live-dot" aria-hidden="true" />
            <strong>24/7</strong>
            <span>جاهزية دائمة</span>
          </div>
        </figure>
      </div>
    </section>
  );
}
