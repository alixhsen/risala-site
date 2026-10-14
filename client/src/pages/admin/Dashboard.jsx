import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Siren, Activity, Stethoscope, Users, FileText, Mail, Package, HandCoins, WandSparkles, Newspaper, ArrowLeft, Clock, Droplet, Gift } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { loadYear, sumTypes } from '../../lib/monthly.js';
import { ColumnChart, Donut, HBars, colorAt } from '../../components/charts.jsx';
import { MONTHS_AR } from '../../lib/api.js';

const SHORT_MONTHS = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'];

export default function Dashboard() {
  const { user, isAdmin } = useAdmin();
  const stats = useLoad('/admin/stats', {});
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [series, setSeries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setSeries(null);
    setError('');
    loadYear(year)
      .then((d) => alive && setSeries(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [year]);

  const yearOptions = [0, 1, 2, 3, 4].map((i) => now.getFullYear() - i);
  const focusIndex = year === now.getFullYear() ? now.getMonth() : 11;

  const view = useMemo(() => {
    if (!series) return null;
    const focus = series[focusIndex];
    const missionsYear = series.reduce((s, m) => s + m.missionsTotal, 0);
    const servicesYear = series.reduce((s, m) => s + m.servicesTotal, 0);
    const bloodDonationsYear = series.reduce((s, m) => s + m.bloodDonationsTotal, 0);
    const communityDonationsYear = series.reduce((s, m) => s + m.communityDonationsTotal, 0);
    const people = new Map();
    for (const m of series) {
      for (const p of m.paramedics) {
        const row = people.get(p.id) || { name: p.name, missions: 0, services: 0 };
        row.missions += p.count;
        people.set(p.id, row);
      }
      for (const p of m.serviceParamedics) {
        const row = people.get(p.id) || { name: p.name, missions: 0, services: 0 };
        row.services += p.count;
        people.set(p.id, row);
      }
    }
    const top = [...people.values()].sort((a, b) => (b.missions + b.services) - (a.missions + a.services)).slice(0, 6);
    return {
      focus,
      missionsYear,
      servicesYear,
      bloodDonationsYear,
      communityDonationsYear,
      activePeople: people.size,
      types: Object.entries(sumTypes(series, 'typeCounts')).sort((a, b) => b[1] - a[1]),
      monthlyMissions: series.map((m, i) => ({ label: SHORT_MONTHS[i], value: m.missionsTotal })),
      monthlyServices: series.map((m, i) => ({ label: SHORT_MONTHS[i], value: m.servicesTotal })),
      top: top.map((p) => ({ label: p.name, value: p.missions + p.services })),
    };
  }, [series, focusIndex]);

  const kpis = view ? [
    { label: 'مهام السنة', value: view.missionsYear, sub: `${year}`, Icon: Siren, tone: 'brand' },
    { label: `مهام ${MONTHS_AR[focusIndex]}`, value: view.focus.missionsTotal, sub: 'الشهر المختار', Icon: Activity, tone: 'gold' },
    { label: 'الخدمات الطبية', value: view.servicesYear, sub: `خلال ${year}`, Icon: Stethoscope, tone: 'brand' },
    { label: 'مسعفون نشطون', value: view.activePeople, sub: `شاركوا في ${year}`, Icon: Users, tone: 'gold' },
    { label: 'التبرع بالدم', value: view.bloodDonationsYear, sub: `خلال ${year}`, Icon: Droplet, tone: 'brand' },
    { label: 'الخدمات العينية', value: view.communityDonationsYear, sub: `خلال ${year}`, Icon: Gift, tone: 'gold' },
  ] : null;

  const alerts = [
    { label: 'منشورات بانتظار الموافقة', value: stats.data.pending, to: '/admin/posts', Icon: FileText },
    { label: 'رسائل غير مقروءة', value: stats.data.unread, to: '/admin/messages', Icon: Mail },
    { label: 'مواد قاربت الانتهاء', value: stats.data.expiringSoon, to: '/admin/inventory', Icon: Package },
    { label: 'عهد لم تُعَد بعد', value: stats.data.itemsOnLoan, to: '/admin/loaned-items', Icon: HandCoins },
  ];

  return (
    <>
      <header className="dash-head">
        <div>
          <p className="dash-kicker">مركز الإدارة</p>
          <h1>أهلاً، {user.display_name}</h1>
          <p className="dash-sub">
            <Clock size={14} aria-hidden="true" /> {MONTHS_AR[now.getMonth()]} {now.getFullYear()} · {isAdmin ? 'مدير النظام' : 'محرّر'}
          </p>
        </div>
        <label className="dash-year">
          <span>السنة</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="kpi-grid">
        {(kpis || Array.from({ length: 6 })).map((k, i) => (
          <article key={i} className={`kpi kpi-${k?.tone || 'brand'}`}>
            {k ? (
              <>
                <span className="kpi-icon"><k.Icon size={20} aria-hidden="true" /></span>
                <span className="kpi-label">{k.label}</span>
                <strong className="kpi-value">{k.value}</strong>
                <span className="kpi-sub">{k.sub}</span>
              </>
            ) : <span className="kpi-loading" />}
          </article>
        ))}
      </div>

      <div className="dash-grid dash-grid-main">
        <section className="panel panel-wide">
          <header className="panel-head">
            <div>
              <h2>المهام الشهرية</h2>
              <p>عدد المهام المنفّذة في كل شهر من {year}</p>
            </div>
            <Link to="/admin/reports" className="panel-link">التقرير الشهري <ArrowLeft size={14} aria-hidden="true" /></Link>
          </header>
          {view ? <ColumnChart data={view.monthlyMissions} ariaLabel={`المهام الشهرية ${year}`} /> : <div className="chart-loading" />}
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>المهام حسب النوع</h2>
              <p>توزيع مهام {year}</p>
            </div>
          </header>
          {view
            ? <Donut slices={view.types.slice(0, 6).map(([label, value], i) => ({ label, value, color: colorAt(i) }))} centerLabel="مهمة" centerValue={view.missionsYear} />
            : <div className="chart-loading" />}
        </section>
      </div>

      <div className="dash-grid dash-grid-2">
        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>الخدمات الطبية شهرياً</h2>
              <p>تغطية {year} حسب الشهر</p>
            </div>
            <Link to="/admin/service-logs" className="panel-link">السجل <ArrowLeft size={14} aria-hidden="true" /></Link>
          </header>
          {view ? <ColumnChart data={view.monthlyServices} height={220} ariaLabel={`الخدمات الشهرية ${year}`} /> : <div className="chart-loading" />}
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>الأكثر مشاركةً</h2>
              <p>مهام وخدمات المسعفين في {year}</p>
            </div>
            <Link to="/admin/reports" className="panel-link">التفاصيل <ArrowLeft size={14} aria-hidden="true" /></Link>
          </header>
          {view ? <HBars rows={view.top} empty="لا مشاركات مسجّلة بعد." /> : <div className="chart-loading" />}
        </section>
      </div>

      <div className="dash-grid dash-grid-3">
        <section className="panel">
          <header className="panel-head"><div><h2>يحتاج متابعة</h2><p>عناصر تنتظر إجراءً</p></div></header>
          <ul className="alert-list">
            {alerts.map(({ label, value, to, Icon }) => (
              <li key={label}>
                <Link to={to}>
                  <span className="alert-icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="alert-label">{label}</span>
                  <strong>{value ?? '–'}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><div><h2>إجراءات سريعة</h2><p>إنشاء محتوى جديد</p></div></header>
          <div className="quick-actions">
            <Link to="/admin/posts/new?category=mission"><Siren size={18} aria-hidden="true" /> مهمة جديدة</Link>
            <Link to="/admin/posts/new?category=activity"><Activity size={18} aria-hidden="true" /> نشاط جديد</Link>
            <Link to="/admin/posts/new?category=news"><Newspaper size={18} aria-hidden="true" /> خبر جديد</Link>
            <Link to="/admin/generator"><WandSparkles size={18} aria-hidden="true" /> مولّد الصور</Link>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>الشهر المختار</h2>
              <p>{MONTHS_AR[focusIndex]} {year}</p>
            </div>
          </header>
          {view ? (
            <dl className="focus-facts">
              <div><dt>المهام</dt><dd>{view.focus.missionsTotal}</dd></div>
              <div><dt>المسعفون</dt><dd>{view.focus.paramedics.length}</dd></div>
              <div><dt>الخدمات</dt><dd>{view.focus.servicesTotal}</dd></div>
              <div><dt>التبرع بالدم</dt><dd>{view.focus.bloodDonationsTotal}</dd></div>
              <div><dt>الخدمات العينية</dt><dd>{view.focus.communityDonationsTotal}</dd></div>
            </dl>
          ) : <div className="chart-loading" />}
          <Link className="btn primary block" to={`/admin/reports?year=${year}&month=${focusIndex + 1}`}>
            <FileText size={16} aria-hidden="true" /> تقرير الشهر وتحميل PDF
          </Link>
        </section>
      </div>
    </>
  );
}
