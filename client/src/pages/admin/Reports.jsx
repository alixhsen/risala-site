import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Download, Siren, Stethoscope, Users, Activity, Share2, FileSpreadsheet } from 'lucide-react';
import { toCsv, downloadCsv } from '../../lib/csv.js';
import { generateSocialReport } from '../../lib/socialReport.js';
import { useSettings } from '../../App.jsx';
import { api, MONTHS_AR, formatDate } from '../../lib/api.js';
import { loadMonth } from '../../lib/monthly.js';
import { generateMonthlyPdf } from '../../lib/monthlyPdf.js';
import { Donut, HBars, colorAt } from '../../components/charts.jsx';

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

export default function Reports() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [year, setYear] = useState(Number(params.get('year')) || now.getFullYear());
  const [month, setMonth] = useState(Number(params.get('month')) || now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    loadMonth(year, month)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    setParams({ year, month }, { replace: true });
    return () => { alive = false; };
  }, [year, month, setParams]);

  async function shareImage() {
    if (!data) return;
    setBusy(true);
    try {
      // Photos chosen in Settings, in the order picked; otherwise the team photo then the gallery
      let chosen = [];
      try { chosen = JSON.parse(settings.report_photos || '[]'); } catch { chosen = []; }
      let urls;
      if (Array.isArray(chosen) && chosen.length) {
        urls = chosen;
      } else {
        const gallery = await api('/public/gallery').catch(() => []);
        urls = [settings.hero_url, ...gallery.map((g) => g.url)];
      }
      await generateSocialReport({ settings, data, photoUrls: [...new Set(urls.filter(Boolean))].slice(0, 9) });
    } catch (e) {
      setError(e.message || 'تعذّر إنشاء الصورة');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!data) return;
    setBusy(true);
    try {
      await generateMonthlyPdf({ settings, data });
    } catch (e) {
      setError(e.message || 'تعذّر إنشاء الملف');
    } finally {
      setBusy(false);
    }
  }

  // Monthly CSV files: one row per member (missions and service quantities),
  // and one row per mission with the members who took part.
  function exportMembersCsv() {
    const byId = new Map();
    for (const p of data.paramedics) byId.set(p.id, { name: p.name, group: p.group_name, missions: p.missions.length, services: 0 });
    for (const s of data.serviceParamedics) {
      const row = byId.get(s.id) || { name: s.name, group: s.group_name, missions: 0, services: 0 };
      row.services = s.services.reduce((n, x) => n + (x.quantity || 1), 0);
      byId.set(s.id, row);
    }
    const rows = [...byId.values()].sort((a, b) => (b.missions + b.services) - (a.missions + a.services) || a.name.localeCompare(b.name, 'ar'));
    const columns = [
      { label: 'المسعف', value: 'name' },
      { label: 'المجموعة', value: 'group' },
      { label: 'عدد المهام', value: 'missions' },
      { label: 'الخدمات الطبية (الكمية)', value: 'services' },
    ];
    downloadCsv(`المسعفون-${MONTHS_AR[month - 1]}-${year}`, toCsv(columns, rows));
  }

  function exportMissionsCsv() {
    const rows = data.paramedics
      .flatMap((p) => p.missions.map((m) => ({ ...m, member: p.name, group: p.group_name })))
      .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
    const columns = [
      { label: 'التاريخ', value: (r) => formatDate(r.event_date) },
      { label: 'المهمة', value: 'title' },
      { label: 'نوع المهمة', value: 'type_name' },
      { label: 'المسعف', value: 'member' },
      { label: 'المجموعة', value: 'group' },
    ];
    downloadCsv(`المهام-${MONTHS_AR[month - 1]}-${year}`, toCsv(columns, rows));
  }

  const typeSlices = data
    ? Object.entries(data.typeCounts).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: colorAt(i) }))
    : [];
  const topMissions = data ? [...data.paramedics].sort((a, b) => b.count - a.count).slice(0, 8).map((p) => ({ label: p.name, value: p.count })) : [];
  const topServices = data ? [...data.serviceParamedics].sort((a, b) => b.count - a.count).slice(0, 8).map((p) => ({ label: p.name, value: p.count })) : [];

  return (
    <>
      <header className="page-head rep-head">
        <div>
          <p className="dash-kicker">التقارير</p>
          <h1>التقرير الشهري</h1>
          <p className="dash-sub">المهام والخدمات الطبية التي سُجّلت خلال الشهر المختار، لكل مسعف.</p>
        </div>
        <div className="rep-tools">
          <label className="field"><span>الشهر</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label className="field"><span>السنة</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={downloadPdf} disabled={!data || busy}>
            <Download size={16} aria-hidden="true" /> {busy ? 'جارٍ إنشاء الملف…' : 'تحميل PDF'}
          </button>
          <button type="button" className="btn outline" onClick={shareImage} disabled={!data}>
            <Share2 size={16} aria-hidden="true" /> صورة للمشاركة
          </button>
          <button type="button" className="btn outline" onClick={exportMembersCsv} disabled={!data}>
            <FileSpreadsheet size={16} aria-hidden="true" /> CSV المسعفين
          </button>
          <button type="button" className="btn outline" onClick={exportMissionsCsv} disabled={!data}>
            <FileSpreadsheet size={16} aria-hidden="true" /> CSV المهام
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="kpi-grid kpi-4">
        {[
          [Siren, 'مهام منفّذة', data?.missionsTotal, 'brand'],
          [Users, 'مسعفون مشاركون', data?.paramedics.length, 'gold'],
          [Stethoscope, 'خدمات طبية', data?.servicesTotal, 'brand'],
          [Activity, 'أنواع المهام', data ? Object.keys(data.typeCounts).length : undefined, 'gold'],
        ].map(([Icon, label, value, tone]) => (
          <article key={label} className={`kpi kpi-${tone}`}>
            <span className="kpi-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value ?? '–'}</strong>
            <span className="kpi-sub">{MONTHS_AR[month - 1]} {year}</span>
          </article>
        ))}
      </div>

      <div className="dash-grid dash-grid-2">
        <section className="panel">
          <header className="panel-head"><div><h2>المهام حسب النوع</h2><p>توزيع مهام الشهر</p></div></header>
          {data ? <Donut slices={typeSlices} centerLabel="مهمة" centerValue={data.missionsTotal} /> : <div className="chart-loading" />}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h2>الأكثر مشاركةً في المهام</h2><p>عدد المهام لكل مسعف</p></div></header>
          {data ? <HBars rows={topMissions} empty="لا مهام مرتبطة بأسماء خلال هذا الشهر." /> : <div className="chart-loading" />}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head"><div><h2>المهام</h2><p>تفصيل المهام لكل مسعف</p></div></header>
        {data && data.paramedics.length === 0 && <p className="muted">لا مهام مرتبطة بأسماء خلال هذا الشهر.</p>}
        {data && data.paramedics.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الصورة</th><th>الاسم</th><th>المجموعة</th><th>عدد المهام</th><th></th></tr></thead>
              <tbody>
                {data.paramedics.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td>{p.photo_url ? <img className="thumb round" src={p.photo_url} alt="" /> : <div className="thumb round" />}</td>
                      <td>{p.name}</td>
                      <td>{p.group_name}</td>
                      <td><strong>{p.count}</strong></td>
                      <td className="row-actions">
                        <button className="link" onClick={() => setExpanded(expanded === `m${p.id}` ? null : `m${p.id}`)}>
                          {expanded === `m${p.id}` ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />} التفاصيل
                        </button>
                      </td>
                    </tr>
                    {expanded === `m${p.id}` && (
                      <tr>
                        <td colSpan={5}>
                          <ul className="report-missions">
                            {p.missions.map((m) => (
                              <li key={m.id}><span>{m.title}</span><span className="muted">{m.type_name}</span><time>{formatDate(m.event_date)}</time></li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="dash-grid dash-grid-2">
        <section className="panel">
          <header className="panel-head"><div><h2>الخدمات الطبية حسب النوع</h2><p>{data ? `${data.servicesTotal} خدمة` : '…'}</p></div></header>
          {data && data.serviceTypes.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>نوع الخدمة</th><th>العدد</th></tr></thead>
                <tbody>{data.serviceTypes.map((t) => <tr key={t.name}><td>{t.name}</td><td><strong>{t.count}</strong></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="muted">{data ? 'لا خدمات مسجّلة خلال هذا الشهر.' : '…'}</p>}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h2>الخدمات حسب المسعف</h2><p>أعلى المسعفين تسجيلاً</p></div></header>
          {data ? <HBars rows={topServices} empty="لا خدمات مسجّلة لأسماء محدّدة خلال هذا الشهر." /> : <div className="chart-loading" />}
        </section>
      </div>
    </>
  );
}
