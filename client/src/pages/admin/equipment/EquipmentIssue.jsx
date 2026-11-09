import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PackagePlus, Plus, Trash2, Printer, FileDown, Check, RotateCcw, X } from 'lucide-react';
import { useLoad, useSettings } from '../../../App.jsx';
import { useAdmin } from '../../../components/AdminLayout.jsx';
import { useDialog } from '../../../components/admin/Dialog.jsx';
import { AdminHead, FormSection, SaveBar } from '../../../components/admin/AdminPage.jsx';
import { IconButton, EmptyPanel } from '../../../components/admin/DataPage.jsx';
import { MemberPicker, CustodyAlert, StatusBadge, openVoucher } from '../../../components/admin/EquipmentParts.jsx';
import { api } from '../../../lib/api.js';
import { isActiveMember, memberNo, MEMBER_STATUS } from '../../../lib/equipment.js';

const today = () => new Date().toISOString().slice(0, 10);
const blankRow = () => ({ key: Math.random().toString(36).slice(2), type_id: '', inventory_id: '', quantity: 1 });

export default function EquipmentIssue() {
  const admin = useAdmin();
  const { settings } = useSettings();
  const { notify, confirm } = useDialog();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: members, reload: reloadMembers } = useLoad('/admin/equipment/members', []);
  const { data: types, reload: reloadTypes } = useLoad('/admin/equipment/types', []);
  const { data: lines, reload: reloadLines } = useLoad('/admin/equipment/inventory', []);

  const [memberId, setMemberId] = useState(Number(params.get('member')) || null);
  const [date, setDate] = useState(today());
  const [issuer, setIssuer] = useState(admin.user.display_name || '');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([blankRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [fileBusy, setFileBusy] = useState('');

  const member = members.find((m) => m.id === memberId);
  const issuable = useMemo(() => types.filter((t) => t.active && lines.some((l) => l.type_id === t.id && l.in_stock > 0)), [types, lines]);
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const linesOf = (typeId) => lines.filter((l) => l.type_id === Number(typeId) && l.in_stock > 0);

  // Stock still free after the other rows of this form took their share.
  const free = (row) => {
    const line = lines.find((l) => l.id === Number(row.inventory_id));
    if (!line) return 0;
    const taken = rows.filter((r) => r.key !== row.key && Number(r.inventory_id) === line.id).reduce((n, r) => n + (Number(r.quantity) || 0), 0);
    return Math.max(0, line.in_stock - taken);
  };

  const blocked = member && !isActiveMember(member.member_status);

  // Back to wherever the form was opened from (or the section's home when it
  // was opened directly), asking first if something was already filled in.
  const dirty = rows.some((r) => r.inventory_id) || notes.trim() !== '' || (memberId && !params.get('member'));
  async function cancel() {
    if (dirty && !(await confirm('إلغاء هذه العملية؟ ستُفقد البيانات التي أدخلتها.', { title: 'إلغاء التسليم', confirmLabel: 'نعم، إلغاء', cancelLabel: 'متابعة التعبئة', danger: true }))) return;
    if (location.key === 'default') navigate('/admin/equipment', { replace: true });
    else navigate(-1);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!memberId) return setError('اختر العضو أولاً');
    if (blocked) return setError(`لا يمكن تسليم عُهدة لعضو حالته «${MEMBER_STATUS[member.member_status]}»`);
    const items = rows.filter((r) => r.inventory_id);
    if (items.length === 0) return setError('اختر غرضاً واحداً على الأقل');
    setBusy(true);
    try {
      const res = await api('/admin/equipment/issues', {
        method: 'POST',
        body: { member_id: memberId, issue_date: date, issuer_name: issuer, notes, items: items.map((r) => ({ inventory_id: Number(r.inventory_id), quantity: Number(r.quantity) })) },
      });
      setDone({ id: res.id, member });
      reloadMembers(); reloadTypes(); reloadLines();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function voucher(mode) {
    setFileBusy(mode);
    try { await openVoucher(settings, done.id, mode); } catch (err) { notify(err.message); } finally { setFileBusy(''); }
  }

  function again(keepMember) {
    setDone(null); setRows([blankRow()]); setNotes(''); setError('');
    if (!keepMember) setMemberId(null);
  }

  if (done) {
    return (
      <>
        <AdminHead kicker="العُهد والتجهيزات" title="تم تسجيل العُهدة" />
        <div className="eq-success">
          <span className="eq-success-icon"><Check size={26} aria-hidden="true" /></span>
          <h2>سُلِّمت العُهدة إلى {done.member?.name}</h2>
          <p>أُضيفت إلى قائمة العُهد النشطة وسُجّلت في سجل الحركات. اطبع نموذج الاستلام ليوقّع عليه العضو.</p>
          <div className="eq-success-actions">
            <button type="button" className="btn primary" disabled={!!fileBusy} onClick={() => voucher('print')}><Printer size={16} aria-hidden="true" /> {fileBusy === 'print' ? 'جارٍ التجهيز…' : 'طباعة نموذج الاستلام'}</button>
            <button type="button" className="btn" disabled={!!fileBusy} onClick={() => voucher('download')}><FileDown size={16} aria-hidden="true" /> {fileBusy === 'download' ? 'جارٍ التجهيز…' : 'تنزيل PDF'}</button>
            <Link className="btn" to={`/admin/equipment-custody?member=${done.member?.id}`}>عُهدة العضو</Link>
            <button type="button" className="btn" onClick={() => again(true)}><RotateCcw size={15} aria-hidden="true" /> تسليم آخر لنفس العضو</button>
            <button type="button" className="btn" onClick={() => again(false)}>تسليم لعضو آخر</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHead kicker="العُهد والتجهيزات" title="تسليم عهدة جديدة" subtitle="اختر العضو من الأعضاء المسجّلين، ثم الأغراض والكميات والمقاسات." />
      {types.length > 0 && issuable.length === 0 && <EmptyPanel title="لا أغراض متوفرة في المستودع" text="أضف مخزوناً من صفحة «أنواع التجهيزات والمخزون» قبل التسليم." />}
      {types.length === 0 && <EmptyPanel title="لا أنواع تجهيزات بعد" text="أنشئ أنواع الأغراض أولاً من صفحة «أنواع التجهيزات والمخزون»." />}

      <form className="drawer-form" onSubmit={submit}>
        <FormSection icon={PackagePlus} title="العضو" help="البحث في أعضاء الفريق المسجّلين، بلا إنشاء أعضاء مكرّرين.">
          <MemberPicker members={members} value={memberId} onChange={setMemberId} />
          {member && (
            <dl className="eq-member-card">
              <div><dt>رقم العضو</dt><dd>{memberNo(member.id)}</dd></div>
              <div><dt>الحالة</dt><dd><StatusBadge status={member.member_status} /></dd></div>
              <div><dt>الهاتف</dt><dd>{member.phone ? <bdi dir="ltr">{member.phone}</bdi> : '—'}</dd></div>
              <div><dt>المجموعة / الدور</dt><dd>{[member.group_name, member.role_title].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt>عُهد غير مستردة</dt><dd>{member.outstanding > 0 ? <Link to={`/admin/equipment-custody?member=${member.id}`}>{member.outstanding} غرض (عرض)</Link> : 'لا يوجد'}</dd></div>
            </dl>
          )}
          {member && <CustodyAlert status={member.member_status} outstanding={member.outstanding} />}
          {blocked && <p className="error">لا يمكن تسليم عُهدة جديدة لعضو غير فعّال.</p>}
        </FormSection>

        <FormSection icon={PackagePlus} title="الأغراض" help="يمكن تسليم أكثر من غرض معاً، وتسليم الغرض نفسه لأكثر من عضو في عمليات منفصلة.">
          <div className="eq-rows">
            {rows.map((row, i) => {
              const options = row.type_id ? linesOf(row.type_id) : [];
              const line = lines.find((l) => l.id === Number(row.inventory_id));
              const max = free(row);
              return (
                <div className="eq-row" key={row.key}>
                  <label className="field"><span>الغرض</span>
                    <select value={row.type_id} onChange={(e) => {
                      const opts = linesOf(e.target.value);
                      setRow(row.key, { type_id: e.target.value, inventory_id: opts.length === 1 ? String(opts[0].id) : '', quantity: 1 });
                    }}>
                      <option value="">— اختر —</option>
                      {issuable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>{types.find((t) => t.id === Number(row.type_id))?.tracks_serial ? 'الرقم التسلسلي' : 'المقاس'}</span>
                    <select value={row.inventory_id} disabled={!row.type_id} onChange={(e) => setRow(row.key, { inventory_id: e.target.value, quantity: 1 })}>
                      <option value="">— اختر —</option>
                      {options.map((l) => (
                        <option key={l.id} value={l.id}>{[l.serial_number && `رقم ${l.serial_number}`, l.size, `متوفر ${l.in_stock}`].filter(Boolean).join(' · ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field"><span>الكمية{line && <small> (المتاح {max})</small>}</span>
                    <input type="number" min="1" max={max || 1} required value={row.quantity} disabled={!line || line.serial_number} onChange={(e) => setRow(row.key, { quantity: e.target.value })} />
                  </label>
                  <IconButton icon={Trash2} label="حذف السطر" tone="danger" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} />
                 
                </div>
              );
            })}
          </div>
          <button type="button" className="btn" onClick={() => setRows((rs) => [...rs, blankRow()])}><Plus size={15} aria-hidden="true" /> إضافة غرض آخر</button>
        </FormSection>

        <FormSection icon={PackagePlus} title="بيانات التسليم">
          <div className="field-row">
            <label className="field"><span>تاريخ التسليم</span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field"><span>المسؤول عن التسليم</span>
              <input required maxLength={120} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </label>
          </div>
          <label className="field"><span>ملاحظات</span>
            <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </FormSection>

        <SaveBar error={error}>
          <button type="button" className="btn" onClick={cancel}><X size={15} aria-hidden="true" /> إلغاء والعودة</button>
          <button className="btn primary" disabled={busy || !!blocked}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ وتسليم العُهدة'}</button>
        </SaveBar>
      </form>
    </>
  );
}
