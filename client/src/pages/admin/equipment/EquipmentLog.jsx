import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLoad } from '../../../App.jsx';
import { AdminHead } from '../../../components/admin/AdminPage.jsx';
import { EmptyPanel } from '../../../components/admin/DataPage.jsx';
import { MemberPicker } from '../../../components/admin/EquipmentParts.jsx';
import { formatDate } from '../../../lib/api.js';
import { KIND_LABELS, KIND_TONE, CONDITION_LABELS, formatDateTime } from '../../../lib/equipment.js';

const PAGE = 50;

export default function EquipmentLog() {
  const [params] = useSearchParams();
  const [kind, setKind] = useState('');
  const [memberId, setMemberId] = useState(Number(params.get('member')) || null);
  const [typeId, setTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { data: members } = useLoad('/admin/equipment/members', []);
  const { data: types } = useLoad('/admin/equipment/types', []);

  const qs = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
  if (kind) qs.set('kind', kind);
  if (memberId) qs.set('member_id', memberId);
  if (typeId) qs.set('type_id', typeId);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const { data, error } = useLoad(`/admin/equipment/transactions?${qs}`, { total: 0, rows: [] });
  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const reset = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <>
      <AdminHead kicker="العُهد والتجهيزات" title="سجل الحركات"
        subtitle="سجل تدقيق كامل لكل تسليم واسترجاع وتبديل وتعديل كمية وتلف وفقدان. لا يمكن تعديل السجل أو حذفه." />

      <div className="eq-filters">
        <label className="field"><span>نوع العملية</span>
          <select value={kind} onChange={(e) => reset(setKind)(e.target.value)}>
            <option value="">الكل</option>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>نوع الغرض</span>
          <select value={typeId} onChange={(e) => reset(setTypeId)(e.target.value)}>
            <option value="">الكل</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field"><span>من تاريخ</span><input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} /></label>
        <label className="field"><span>إلى تاريخ</span><input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} /></label>
        <div className="field"><span>العضو</span><MemberPicker members={members} value={memberId} onChange={reset(setMemberId)} placeholder="كل الأعضاء — ابحث لتحديد عضو" /></div>
      </div>
      {error && <p className="error">{error}</p>}
      {data.rows.length === 0 && <EmptyPanel title="لا حركات مطابقة" text="جرّب تغيير التصفية." />}

      {data.rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead><tr><th>التاريخ والوقت</th><th>العضو</th><th>الغرض</th><th>العملية</th><th>الكمية</th><th>الحالة</th><th>المسؤول</th><th>المنفِّذ</th><th>الملاحظات</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.occurred_on)}<small className="cell-note">{formatDateTime(r.created_at)}</small></td>
                  <td>{r.member_name ? <Link to={`/admin/equipment-custody?member=${r.member_id}`}>{r.member_name}</Link> : '—'}</td>
                  <td><strong>{r.type_name}</strong>{(r.size || r.serial_number) && <small className="cell-note">{[r.size, r.serial_number && `رقم ${r.serial_number}`].filter(Boolean).join(' · ')}</small>}</td>
                  <td><span className={`eq-badge ${KIND_TONE[r.kind]}`}>{KIND_LABELS[r.kind]}</span>{r.direction && <small className="cell-note">{r.direction === 'out' ? 'خروج من المستودع' : 'دخول إلى المستودع'}</small>}</td>
                  <td>{r.quantity}</td>
                  <td>{CONDITION_LABELS[r.condition] || '—'}</td>
                  <td>{r.party_name || '—'}</td>
                  <td>{r.user_name || '—'}</td>
                  <td className="cell-wrap">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="eq-pager">
          <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button>
          <span>صفحة {page + 1} من {pages} · {data.total} حركة</span>
          <button type="button" className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
    </>
  );
}
