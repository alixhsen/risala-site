import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaWhatsapp } from 'react-icons/fa';
import {
  Ambulance, LifeBuoy, Megaphone, Phone, HeartHandshake, Quote, Calendar, ArrowLeft,
  Droplet, MessageCircle, Siren, BarChart3, Users, Newspaper, Camera, HeartPulse,
  PhoneCall, Tag, Users2, ClipboardList, ShieldCheck, Pin,
} from 'lucide-react';
import { useLoad, useSettings } from '../App.jsx';
import PostCard from '../components/PostCard.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import Kicker from '../components/Kicker.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Hero from '../components/Hero.jsx';
import NewsRow from '../components/NewsRow.jsx';
import GalleryTile from '../components/GalleryTile.jsx';
import Lightbox from '../components/Lightbox.jsx';
import useReveal from '../hooks/useReveal.js';
import useCountUp from '../hooks/useCountUp.js';
import { formatDate } from '../lib/api.js';
import { waLink } from '../lib/links.js';
import { LOGO } from '../lib/brand.js';

const SERVICES = [
  [Ambulance, 'إسعاف ونقل المصابين', 'استجابة سريعة وتقييم ميداني، ونقل آمن إلى أقرب مستشفى مجهّز.'],
  [LifeBuoy, 'بحث وإنقاذ', 'رفع الأنقاض وانتشال المصابين، وإخلاء المناطق الخطرة بأمان.'],
  [Megaphone, 'تغطية وتوعية', 'مواكبة المناسبات، ودورات إسعافات أولية وتوعية للأهالي.'],
];

// Centered section header used on every home section: pill kicker, title, optional lead, gold rule.
function SecHead({ icon, kicker, title, lead }) {
  return (
    <div className="sec-head">
      <Kicker icon={icon}>{kicker}</Kicker>
      <h2>{title}</h2>
      {lead && <p className="sec-lead">{lead}</p>}
      <span className="sec-rule" aria-hidden="true" />
    </div>
  );
}

function MoreLink({ to, children }) {
  return (
    <div className="more-link">
      <Link className="btn outline" to={to}>{children} <ArrowLeft size={16} aria-hidden="true" /></Link>
    </div>
  );
}

function ServiceCard({ icon: Icon, title, text, i }) {
  const ref = useReveal();
  return (
    <article ref={ref} className="service-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
      <span className="service-icon"><Icon size={26} aria-hidden="true" /></span>
      <span className="service-num">{String(i + 1).padStart(2, '0')}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ImpactStat({ value, label, Icon, i }) {
  const [ref, display] = useCountUp(value);
  return (
    <article ref={ref} className="impact-stat">
      <span className="impact-icon"><Icon size={22} aria-hidden="true" /></span>
      <strong className="impact-value">{display}</strong>
      <span className="impact-label">{label}</span>
    </article>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const missions = useLoad('/public/posts?category=mission&limit=4', []);
  const activities = useLoad('/public/posts?category=activity&limit=3', []);
  const news = useLoad('/public/posts?category=news&limit=4', []);
  const gallery = useLoad('/public/gallery', []);
  const team = useLoad('/public/team', []);
  const [featured, ...moreMissions] = missions.data;
  const featuredRef = useReveal();
  const quoteRef = useReveal();
  const donateRef = useReveal();
  const channelRef = useReveal();
  const [viewer, setViewer] = useState(null);

  // Only positive figures are shown, so an unset or zero value never appears.
  const stats = [
    [settings.stat_volunteers, 'متطوّع', Users],
    [settings.stat_missions, 'مهمة هذا العام', Siren],
    [settings.stat_vehicles, 'آلية إسعاف وإنقاذ', Ambulance],
    [settings.stat_years, 'سنة في الخدمة', Calendar],
  ].filter(([n]) => Number(n) > 0);

  return (
    <>
      <Hero settings={settings} />

      {/* ================= SERVICES ================= */}
      <section className="section" id="services">
        <div className="wrap">
          <SecHead icon={ClipboardList} kicker="خدماتنا" title="ماذا نقدّم" lead="خدمات ميدانية وطبية، بجاهزية الفريق وتدريبه المستمر." />
          <div className="service-grid">
            {SERVICES.map(([Icon, title, text], i) => <ServiceCard key={title} icon={Icon} title={title} text={text} i={i} />)}
          </div>
        </div>
      </section>

      {/* ================= QUOTE ================= */}
      {settings.hero_quote && (
        <section className="quote-band">
          <div className="wrap section">
            <div ref={quoteRef} className="quote-inner reveal">
              <Quote className="quote-mark" size={44} aria-hidden="true" />
              <p className="quote-text">{settings.hero_quote}</p>
              {settings.hero_quote_author && <p className="quote-author">{settings.hero_quote_author}</p>}
            </div>
          </div>
        </section>
      )}

      {/* ================= LATEST MISSIONS (board) ================= */}
      {featured && (
        <section className="section" id="missions">
          <div className="wrap">
            <div className="section-head">
              <div>
                <Kicker icon={Siren}>آخر العمليات</Kicker>
                <h2>أحدث المهام</h2>
                <p className="section-head-lead">سجلّ حيّ لعمليات الفريق الميدانية، موثّقة بتاريخها ونوعها وفريق الاستجابة فور انتهائها.</p>
              </div>
              <Link to="/missions">كل المهام <ArrowLeft size={15} aria-hidden="true" /></Link>
            </div>

            <div className="mission-board">
              <Link ref={featuredRef} to={`/missions/${featured.id}`} className="mission-lead reveal">
                <div className="mission-lead-media">
                  {featured.cover_url ? <img src={featured.cover_url} alt="" /> : <div className="cover-empty" />}
                  {featured.mission_type_name && (
                    <span className="mission-lead-type">
                      <TypeBadge name={featured.mission_type_name} color={featured.mission_type_color} />
                    </span>
                  )}
                </div>
                <div className="mission-lead-body">
                  <span className="mission-lead-badge">
                    {featured.pinned
                      ? <><Pin size={12} aria-hidden="true" /> مثبّتة</>
                      : <><span className="mission-lead-dot" aria-hidden="true" /> آخر عملية</>}
                  </span>
                  <h3>{featured.title}</h3>
                  {featured.summary && <p>{featured.summary}</p>}
                  <div className="mission-meta">
                    <span><Calendar size={14} aria-hidden="true" /> {formatDate(featured.event_date || featured.published_at)}</span>
                    {featured.paramedic_count > 0 && <span><Users2 size={14} aria-hidden="true" /> {featured.paramedic_count} مشاركين</span>}
                  </div>
                  <span className="mission-go">تفاصيل المهمة <ArrowLeft size={16} aria-hidden="true" /></span>
                </div>
              </Link>

              <div className="mission-list">
                {moreMissions.slice(0, 3).map((m, i) => (
                  <Link key={m.id} to={`/missions/${m.id}`} className="mission-row">
                    <span className="mission-row-num">{String(i + 2).padStart(2, '0')}</span>
                    <span className="mission-row-thumb">
                      {m.cover_url ? <img src={m.cover_url} alt="" loading="lazy" /> : <span className="cover-empty" />}
                    </span>
                    <span className="mission-row-text">
                      <small>{m.mission_type_name || 'مهمة'} · {formatDate(m.event_date || m.published_at)}</small>
                      <strong>{!!m.pinned && <Pin size={13} className="mission-row-pin" aria-hidden="true" />}{m.title}</strong>
                    </span>
                    <ArrowLeft className="mission-row-arrow" size={18} aria-hidden="true" />
                  </Link>
                ))}
                <Link to="/missions" className="mission-all">عرض كل المهام <ArrowLeft size={15} aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= ACTIVITIES ================= */}
      {activities.data.length > 0 && (
        <section className="section soft" id="activities">
          <div className="wrap">
            <SecHead icon={ShieldCheck} kicker="تدريب وتوعية" title="أحدث الأنشطة" lead="دورات ومناورات وفعاليات ميدانية، توثّق جاهزية الفريق المستمرة." />
            <div className="post-grid">
              {activities.data.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
            <MoreLink to="/activities">كل الأنشطة</MoreLink>
          </div>
        </section>
      )}

      {/* ================= STATS ================= */}
      {stats.length > 0 && (
        <section className="impact" id="impact">
          <div className="wrap impact-inner">
            <div className="impact-head">
              <Kicker icon={BarChart3} light>بالأرقام</Kicker>
              <h2>أثرنا الميداني</h2>
              <p>أرقام تعكس حجم العمل الميداني الذي يقوم به الفريق.</p>
            </div>
            <div className="impact-grid">
              {stats.map(([n, label, Icon], i) => <ImpactStat key={label} value={n} label={label} Icon={Icon} i={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ================= TEAM ================= */}
      {team.data.length > 0 && (
        <section className="team-band" id="team">
          <div className="wrap">
            <div className="team-band-head">
              <div>
                <Kicker icon={Users} light>فريق العمل</Kicker>
                <h2>فريقنا</h2>
                <p>الوجوه التي تقف خلف كل استجابة ميدانية وكل مهمة ننجزها.</p>
              </div>
              <div className="team-band-side">
                <span className="team-band-count">{team.data.length} عضو</span>
                <Link className="btn ghost-dark" to="/team">عرض الفريق كاملاً <ArrowLeft size={16} aria-hidden="true" /></Link>
              </div>
            </div>
            <div className="team-band-grid">
              {team.data.map((m, i) => <TeamCard key={m.id} member={m} i={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ================= NEWS ================= */}
      {news.data.length > 0 && (
        <section className="section" id="news">
          <div className="wrap">
            <SecHead icon={Newspaper} kicker="آخر المستجدات" title="الأخبار والإعلانات" />
            <div className="news-list">
              {news.data.map((p, i) => <NewsRow key={p.id} post={p} i={i} />)}
            </div>
            <MoreLink to="/news">كل الأخبار</MoreLink>
          </div>
        </section>
      )}

      {/* ================= GALLERY ================= */}
      {gallery.data.length > 0 && (
        <section className="section soft" id="gallery">
          <div className="wrap">
            <div className="gallery-head">
              <div>
                <Kicker icon={Camera}>لقطات من الميدان</Kicker>
                <h2>معرض الصور</h2>
              </div>
              <Link className="btn outline" to="/gallery">كل الصور <ArrowLeft size={16} aria-hidden="true" /></Link>
            </div>
            <div className="gallery-grid">
              {gallery.data.slice(0, 6).map((g, i) => (
                <GalleryTile key={g.id} photo={g} i={i} large={i === 0} onOpen={setViewer} />
              ))}
            </div>
          </div>
          <Lightbox items={gallery.data} index={viewer} onClose={() => setViewer(null)} onChange={setViewer} />
        </section>
      )}

      {/* ================= DONATE ================= */}
      {settings.donate_url && (
        <section className="section">
          <div className="wrap">
            <div ref={donateRef} className="donate reveal">
              <span className="donate-icon"><Droplet size={36} aria-hidden="true" /></span>
              <div>
                <Kicker icon={HeartPulse}>تبرّع بالدم</Kicker>
                <h2>ساهم، تبرّع، أنقذ حياة</h2>
                <p>منصّة Risala Donate التابعة لفرقتنا تتيح لك البحث عن متبرعين متوافقين أو التسجيل كمتبرع بسهولة.</p>
              </div>
              <div className="actions">
                <a className="btn primary" href={settings.donate_url} target="_blank" rel="noreferrer">
                  الدخول إلى منصة التبرع <ArrowLeft size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= WHATSAPP CHANNEL ================= */}
      {settings.whatsapp_channel && (
        <section className="section">
          <div className="wrap">
            <div ref={channelRef} className="donate channel reveal">
              <span className="donate-icon channel-icon"><FaWhatsapp size={38} aria-hidden="true" /></span>
              <div>
                <Kicker icon={MessageCircle}>قناتنا على واتساب</Kicker>
                <h2>تابعنا على القناة</h2>
                <p>آخر الأخبار والإعلانات والمهام مباشرة على هاتفك، بدون أن تفوّتك أي مستجدّات.</p>
              </div>
              <div className="actions">
                <a className="btn primary" href={settings.whatsapp_channel} target="_blank" rel="noreferrer">
                  انضم إلى القناة <ArrowLeft size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= EMERGENCY ================= */}
      <section className="emergency">
        <div className="wrap emergency-inner">
          <div>
            <Kicker icon={PhoneCall} light>تواصل معنا</Kicker>
            <h2>بحاجة للمساعدة الآن؟</h2>
            <p>للحالات الطارئة اتصل مباشرة على مدار الساعة. لأي استفسار آخر، نحن هنا للمساعدة.</p>
          </div>
          <div className="actions">
            {settings.phone && <a className="btn hi" href={`tel:${settings.phone}`}><Phone size={16} aria-hidden="true" /> <bdi>{settings.phone}</bdi></a>}
            {settings.whatsapp && <a className="btn ghost-dark" href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> واتساب</a>}
            <Link className="btn ghost-dark" to="/contact">نموذج التواصل <ArrowLeft size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
