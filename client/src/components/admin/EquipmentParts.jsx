// Small pieces shared by the equipment & custody pages.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { MEMBER_STATUS, isActiveMember, alertText } from '../../lib/equipment.js';

export function StatusBadge({ status }) {
  const active = isActiveMember(status);
  return <span className={`eq-badge ${active ? 'ok' : 'bad'}`}>{MEMBER_STATUS[status] || MEMBER_STATUS.active}</span>;
}

// The red notice shown wherever an ex-member still holds items.
export function CustodyAlert({ status, outstanding }) {
  const text = alertText(status, outstanding);
  if (!text) return null;
  return (
    <div className="eq-alert" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

// Search-and-pick a member from the existing roster (never a second member list).
export function MemberPicker({ members, value, onChange, placeholder = 'ابحث بالاسم أو رقم الهاتف أو رقم العضو…', allowInactive = true }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const selected = members.find((m) => m.id === value);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return members
      .filter((m) => (allowInactive || isActiveMember(m.member_status)))
      .filter((m) => !q || `${m.name} ${m.phone || ''} ${m.id}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [members, text, allowInactive]);

  if (selected && !open) {
    return (
      <div className="eq-picked">
        <div>
          <strong>{selected.name}</strong>
          <StatusBadge status={selected.member_status} />
        </div>
        <button type="button" className="icon-btn" aria-label="تغيير العضو" onClick={() => { onChange(null); setText(''); setOpen(true); }}><X size={15} aria-hidden="true" /></button>
      </div>
    );
  }
  return (
    <div className="eq-picker" ref={box}>
      <label className="filter-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={text} placeholder={placeholder} aria-label="بحث عن عضو" onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); }} />
      </label>
      {open && (
        <ul className="eq-picker-list" role="listbox">
          {matches.length === 0 && <li className="eq-picker-empty">لا نتائج</li>}
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" role="option" aria-selected={m.id === value} onClick={() => { onChange(m.id); setOpen(false); setText(''); }}>
                <span><strong>{m.name}</strong>{m.phone && <small><bdi dir="ltr">{m.phone}</bdi></small>}</span>
                <span className="eq-picker-meta">
                  {m.outstanding > 0 && <em>{m.outstanding} بحوزته</em>}
                  {!isActiveMember(m.member_status) && <StatusBadge status={m.member_status} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog eq-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="eq-modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="إغلاق" onClick={onClose}><X size={16} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Fetches a receipt form's data and either downloads or prints it.
export async function openVoucher(settings, issueId, mode = 'download') {
  const [{ buildVoucherPdf, voucherFilename }, { savePdf, printPdf }, data] = await Promise.all([
    import('../../lib/equipmentVoucher.js'),
    import('../../lib/tablePdf.js'),
    api(`/admin/equipment/issues/${issueId}`),
  ]);
  const pdf = await buildVoucherPdf({ settings, issue: { ...data.issue, id: issueId }, items: data.items });
  if (mode === 'print') printPdf(pdf);
  else savePdf(pdf, voucherFilename({ ...data.issue, id: issueId }));
}

export const useEqAccess = (admin) => ({
  canHandle: admin.isAdmin || admin.permissions.includes('equipment-handle'),
  canManage: admin.isAdmin || admin.permissions.includes('equipment-types'),
});
