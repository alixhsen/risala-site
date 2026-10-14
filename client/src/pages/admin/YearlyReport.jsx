import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Siren, Stethoscope, Users, Activity, Share2, FileSpreadsheet, Droplet, Gift } from 'lucide-react';
import { toCsv, downloadCsv } from '../../lib/csv.js';
import { generateSocialReport } from '../../lib/socialReport.js';
import { useSettings } from '../../App.jsx';
import { api, formatDate } from '../../lib/api.js';
import { loadYearSummary } from '../../lib/monthly.js';
import { generateMonthlyPdf } from '../../lib/monthlyPdf.js';
import { Donut, HBars, colorAt } from '../../components/charts.jsx';

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

export default function YearlyReport() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [year, setYear] = useState(Number(params.get('year')) || now.getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    loadYearSummary(year)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    setParams({ year }, { replace: true });
    return () => { alive = false; };
  }, [year, setParams]);

  async function shareImage() {
    if (!data) return;
    setBusy(true);
    try {
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

  function exportMembersCsv() {
    const rows = data.paramedics.map((p) => ({ name: p.name, group: p.group_name, count: p.count }));
    const columns = [
      { label: 'المسعف', value: 'name' },
      { label: 'المجموعة', value: 'group' },
      { label: 'عدد المهام', value: 'count' },
    ];
    downloadCsv(`المسعفون-${year}`, toCsv(columns, rows));
  }

  function exportBloodDonationsCsv() {
    const columns = [
      { label: 'التاريخ', value: (d) => formatDate(d.donation_date) },
      { label: 'اسم المتبرّع', value: 'donor_name' },
      { label: 'فصيلة الدم', value: 'blood_type' },
      { label: 'المستشفى', value: 'hospital' },
      { label: 'المستفيد', value: 'recipient_name' },
    ];
    downloadCsv(`التبرع-بالدم-${year}`, toCsv(columns, data.bloodDonations));
  }

  function exportCommunityDonationsCsv() {
    const columns = [
      { label: 'التاريخ', value: (d) => formatDate(d.donation_date) },
      { label: 'الصنف', value: 'item_type_name' },
      { label: 'التفاصيل', value: 'item_detail' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'عضو الفريق', value: 'team_member_name' },
      { label: 'المستفيد', value: 'recipient_name' },
    ];
    downloadCsv(`الخدمات-العينية-${year}`, toCsv(columns, data.communityDonations));
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
          <h1>التقرير السنوي</h1>
          <p className="dash-sub">ملخّص المهام والخدمات الطبية والتبرعات التي سُجّلت خلال السنة المختارة.</p>
        </div>
        <div className="rep-tools">
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
          <button type="button" className="btn outline" onClick={exportBloodDonationsCsv} disabled={!data || data.bloodDonations.length === 0}>
            <FileSpreadsheet size={16} aria-hidden="true" /> CSV التبرع بالدم
          </button>
          <button type="button" className="btn outline" onClick={exportCommunityDonationsCsv} disabled={!data || data.communityDonations.length === 0}>
            <FileSpreadsheet size={16} aria-hidden="true" /> CSV الخدمات العينية
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
          [Droplet, 'تبرعات بالدم', data?.bloodDonationsTotal, 'brand'],
          [Gift, 'خدمات عينية', data?.communityDonationsTotal, 'gold'],
        ].map(([Icon, label, value, tone]) => (
          <article key={label} className={`kpi kpi-${tone}`}>
            <span className="kpi-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value ?? '–'}</strong>
            <span className="kpi-sub">{year}</span>
          </article>
        ))}
      </div>

      <div className="dash-grid dash-grid-2">
        <section className="panel">
          <header className="panel-head"><div><h2>المهام حسب النوع</h2><p>توزيع مهام السنة</p></div></header>
          {data ? <Donut slices={typeSlices} centerLabel="مهمة" centerValue={data.missionsTotal} /> : <div className="chart-loading" />}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h2>الأكثر مشاركةً في المهام</h2><p>عدد المهام لكل مسعف</p></div></header>
          {data ? <HBars rows={topMissions} empty="لا مهام مرتبطة بأسماء خلال هذا العام." /> : <div className="chart-loading" />}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head"><div><h2>المهام حسب المسعف</h2><p>إجمالي العام لكل مسعف</p></div></header>
        {data && data.paramedics.length === 0 && <p className="muted">لا مهام مرتبطة بأسماء خلال هذا العام.</p>}
        {data && data.paramedics.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الصورة</th><th>الاسم</th><th>المجموعة</th><th>عدد المهام</th></tr></thead>
              <tbody>
                {data.paramedics.map((p) => (
                  <tr key={p.id}>
                    <td>{p.photo_url ? <img className="thumb round" src={p.photo_url} alt="" /> : <div className="thumb round" />}</td>
                    <td>{p.name}</td>
                    <td>{p.group_name}</td>
                    <td><strong>{p.count}</strong></td>
                  </tr>
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
          ) : <p className="muted">{data ? 'لا خدمات مسجّلة خلال هذا العام.' : '…'}</p>}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h2>الخدمات حسب المسعف</h2><p>أعلى المسعفين تسجيلاً</p></div></header>
          {data ? <HBars rows={topServices} empty="لا خدمات مسجّلة لأسماء محدّدة خلال هذا العام." /> : <div className="chart-loading" />}
        </section>
      </div>

      <div className="dash-grid dash-grid-2">
        <section className="panel">
          <header className="panel-head"><div><h2>التبرع بالدم حسب الفصيلة</h2><p>{data ? `${data.bloodDonationsTotal} تبرّع` : '…'}</p></div></header>
          {data && data.bloodDonationTypes.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>الفصيلة</th><th>العدد</th></tr></thead>
                <tbody>{data.bloodDonationTypes.map((t) => <tr key={t.name}><td>{t.name}</td><td><strong>{t.count}</strong></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="muted">{data ? 'لا تبرعات بالدم مسجّلة خلال هذا العام.' : '…'}</p>}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h2>الخدمات العينية حسب الصنف</h2><p>{data ? `${data.communityDonationsQuantity} وحدة موزّعة` : '…'}</p></div></header>
          {data && data.communityDonationTypes.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>الصنف</th><th>الكمية</th></tr></thead>
                <tbody>{data.communityDonationTypes.map((t) => <tr key={t.name}><td>{t.name}</td><td><strong>{t.count}</strong></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="muted">{data ? 'لا خدمات عينية مسجّلة خلال هذا العام.' : '…'}</p>}
        </section>
      </div>
    </>
  );
}
