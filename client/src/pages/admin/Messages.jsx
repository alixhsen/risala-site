import { useMemo, useState } from 'react';
import { MessageSquare, HeartHandshake, Phone, Check, RotateCcw, Trash2, Inbox } from 'lucide-react';
import { useDialog } from '../../components/admin/Dialog.jsx';
import { useLoad } from '../../App.jsx';
import { AdminHead } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { waLink } from '../../lib/links.js';

const KIND = {
  contact: { label: 'رسالة تواصل', icon: MessageSquare, tone: 'brand' },
  volunteer: { label: 'طلب تطوّع', icon: HeartHandshake, tone: 'gold' },
};
const kindOf = (m) => (m.kind === 'volunteer' ? 'volunteer' : 'contact');

export default function Messages() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/messages', []);
  const [status, setStatus] = useState('all'); // all | unread | read
  const [kind, setKind] = useState('all'); // all | contact | volunteer
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const counts = useMemo(() => ({
    all: data.length,
    unread: data.filter((m) => !m.is_read).length,
    volunteer: data.filter((m) => kindOf(m) === 'volunteer').length,
    contact: data.filter((m) => kindOf(m) === 'contact').length,
  }), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((m) => {
      if (status === 'unread' && m.is_read) return false;
      if (status === 'read' && !m.is_read) return false;
      if (kind !== 'all' && kindOf(m) !== kind) return false;
      if (!q) return true;
      return [m.name, m.phone, m.message].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, status, kind, search]);

  async function toggle(m) {
    setBusyId(m.id);
    await api(`/admin/messages/${m.id}`, { method: 'PUT', body: { is_read: !m.is_read } }).catch((err) => notify(err.message));
    setBusyId(null);
    reload();
  }

  async function remove(m) {
    if (!(await confirm(`حذف الرسالة من "${m.name}"؟`, { danger: true }))) return;
    await api(`/admin/messages/${m.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="التواصل"
        title="الرسائل"
        subtitle="رسائل التواصل وطلبات التطوّع الواردة من نموذج الموقع."
      />

      <StatTiles items={[
        { label: 'الإجمالي', value: counts.all, tone: 'brand' },
        { label: 'غير مقروءة', value: counts.unread, sub: 'بانتظار الرد', tone: 'warn' },
        { label: 'طلبات تطوّع', value: counts.volunteer, tone: 'gold' },
        { label: 'رسائل تواصل', value: counts.contact, tone: 'brand' },
      ]}
      />

      {error && <p className="error">{error}</p>}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الهاتف أو نص الرسالة">
        <ChipFilter
          label="الحالة"
          value={status}
          onChange={setStatus}
          options={[['all', 'الكل', counts.all], ['unread', 'غير مقروءة', counts.unread], ['read', 'مقروءة', counts.all - counts.unread]]}
        />
        <ChipFilter
          label="النوع"
          value={kind}
          onChange={setKind}
          options={[['all', 'الكل', counts.all], ['volunteer', 'طلبات تطوّع', counts.volunteer], ['contact', 'رسائل تواصل', counts.contact]]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Inbox} title="لا رسائل بعد" text="رسائل نموذج التواصل وطلبات التطوّع تظهر هنا فور وصولها." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر التصفية." />}

      {rows.length > 0 && (
        <div className="msg-list">
          {rows.map((m) => {
            const k = KIND[kindOf(m)];
            const Icon = k.icon;
            return (
              <article key={m.id} className={`msg-card tone-${k.tone}${m.is_read ? '' : ' unread'}`}>
                <span className="msg-avatar">{m.name.trim().charAt(0) || '؟'}</span>
                <div className="msg-body">
                  <header className="msg-head">
                    <strong>{m.name}</strong>
                    <span className="msg-kind"><Icon size={12} aria-hidden="true" /> {k.label}</span>
                    {!m.is_read && <span className="msg-dot" aria-hidden="true" />}
                    <time className="msg-time">{formatDate(m.created_at)}</time>
                  </header>
                  <p className="msg-text">{m.message}</p>
                  <div className="msg-actions">
                    {m.phone && (
                      <a className="msg-link" href={`tel:${m.phone}`}>
                        <Phone size={13} aria-hidden="true" /> <bdi>{m.phone}</bdi>
                      </a>
                    )}
                    {m.phone && (
                      <a className="msg-link" href={waLink(m.phone)} target="_blank" rel="noreferrer">الرد عبر واتساب</a>
                    )}
                    <span className="msg-actions-gap" />
                    <IconButton
                      icon={m.is_read ? RotateCcw : Check}
                      label={m.is_read ? 'تعليم كغير مقروءة' : 'تعليم كمقروءة'}
                      onClick={() => toggle(m)}
                      disabled={busyId === m.id}
                      tone={m.is_read ? 'default' : 'brand'}
                    />
                    <IconButton icon={Trash2} label="حذف الرسالة" onClick={() => remove(m)} tone="danger" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
