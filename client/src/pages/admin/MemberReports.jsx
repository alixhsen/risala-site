import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, UserRound, Siren, Stethoscope, Layers, ChevronLeft } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import { MONTHS_AR, formatDate } from '../../lib/api.js';
import { loadMonth } from '../../lib/monthly.js';
import { generateMemberPdf } from '../../lib/memberPdf.js';
import { AdminHead, FormSection } from '../../components/admin/AdminPage.jsx';

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

export default function MemberReports() {
  const { settings } = useSettings();
  const team = useLoad('/admin/team', []);
  const [params, setParams] = useSearchParams();
  const [year, setYear] = useState(Number(params.get('year')) || now.getFullYear());
  const [month, setMonth] = useState(Number(params.get('month')) || now.getMonth() + 1);
  const [selected, setSelected] = useState(Number(params.get('member')) || null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    loadMonth(year, month)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [year, month]);

  useEffect(() => {
    setParams({ year, month, ...(selected ? { member: selected } : {}) }, { replace: true });
  }, [year, month, selected, setParams]);

  // One row per team member, with that month's missions and services.
  const rows = useMemo(() => {
    if (!data) return [];
    return team.data.map((m) => {
      const mp = data.paramedics.find((p) => p.id === m.id);
      const sp = data.serviceParamedics.find((p) => p.id === m.id);
      const missions = mp ? mp.missions : [];
      const services = sp ? sp.services : [];
      return {
        member: m,
        missions,
        services,
        quantity: services.reduce((s, x) => s + (x.quantity || 1), 0),
      };
    });
  }, [data, team.data]);

  const active = rows.find((r) => r.member.id === selected) || null;
  const activeCount = rows.filter((r) => r.missions.length || r.services.length).length;

  async function downloadPdf() {
    if (!active) return;
    setBusy(true);
    try {
      await generateMemberPdf({
        settings,
        member: active.member,
        monthName: MONTHS_AR[month - 1],
        year,
        missions: active.missions,
        services: active.services,
      });
    } catch (e) {
      setError(e.message || 'تعذّر إنشاء الملف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHead
        kicker="التقارير"
        title="تقارير المسعفين"
        subtitle={data ? `${activeCount} من ${team.data.length} عضو نشط في ${MONTHS_AR[month - 1]} ${year}` : 'جارٍ تحميل البيانات…'}
        actions={(
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
          </div>
        )}
      />

      {error && <p className="error" role="alert">{error}</p>}

      <FormSection icon={UserRound} title="أعضاء الفريق" help="اختر عضواً لعرض تفاصيل مشاركاته، ثم حمّل تقريره الفردي.">
        {!data && <div className="chart-loading" />}
        {data && team.data.length === 0 && <p className="muted">لا أعضاء في الفريق بعد. أضفهم من صفحة الفريق.</p>}
        {data && team.data.length > 0 && (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr><th>العضو</th><th>المجموعة</th><th>المهام</th><th>الخدمات</th><th>الكميات</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.member.id} className={r.member.id === selected ? 'is-selected' : ''}>
                    <td>
                      <span className="member-cell">
                        {r.member.photo_url
                          ? <img className="thumb round" src={r.member.photo_url} alt="" />
                          : <span className="avatar-xs">{r.member.name.trim().charAt(0)}</span>}
                        <span>
                          <strong>{r.member.name}</strong>
                          {r.member.role_title && <small>{r.member.role_title}</small>}
                        </span>
                      </span>
                    </td>
                    <td>{r.member.group_name || '—'}</td>
                    <td><strong>{r.missions.length}</strong></td>
                    <td><strong>{r.services.length}</strong></td>
                    <td><strong>{r.quantity}</strong></td>
                    <td className="row-actions">
                      <button type="button" className="link" onClick={() => setSelected(r.member.id)}>
                        تفاصيل <ChevronLeft size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      {active && (
        <section className="member-detail">
          <header className="member-detail-head">
            <div className="member-detail-who">
              {active.member.photo_url
                ? <img className="member-photo" src={active.member.photo_url} alt="" />
                : <span className="member-photo member-photo-init">{active.member.name.trim().charAt(0)}</span>}
              <div>
                <h2>{active.member.name}</h2>
                <p>{[active.member.role_title, active.member.group_name].filter(Boolean).join(' · ') || 'عضو في الفريق'}</p>
              </div>
            </div>
            <button type="button" className="btn primary" onClick={downloadPdf} disabled={busy}>
              <Download size={16} aria-hidden="true" /> {busy ? 'جارٍ إنشاء الملف…' : 'تحميل التقرير الفردي PDF'}
            </button>
          </header>

          <div className="kpi-grid kpi-3">
            <article className="kpi kpi-brand">
              <span className="kpi-icon"><Siren size={20} aria-hidden="true" /></span>
              <span className="kpi-label">المهام</span>
              <strong className="kpi-value">{active.missions.length}</strong>
              <span className="kpi-sub">{MONTHS_AR[month - 1]} {year}</span>
            </article>
            <article className="kpi kpi-gold">
              <span className="kpi-icon"><Stethoscope size={20} aria-hidden="true" /></span>
              <span className="kpi-label">الخدمات المسجّلة</span>
              <strong className="kpi-value">{active.services.length}</strong>
              <span className="kpi-sub">سجلات خدمة</span>
            </article>
            <article className="kpi kpi-brand">
              <span className="kpi-icon"><Layers size={20} aria-hidden="true" /></span>
              <span className="kpi-label">مجموع الكميات</span>
              <strong className="kpi-value">{active.quantity}</strong>
              <span className="kpi-sub">من الخدمات الطبية</span>
            </article>
          </div>

          <div className="member-lists">
            <div className="panel">
              <header className="panel-head"><div><h3>المهام</h3><p>المشاركة في العمليات</p></div></header>
              {active.missions.length === 0 ? <p className="muted">لا مشاركة في مهام خلال هذا الشهر.</p> : (
                <ul className="member-items">
                  {active.missions.map((m) => (
                    <li key={m.id}>
                      <span className="member-item-title">{m.title}</span>
                      <span className="member-item-meta">{m.type_name} · {formatDate(m.event_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel">
              <header className="panel-head"><div><h3>الخدمات الطبية</h3><p>ما نفّذه العضو من خدمات</p></div></header>
              {active.services.length === 0 ? <p className="muted">لا خدمات مسجّلة لهذا العضو خلال هذا الشهر.</p> : (
                <ul className="member-items">
                  {active.services.map((s) => (
                    <li key={s.id}>
                      <span className="member-item-title">{s.type_name} <small>×{s.quantity || 1}</small></span>
                      <span className="member-item-meta">{formatDate(s.service_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
