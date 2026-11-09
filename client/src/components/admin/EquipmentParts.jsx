// Small pieces shared by the equipment & custody pages.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { MEMBER_STATUS, isActiveMember, alertText, memberNo } from '../../lib/equipment.js';

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
  const [active, setActive] = useState(0);
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

  const pick = (m) => { onChange(m.id); setOpen(false); setText(''); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

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
        <input type="search" value={text} placeholder={placeholder} aria-label="بحث عن عضو" onFocus={() => setOpen(true)} onKeyDown={onKeyDown} onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }} />
      </label>
      {open && (
        <ul className="eq-picker-list" role="listbox">
          <li className="eq-picker-count" aria-hidden="true">{matches.length === 0 ? 'لا نتائج مطابقة' : `${matches.length} ${matches.length === 1 ? 'نتيجة' : 'نتائج'}${matches.length === 40 ? ' (الأولى — ضيّق البحث)' : ''}`}</li>
          {matches.map((m, i) => (
            <li key={m.id}>
              <button type="button" role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(m)}>
                <span className="eq-picker-main">
                  <strong>{m.name}</strong>
                  <small>{memberNo(m.id)}{m.phone && <> · <bdi dir="ltr">{m.phone}</bdi></>}{m.group_name && ` · ${m.group_name}`}</small>
                </span>
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
