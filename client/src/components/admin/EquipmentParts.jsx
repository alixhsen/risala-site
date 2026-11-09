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

// One item line: type -> size / serial -> quantity. Types with stock tracking
// are picked from the warehouse (their lines carry the available quantity);
// untracked types are issued directly, so size and serial are simply chosen
// or typed. `value` = { type_id, inventory_id, size, serial_number, quantity }.
export function ItemPicker({ types, lines, value, onChange, max }) {
  const type = types.find((t) => t.id === Number(value.type_id));
  const stocked = (t) => lines.some((l) => l.type_id === t.id && l.in_stock > 0);
  const tracked = type?.tracks_stock;
  const options = tracked ? lines.filter((l) => l.type_id === type.id && l.in_stock > 0) : [];
  const line = tracked ? lines.find((l) => l.id === Number(value.inventory_id)) : null;
  const single = type && type.tracks_serial; // one unit per serial number
  const limit = tracked ? (line ? max : 0) : (single ? 1 : undefined);

  const pickType = (id) => {
    const t = types.find((x) => x.id === Number(id));
    const opts = t?.tracks_stock ? lines.filter((l) => l.type_id === t.id && l.in_stock > 0) : [];
    onChange({ type_id: id, inventory_id: opts.length === 1 ? String(opts[0].id) : '', size: '', serial_number: '', quantity: 1 });
  };

  return (
    <>
      <label className="field"><span>الغرض</span>
        <select value={value.type_id} onChange={(e) => pickType(e.target.value)}>
          <option value="">— اختر —</option>
          {types.filter((t) => t.active).map((t) => {
            const ok = !t.tracks_stock || stocked(t);
            return <option key={t.id} value={t.id} disabled={!ok}>{t.name}{ok ? '' : ' — لا مخزون'}</option>;
          })}
        </select>
      </label>
      <div className="field">
        <span>{type?.tracks_serial ? 'الرقم التسلسلي' : 'المقاس'}</span>
        {!type && <select disabled><option>— اختر الغرض أولاً —</option></select>}
        {tracked && (
          <select value={value.inventory_id} onChange={(e) => onChange({ inventory_id: e.target.value, quantity: 1 })}>
            <option value="">— اختر —</option>
            {options.map((l) => <option key={l.id} value={l.id}>{[l.serial_number && `رقم ${l.serial_number}`, l.size, `متوفر ${l.in_stock}`].filter(Boolean).join(' · ')}</option>)}
          </select>
        )}
        {type && !tracked && (
          <div className="eq-direct">
            {type.sizes.length > 0 && (
              <select value={value.size} onChange={(e) => onChange({ size: e.target.value })} aria-label="المقاس">
                <option value="">— المقاس —</option>
                {type.sizes.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
              </select>
            )}
            {type.tracks_serial && <input dir="ltr" maxLength={80} placeholder="الرقم التسلسلي" aria-label="الرقم التسلسلي" value={value.serial_number} onChange={(e) => onChange({ serial_number: e.target.value })} />}
            {type.sizes.length === 0 && !type.tracks_serial && <input disabled value="لا مقاس ولا رقم" aria-label="لا مقاس" />}
          </div>
        )}
      </div>
      <label className="field"><span>الكمية{tracked && line && <small> (المتاح {max})</small>}</span>
        <input type="number" min="1" max={limit || undefined} required value={value.quantity} disabled={!type || (tracked && !line) || single}
          onChange={(e) => onChange({ quantity: e.target.value })} />
      </label>
    </>
  );
}

// What the API expects for a picked item.
export const itemSpec = (v, types) => {
  const t = types.find((x) => x.id === Number(v.type_id));
  if (!t) return null;
  if (t.tracks_stock) return v.inventory_id ? { inventory_id: Number(v.inventory_id) } : null;
  return { type_id: t.id, size: v.size, serial_number: v.serial_number };
};
