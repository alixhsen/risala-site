import { Link, useNavigate } from 'react-router-dom';
import { PackagePlus, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useLoad } from '../../../App.jsx';
import { useAdmin } from '../../../components/AdminLayout.jsx';
import { AdminHead } from '../../../components/admin/AdminPage.jsx';
import { StatTiles, EmptyPanel } from '../../../components/admin/DataPage.jsx';
import { MemberPicker, StatusBadge, useEqAccess } from '../../../components/admin/EquipmentParts.jsx';
import { alertText, KIND_LABELS, KIND_TONE, CONDITION_LABELS, formatDateTime } from '../../../lib/equipment.js';
import { formatDate } from '../../../lib/api.js';

export default function EquipmentDashboard() {
  const admin = useAdmin();
  const { canHandle } = useEqAccess(admin);
  const navigate = useNavigate();
  const { data, error } = useLoad('/admin/equipment/dashboard', null);
  const { data: members } = useLoad('/admin/equipment/members', []);
  const s = data?.stats;

  return (
    <>
      <AdminHead
        kicker="العُهد والتجهيزات"
        title="إدارة العُهد والتجهيزات"
        subtitle="نظرة شاملة على التجهيزات المسجّلة، وما سُلِّم منها للأعضاء، وما عاد إلى المستودع."
        actions={canHandle && <Link to="/admin/equipment-issue" className="btn primary"><PackagePlus size={16} aria-hidden="true" /> تسليم عهدة جديدة</Link>}
      />
      {error && <p className="error">{error}</p>}

      {s && (
        <StatTiles items={[
          { label: 'إجمالي الأغراض المسجلة', value: s.total_items, sub: 'مستودع + بحوزة الأعضاء + تالف', tone: 'brand' },
          { label: 'مسلّمة للأعضاء', value: s.with_members, sub: 'غير مستردة حالياً', tone: 'warn' },
          { label: 'في المستودع', value: s.in_warehouse, sub: 'جاهزة للتسليم', tone: 'ok' },
          { label: 'المسترجعة', value: s.returned, sub: 'إجمالي ما أُعيد', tone: 'gold' },
          { label: 'تالفة / تحتاج صيانة', value: s.needs_maintenance, sub: s.written_off ? `+ ${s.written_off} تالف أو مفقود موثّق` : 'في المستودع', tone: 'danger' },
          { label: 'أعضاء لديهم أغراض', value: s.members_with_items, sub: 'عُهد غير مستردة', tone: 'brand' },
          { label: 'عُهد أعضاء غير فعّالين', value: s.inactive_items, sub: 'متوقفون أو منسحبون أو مفصولون', tone: s.inactive_items ? 'danger' : 'ok' },
        ]} />
      )}

      <section className="eq-block">
        <h2>البحث عن مسعف وعرض عُهدته</h2>
        <MemberPicker members={members} value={null} onChange={(id) => id && navigate(`/admin/equipment-custody?member=${id}`)} />
      </section>

      {data?.alerts.length > 0 && (
        <section className="eq-block eq-block-bad">
          <h2><ShieldAlert size={18} aria-hidden="true" /> أعضاء غير فعّالين لا تزال بحوزتهم عُهد</h2>
          <ul className="eq-alert-list">
            {data.alerts.map((a) => (
              <li key={a.member_id}>
                <div>
                  <strong>{a.member_name}</strong> <StatusBadge status={a.member_status} />
                  <p>{alertText(a.member_status, a.outstanding)}</p>
                </div>
                <Link className="btn" to={`/admin/equipment-custody?member=${a.member_id}`}>عرض العُهدة <ArrowLeft size={15} aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data?.lowStock.length > 0 && (
        <section className="eq-block eq-block-warn">
          <h2>تنبيه المخزون: أغراض تحت الحد الأدنى</h2>
          <ul className="eq-alert-list">
            {data.lowStock.map((t) => (
              <li key={t.id}><div><strong>{t.name}</strong><p>المتوفر {t.in_stock} من حد أدنى {t.min_stock}</p></div></li>
            ))}
          </ul>
        </section>
      )}

      <section className="eq-block">
        <h2>آخر عمليات التسليم والاسترجاع</h2>
        {data && data.recent.length === 0 && <EmptyPanel title="لا عمليات بعد" text="ستظهر هنا عمليات التسليم والاسترجاع فور تسجيلها." />}
        {data?.recent.length > 0 && (
          <div className="table-wrap admin-table">
            <table>
              <thead><tr><th>التاريخ</th><th>العملية</th><th>العضو</th><th>الغرض</th><th>الكمية</th><th>المسؤول</th></tr></thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.occurred_on)}<small className="cell-note">{formatDateTime(r.created_at)}</small></td>
                    <td><span className={`eq-badge ${KIND_TONE[r.kind]}`}>{KIND_LABELS[r.kind]}</span>{r.condition && r.kind !== 'adjust' && <small className="cell-note">{CONDITION_LABELS[r.condition]}</small>}</td>
                    <td>{r.member_name ? <Link to={`/admin/equipment-custody?member=${r.member_id}`}>{r.member_name}</Link> : '—'}</td>
                    <td><strong>{r.type_name}</strong>{(r.size || r.serial_number) && <small className="cell-note">{[r.size, r.serial_number && `رقم ${r.serial_number}`].filter(Boolean).join(' · ')}</small>}</td>
                    <td>{r.quantity}</td>
                    <td>{r.party_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint"><Link to="/admin/equipment-log">عرض السجل الكامل للحركات ←</Link></p>
      </section>
    </>
  );
}
