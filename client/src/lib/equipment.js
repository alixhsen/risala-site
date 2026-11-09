// Shared constants and helpers for the equipment & custody section.

export const MEMBER_STATUS = {
  active: 'فعّال',
  suspended: 'متوقف عن الخدمة',
  withdrawn: 'منسحب',
  dismissed: 'مفصول من الفرقة',
  inactive: 'غير فعّال',
};
export const isActiveMember = (status) => !status || status === 'active';

export const KIND_LABELS = {
  issue: 'تسليم',
  return: 'استرجاع',
  replace: 'تبديل',
  adjust: 'تعديل كمية',
  damaged: 'تسجيل تلف',
  lost: 'تسجيل فقدان',
};
export const KIND_TONE = { issue: 'warn', return: 'ok', replace: 'brand', adjust: 'gray', damaged: 'bad', lost: 'bad' };

export const CONDITION_LABELS = {
  good: 'سليم',
  needs_maintenance: 'يحتاج صيانة',
  damaged: 'تالف',
  lost: 'مفقود',
};

// Member number shown on forms: the member's id in the existing roster.
export const memberNo = (id) => `M-${String(id).padStart(4, '0')}`;

// "تنبيه: هذا العضو متوقف عن الخدمة، ولا تزال لديه 3 أغراض غير مسترجعة"
export function alertText(status, outstanding) {
  if (isActiveMember(status) || !outstanding) return '';
  const state = {
    suspended: 'متوقف عن الخدمة',
    withdrawn: 'منسحب من الفرقة',
    dismissed: 'مفصول من الفرقة',
    inactive: 'غير فعّال',
  }[status] || MEMBER_STATUS[status];
  const noun = outstanding === 1 ? 'غرض واحد' : outstanding === 2 ? 'غرضان' : `${outstanding} أغراض`;
  const verb = outstanding === 1 ? 'غير مسترجع' : 'غير مسترجعة';
  return `تنبيه: هذا العضو ${state}، ولا يزال لديه ${noun} ${verb}`;
}

export const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

// SQLite's datetime('now') is UTC without a zone marker.
export function formatDateTime(v) {
  if (!v) return '';
  const d = new Date(`${String(v).replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ar-LB', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const stockLabel = (line) => [line.type_name, line.size, line.serial_number ? `رقم ${line.serial_number}` : ''].filter(Boolean).join(' · ');
