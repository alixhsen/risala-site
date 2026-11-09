import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Undo2, ArrowLeftRight, TriangleAlert, FileDown, Printer, PackagePlus, History, UserRound, Check } from 'lucide-react';
import { useLoad, useSettings } from '../../../App.jsx';
import { useAdmin } from '../../../components/AdminLayout.jsx';
import { useDialog } from '../../../components/admin/Dialog.jsx';
import { AdminHead } from '../../../components/admin/AdminPage.jsx';
import { FilterBar, ChipFilter, EmptyPanel, IconButton } from '../../../components/admin/DataPage.jsx';
import { StatusBadge, CustodyAlert, Modal, ItemPicker, itemSpec, openVoucher, useEqAccess } from '../../../components/admin/EquipmentParts.jsx';
import { api, formatDate } from '../../../lib/api.js';
import { isActiveMember, memberNo, CONDITION_LABELS } from '../../../lib/equipment.js';

const today = () => new Date().toISOString().slice(0, 10);
const lineText = (c) => [c.type_name, c.size, c.serial_number && `رقم ${c.serial_number}`].filter(Boolean).join(' · ');

export default function EquipmentCustody() {
  const admin = useAdmin();
  const { canHandle } = useEqAccess(admin);
  const { settings } = useSettings();
  const { notify } = useDialog();
  const [params, setParams] = useSearchParams();
  const memberId = Number(params.get('member')) || null;

  const { data: members, reload: reloadMembers } = useLoad('/admin/equipment/members', []);
  const detail = useLoad(memberId ? `/admin/equipment/members/${memberId}` : null, null);
  const issues = useLoad(memberId ? `/admin/equipment/members/${memberId}/issues` : null, []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('items');
  const [show, setShow] = useState('open'); // open | all
  const [picked, setPicked] = useState([]); // custody ids chosen for a grouped return
  const [modal, setModal] = useState(null); // { kind: 'return'|'replace'|'loss', lines: [...] }
  const [fileBusy, setFileBusy] = useState(null);

  const counts = useMemo(() => ({
    all: members.length,
    items: members.filter((m) => m.outstanding > 0).length,
    flagged: members.filter((m) => m.outstanding > 0 && !isActiveMember(m.member_status)).length,
  }), [members]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === 'items' && !(m.outstanding > 0)) return false;
      if (filter === 'flagged' && !(m.outstanding > 0 && !isActiveMember(m.member_status))) return false;
      return !q || `${m.name} ${m.phone || ''} ${m.id}`.toLowerCase().includes(q);
    });
  }, [members, search, filter]);

  const d = detail.data;
  const custody = d ? d.custody.filter((c) => show === 'all' || c.outstanding > 0) : [];
  const open = d ? d.custody.filter((c) => c.outstanding > 0) : [];

  const select = (id) => { setParams(id ? { member: String(id) } : {}); setPicked([]); };
  const refresh = () => { detail.reload(); issues.reload(); reloadMembers(); setPicked([]); };

  async function voucher(issueId, mode) {
    setFileBusy(`${issueId}-${mode}`);
    try { await openVoucher(settings, issueId, mode); } catch (err) { notify(err.message); } finally { setFileBusy(null); }
  }

  return (
    <>
      <AdminHead kicker="العُهد والتجهيزات" title="عُهد الأعضاء" subtitle="ابحث عن أي مسعف لعرض كل ما بحوزته، واسترجع أو بدّل أو وثّق التلف والفقدان."
        actions={canHandle && <Link to={memberId ? `/admin/equipment-issue?member=${memberId}` : '/admin/equipment-issue'} className="btn primary"><PackagePlus size={16} aria-hidden="true" /> تسليم عهدة جديدة</Link>} />

      <div className="eq-split">
        <aside className="eq-members">
          <FilterBar search={search} onSearch={setSearch} placeholder="ابحث عن مسعف…" />
          <ChipFilter label="تصفية الأعضاء" value={filter} onChange={setFilter}
            options={[['items', 'لديهم أغراض', counts.items], ['flagged', 'غير فعّالون وبحوزتهم أغراض', counts.flagged], ['all', 'الكل', counts.all]]} />
          <ul className="eq-member-list">
            {list.length === 0 && <li className="eq-picker-empty">لا نتائج</li>}
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className={m.id === memberId ? 'on' : ''} onClick={() => select(m.id)}>
                  <span><strong>{m.name}</strong><small>{memberNo(m.id)}</small></span>
                  <span className="eq-picker-meta">
                    {m.outstanding > 0 && <em>{m.outstanding}</em>}
                    {!isActiveMember(m.member_status) && <StatusBadge status={m.member_status} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="eq-detail">
          {!memberId && <EmptyPanel icon={UserRound} title="اختر مسعفاً" text="اختر عضواً من القائمة لعرض عُهدته وإدارتها." />}
          {memberId && detail.error && <p className="error">{detail.error}</p>}
          {d && (
            <>
              <header className="eq-member-head">
                <div>
                  <h2>{d.member.name} <StatusBadge status={d.member.member_status} /></h2>
                  <p className="hint">رقم العضو {memberNo(d.member.id)}{d.member.phone && <> · <bdi dir="ltr">{d.member.phone}</bdi></>} · بحوزته {d.outstanding} غرض</p>
                </div>
                <Link className="btn" to={`/admin/equipment-log?member=${d.member.id}`}><History size={15} aria-hidden="true" /> سجل الحركات</Link>
              </header>
              <CustodyAlert status={d.member.member_status} outstanding={d.outstanding} />

              <div className="eq-toolbar">
                <ChipFilter label="عرض البنود" value={show} onChange={setShow} options={[['open', 'النشطة', open.length], ['all', 'الكل مع المغلقة', d.custody.length]]} />
                {canHandle && picked.length > 0 && (
                  <button type="button" className="btn primary" onClick={() => setModal({ kind: 'return', lines: open.filter((c) => picked.includes(c.id)) })}>
                    <Undo2 size={15} aria-hidden="true" /> استرجاع المحدد ({picked.length})
                  </button>
                )}
                {canHandle && open.length > 1 && picked.length === 0 && (
                  <button type="button" className="btn" onClick={() => setModal({ kind: 'return', lines: open })}><Undo2 size={15} aria-hidden="true" /> استرجاع كل العُهدة</button>
                )}
              </div>

              {custody.length === 0 && <EmptyPanel title="لا عُهد نشطة" text={d.custody.length ? 'كل ما سُلِّم لهذا العضو أُغلق (استُرجع أو وُثِّق).' : 'لم تُسلَّم لهذا العضو أي عُهدة بعد.'} />}
              {custody.length > 0 && (
                <div className="table-wrap admin-table">
                  <table>
                    <thead><tr>{canHandle && <th aria-label="تحديد"></th>}<th>الغرض</th><th>سُلِّم</th><th>المتبقي</th><th>مسترجع</th><th>تالف/مفقود</th><th>التاريخ</th><th aria-label="إجراءات"></th></tr></thead>
                    <tbody>
                      {custody.map((c) => {
                        const isOpen = c.outstanding > 0;
                        return (
                          <tr key={c.id} className={isOpen ? '' : 'is-closed'}>
                            {canHandle && <td>{isOpen && <input type="checkbox" aria-label={`تحديد ${lineText(c)}`} checked={picked.includes(c.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} />}</td>}
                            <td><strong>{lineText(c)}</strong>{c.replaced_from_id && <small className="cell-note">بدل غرض سابق</small>}{c.notes && <small className="cell-note">{c.notes}</small>}</td>
                            <td>{c.quantity}</td>
                            <td>{isOpen ? <span className="eq-badge warn">{c.outstanding}</span> : <span className="eq-badge ok"><Check size={12} aria-hidden="true" /> مغلقة</span>}</td>
                            <td>{c.returned_qty + c.returned_damaged_qty}{c.returned_damaged_qty > 0 && <small className="cell-note">منها {c.returned_damaged_qty} تالف</small>}</td>
                            <td>{c.damaged_qty + c.lost_qty > 0 ? <>{c.damaged_qty > 0 && <small className="cell-note">تالف {c.damaged_qty}</small>}{c.lost_qty > 0 && <small className="cell-note">مفقود {c.lost_qty}</small>}</> : '—'}</td>
                            <td className="nowrap"><bdi dir="ltr">{c.issued_on}</bdi>{c.closed_on && <small className="cell-note">أُغلقت <bdi dir="ltr">{c.closed_on}</bdi></small>}</td>
                            <td className="row-actions-icons">
                              {canHandle && isOpen && (
                                <>
                                  <IconButton icon={Undo2} label="استرجاع" tone="brand" onClick={() => setModal({ kind: 'return', lines: [c] })} />
                                  {isActiveMember(c.member_status) && <IconButton icon={ArrowLeftRight} label="تبديل بغرض جديد" onClick={() => setModal({ kind: 'replace', line: c })} />}
                                  <IconButton icon={TriangleAlert} label="تسجيل تلف أو فقدان" tone="danger" onClick={() => setModal({ kind: 'loss', line: c })} />
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {issues.data.length > 0 && (
                <div className="eq-block">
                  <h3>نماذج الاستلام</h3>
                  <ul className="eq-voucher-list">
                    {issues.data.map((i) => (
                      <li key={i.id}>
                        <span><strong>نموذج {`EQ-${String(i.id).padStart(5, '0')}`}</strong> · {formatDate(i.issue_date)} · {i.lines} بند · {i.issuer_name}</span>
                        <span>
                          <IconButton icon={Printer} label="طباعة النموذج" disabled={fileBusy === `${i.id}-print`} onClick={() => voucher(i.id, 'print')} />
                          <IconButton icon={FileDown} label="تنزيل النموذج PDF" disabled={fileBusy === `${i.id}-download`} onClick={() => voucher(i.id, 'download')} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {modal?.kind === 'return' && <ReturnModal lines={modal.lines} user={admin.user} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.kind === 'loss' && <LossModal line={modal.line} user={admin.user} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.kind === 'replace' && <ReplaceModal line={modal.line} user={admin.user} onClose={() => setModal(null)} onDone={(issueId) => { setModal(null); refresh(); if (issueId) voucher(issueId, 'print'); }} />}
    </>
  );
}

function ReturnModal({ lines, user, onClose, onDone }) {
  const [date, setDate] = useState(today());
  const [receiver, setReceiver] = useState(user.display_name || '');
  const [rows, setRows] = useState(lines.map((c) => ({ custody_id: c.id, quantity: c.outstanding, condition: 'good', notes: '' })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const patch = (i, p) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/admin/equipment/returns', { method: 'POST', body: { date, receiver, items: rows.map((r) => ({ ...r, quantity: Number(r.quantity) })) } });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title="استرجاع عُهدة" wide onClose={onClose}>
      <form onSubmit={submit} className="eq-modal-form">
        <p className="hint">يمكن استرجاع جزء من الكمية؛ ما لم يُسترجع يبقى بحوزة العضو.</p>
        {lines.map((c, i) => (
          <div key={c.id} className="eq-return-row">
            <strong>{lineText(c)} <small>(المتبقي {c.outstanding})</small></strong>
            <div className="field-row">
              <label className="field"><span>الكمية المسترجعة</span>
                <input type="number" min="1" max={c.outstanding} required value={rows[i].quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
              </label>
              <label className="field"><span>حالة الغرض</span>
                <select value={rows[i].condition} onChange={(e) => patch(i, { condition: e.target.value })}>
                  {['good', 'needs_maintenance', 'damaged'].map((k) => <option key={k} value={k}>{CONDITION_LABELS[k]}</option>)}
                </select>
              </label>
            </div>
            <label className="field"><span>ملاحظات الحالة{rows[i].condition !== 'good' && ' (مطلوبة)'}</span>
              <input maxLength={1000} required={rows[i].condition !== 'good'} value={rows[i].notes} onChange={(e) => patch(i, { notes: e.target.value })} />
            </label>
          </div>
        ))}
        <div className="field-row">
          <label className="field"><span>تاريخ الاسترجاع</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>المسؤول عن الاستلام</span><input required maxLength={120} value={receiver} onChange={(e) => setReceiver(e.target.value)} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="eq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تأكيد الاسترجاع'}</button>
        </div>
      </form>
    </Modal>
  );
}

function LossModal({ line, user, onClose, onDone }) {
  const [kind, setKind] = useState('lost');
  const [quantity, setQuantity] = useState(line.outstanding);
  const [date, setDate] = useState(today());
  const [person, setPerson] = useState(user.display_name || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/admin/equipment/custody/${line.id}/loss`, { method: 'POST', body: { kind, quantity: Number(quantity), date, person, notes } });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={`تسجيل تلف أو فقدان — ${lineText(line)}`} onClose={onClose}>
      <form onSubmit={submit} className="eq-modal-form">
        <p className="hint">يُغلق هذا الجزء من العُهدة بتوثيق النقص، ولا يعود إلى المخزون. السجل الأصلي يبقى محفوظاً.</p>
        <div className="field-row">
          <label className="field"><span>نوع الحالة</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="lost">مفقود</option><option value="damaged">تالف</option></select>
          </label>
          <label className="field"><span>الكمية (المتبقي {line.outstanding})</span>
            <input type="number" min="1" max={line.outstanding} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>التاريخ</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>المسؤول</span><input required maxLength={120} value={person} onChange={(e) => setPerson(e.target.value)} /></label>
        </div>
        <label className="field"><span>الملاحظات (مطلوبة)</span><textarea rows={3} required maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="eq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn hi" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'توثيق'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReplaceModal({ line, user, onClose, onDone }) {
  const { data: lines } = useLoad('/admin/equipment/inventory', []);
  const { data: types } = useLoad('/admin/equipment/types', []);
  const [item, setItem] = useState({ type_id: '', inventory_id: '', size: '', serial_number: '', quantity: 1 });
  const [oldCondition, setOldCondition] = useState('damaged');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(today());
  const [person, setPerson] = useState(user.display_name || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const spec = itemSpec(item, types);
      if (!spec) throw new Error('اختر الغرض الجديد');
      const res = await api(`/admin/equipment/custody/${line.id}/replace`, {
        method: 'POST',
        body: { old_condition: oldCondition, new_inventory_id: spec.inventory_id, new_type_id: spec.type_id, new_size: spec.size, new_serial_number: spec.serial_number, quantity: Number(quantity), date, person, notes },
      });
      onDone(res.issue_id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={`تبديل — ${lineText(line)}`} onClose={onClose}>
      <form onSubmit={submit} className="eq-modal-form">
        <div className="field-row">
          <label className="field"><span>حالة الغرض القديم</span>
            <select value={oldCondition} onChange={(e) => setOldCondition(e.target.value)}>
              {['good', 'needs_maintenance', 'damaged', 'lost'].map((k) => <option key={k} value={k}>{CONDITION_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field"><span>الكمية (المتبقي {line.outstanding})</span>
            <input type="number" min="1" max={line.outstanding} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
        </div>
        <p className="hint">الغرض الجديد (الكمية المسلَّمة = الكمية أعلاه):</p>
        <div className="eq-row eq-row-modal">
          <ItemPicker types={types} lines={lines} value={{ ...item, quantity }} max={Math.max(0, (lines.find((l) => l.id === Number(item.inventory_id))?.in_stock) || 0)} onChange={(patch) => { const { quantity: q, ...rest } = patch; if (q !== undefined) setQuantity(q); setItem((v) => ({ ...v, ...rest })); }} />
        </div>
        <div className="field-row">
          <label className="field"><span>التاريخ</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>المسؤول</span><input required maxLength={120} value={person} onChange={(e) => setPerson(e.target.value)} /></label>
        </div>
        <label className="field"><span>الملاحظات{oldCondition !== 'good' && ' (مطلوبة)'}</span><textarea rows={2} required={oldCondition !== 'good'} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="eq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تبديل وطباعة نموذج الاستلام'}</button>
        </div>
      </form>
    </Modal>
  );
}
