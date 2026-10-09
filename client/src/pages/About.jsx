import { Link } from 'react-router-dom';
import { Info, Users, Siren, Camera, HeartHandshake, Phone, Landmark, Target, Eye, Ambulance, Flame, LifeBuoy, Megaphone, Droplet, HeartPulse, ShieldCheck, Stethoscope, MapPin } from 'lucide-react';
import { useLoad, useSettings } from '../App.jsx';
import Kicker from '../components/Kicker.jsx';
import PageHeader from '../components/PageHeader.jsx';
import useReveal from '../hooks/useReveal.js';
import useCountUp from '../hooks/useCountUp.js';
import { LOGO } from '../lib/brand.js';
import * as C from '../data/institution.js';

const hasSetting = (v) => v !== undefined && v !== null && v !== '';
const FIELD_ICONS = [Ambulance, LifeBuoy, Flame, Megaphone, Ambulance, Droplet, HeartPulse, ShieldCheck, Megaphone, Stethoscope];
const SECTIONS = [
  ['about', 'عن الجمعية'],
  ['history', 'تاريخنا'],
  ['mission', 'رسالتنا ورؤيتنا'],
  ['values', 'قيمنا'],
  ['fields', 'مجالات عملنا'],
  ['martyrs', 'شهداؤنا'],
  ['volunteer', 'التطوع'],
];

function Stat({ value, label, i }) {
  const [ref, display] = useCountUp(value);
  return (
    <div ref={ref} className="stat">
      <strong>{display}</strong>
      <span>{label}</span>
    </div>
  );
}

function TimelineStep({ title, text, i }) {
  const ref = useReveal();
  return (
    <li ref={ref} className="about-step reveal" style={{ transitionDelay: `${Math.min(i, 8) * 80}ms` }}>
      <span className="about-step-dot" aria-hidden="true" />
      <strong className="about-step-year">{title}</strong>
      <p>{text}</p>
    </li>
  );
}

function FieldCard({ title, text, Icon, i }) {
  const ref = useReveal();
  return (
    <article ref={ref} className="about-field reveal" style={{ transitionDelay: `${Math.min(i, 8) * 60}ms` }}>
      <span className="about-field-icon"><Icon size={22} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export default function About() {
  const { settings } = useSettings();
  const team = useLoad('/public/team', []);
  const missions = useLoad('/public/posts?category=mission&limit=60', []);
  const gallery = useLoad('/public/gallery', []);
  const introRef = useReveal();

  const identity = [settings.line1, settings.line2, settings.line3].filter(Boolean);
  const stats = [
    [hasSetting(settings.stat_volunteers) ? settings.stat_volunteers : team.data.length, 'عضو في الفريق'],
    [hasSetting(settings.stat_missions) ? settings.stat_missions : missions.data.length, 'مهمة موثّقة'],
    [hasSetting(settings.stat_vehicles) ? settings.stat_vehicles : null, 'آلية'],
    [hasSetting(settings.stat_years) ? settings.stat_years : null, 'سنة في الخدمة'],
    [gallery.data.length || null, 'صورة في المعرض'],
  ].filter(([v]) => v !== null && v !== undefined);

  return (
    <>
      <PageHeader
        icon={Info}
        kicker={C.ORG.licence}
        title={C.ORG.nameAr}
        lead="جمعية أهلية صحية تطوعية لبنانية، تعمل في الإسعاف والطوارئ والإنقاذ والإطفاء والاستجابة للكوارث."
      />

      <nav className="about-nav wrap" aria-label="أقسام الصفحة">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>{label}</a>
        ))}
      </nav>

      <section className="section tight" id="about">
        <div className="wrap about-intro">
          <div ref={introRef} className="about-intro-text reveal">
            <div className="about-identity">
              <span className="about-logo"><img src={settings.logo_url || LOGO} alt="" /></span>
              <div>
                {identity.map((line, i) => (
                  <p key={line} className={i === 0 ? 'about-identity-name' : 'about-identity-line'}>{line}</p>
                ))}
              </div>
            </div>
            {C.ABOUT_INTRO.map((p, i) => (
              <p key={i} className={i === 0 ? 'about-lead' : 'about-body'}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="section tight">
          <div className="wrap">
            <div className="stats-grid about-stats">
              {stats.map(([value, label], i) => <Stat key={label} value={value} label={label} i={i} />)}
            </div>
            <p className="about-data-note">الأرقام محسوبة من بيانات الموقع الفعلية.</p>
          </div>
        </section>
      )}

      <section className="section" id="history">
        <div className="wrap about-cols">
          <div className="about-cols-head">
            <Kicker icon={Landmark}>نبذة تاريخية</Kicker>
            <h2>تأسست انطلاقاً من حاجة إنسانية</h2>
          </div>
          <div className="about-cols-body">
            {C.HISTORY.map((p, i) => <p key={i} className="about-body">{p}</p>)}
          </div>
        </div>

        <div className="wrap about-cols about-cols-roots">
          <div className="about-cols-head">
            <Kicker icon={Users}>الجذور والنهج</Kicker>
            <h2>منطلقاتنا</h2>
          </div>
          <div className="about-cols-body">
            {C.ROOTS.map((p, i) => <p key={i} className="about-body">{p}</p>)}
          </div>
        </div>

        <div className="wrap">
          <div className="section-head about-timeline-head">
            <div>
              <Kicker icon={Siren}>مسيرتنا</Kicker>
              <h2>محطات أساسية</h2>
            </div>
          </div>
          <ol className="about-timeline about-timeline-grid">
            {C.TIMELINE.map(([title, text], i) => <TimelineStep key={title} title={title} text={text} i={i} />)}
          </ol>
        </div>

        <div className="wrap about-feature-pair">
          <article className="about-callout">
            <Kicker icon={Siren}>محطة وطنية</Kicker>
            <h3>في قلب كارثة مرفأ بيروت</h3>
            {C.PORT.map((p, i) => <p key={i}>{p}</p>)}
          </article>
          <article className="about-callout">
            <Kicker icon={HeartPulse}>جائحة كورونا</Kicker>
            <h3>خط استجابة ميداني</h3>
            <p>{C.COVID}</p>
          </article>
        </div>
      </section>

      <section className="section soft" id="mission">
        <div className="wrap">
          <div className="section-head">
            <div>
              <Kicker icon={Target}>الرسالة والرؤية</Kicker>
              <h2>ما نسعى إليه</h2>
            </div>
          </div>
          <div className="about-mv">
            <article className="about-mv-card">
              <span className="about-mv-icon"><Target size={24} aria-hidden="true" /></span>
              <h3>رسالتنا</h3>
              <p>{C.MISSION}</p>
            </article>
            <article className="about-mv-card">
              <span className="about-mv-icon"><Eye size={24} aria-hidden="true" /></span>
              <h3>رؤيتنا</h3>
              <p>{C.VISION}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="values">
        <div className="wrap">
          <div className="section-head">
            <div>
              <Kicker icon={ShieldCheck}>القيم</Kicker>
              <h2>ما يحكم عملنا</h2>
            </div>
          </div>
          <ol className="about-values">
            {C.VALUES.map(([title, text], i) => (
              <li key={title} className="about-value">
                <span className="about-value-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section soft" id="fields">
        <div className="wrap">
          <div className="section-head">
            <div>
              <Kicker icon={Ambulance}>مجالات العمل</Kicker>
              <h2>ما نقدّمه في الميدان</h2>
            </div>
            <Link className="about-link" to="/missions">سجلّ المهام <Siren size={15} aria-hidden="true" /></Link>
          </div>
          <div className="about-fields">
            {C.FIELDS.map(([title, text], i) => <FieldCard key={title} title={title} text={text} Icon={FIELD_ICONS[i] || Ambulance} i={i} />)}
          </div>
          <p className="about-partners">{C.PARTNERS}</p>
        </div>
      </section>

      <section className="about-memorial" id="martyrs">
        <div className="wrap about-memorial-inner">
          <div>
            <Kicker icon={HeartHandshake} light>شهداؤنا</Kicker>
            <h2>ذاكرة الواجب الإنساني</h2>
            <p>{C.MARTYRS}</p>
          </div>
          <p className="about-memorial-note">
            <MapPin size={15} aria-hidden="true" /> أرشيف الشهداء الرسمي، بأسمائهم وصورهم وسيرهم، قيد الإعداد من الجمعية.
          </p>
        </div>
      </section>

      <section className="section" id="volunteer">
        <div className="wrap about-volunteer">
          <div>
            <Kicker icon={Users}>كن متطوعاً</Kicker>
            <h2>المتطوع هو أساس الجمعية</h2>
            <p>{C.VOLUNTEER}</p>
          </div>
          <div className="about-cta-actions">
            <Link className="btn primary" to="/contact?kind=volunteer"><HeartHandshake size={16} aria-hidden="true" /> انضم إلى متطوعي الرسالة</Link>
            <Link className="btn outline" to="/team"><Users size={16} aria-hidden="true" /> الفريق</Link>
            <Link className="btn gray" to="/gallery"><Camera size={16} aria-hidden="true" /> المعرض</Link>
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="wrap about-cta-inner">
          <div>
            <Kicker icon={Siren} light>للطوارئ</Kicker>
            <h2>بحاجة إلى مساعدة الآن؟</h2>
            <p>للحالات الطارئة اتصل مباشرة. لأي استفسار آخر، أرسل لنا رسالتك.</p>
          </div>
          <div className="about-cta-actions">
            {settings.phone && <a className="btn hi" href={`tel:${settings.phone}`}><Phone size={16} aria-hidden="true" /> <bdi>{settings.phone}</bdi></a>}
            <Link className="btn ghost-dark" to="/contact"><Megaphone size={16} aria-hidden="true" /> تواصل معنا</Link>
          </div>
        </div>
      </section>
    </>
  );
}
