import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import { api, CATEGORIES, CATEGORY_LABELS, STATUS, formatDate } from '../../lib/api.js';

const MAX_PINNED = 3;

export default function Posts() {
  const { confirm, notify } = useDialog();
  const { isAdmin } = useAdmin();
  const [category, setCategory] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, reload } = useLoad('/admin/posts', []);
  const shown = category ? data.filter((p) => p.category === category) : data;
  const pinnedCount = useMemo(() => data.filter((p) => p.pinned).length, [data]);

  async function remove(post) {
    if (!(await confirm(`حذف "${post.title}" نهائياً؟`, { danger: true }))) return;
    await api(`/admin/posts/${post.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  async function togglePin(post) {
    const pin = !post.pinned;
    if (pin && pinnedCount >= MAX_PINNED) {
      notify(`يمكن تثبيت ${MAX_PINNED} منشورات كحد أقصى. ألغِ تثبيت واحد أولاً.`);
      return;
    }
    setBusyId(post.id);
    await api(`/admin/posts/${post.id}/pin`, { method: 'PUT', body: { pinned: pin } }).catch((err) => notify(err.message));
    setBusyId(null);
    reload();
  }

  return (
    <>
      <div className="page-head">
        <h1>المحتوى</h1>
        <div className="actions">
          {Object.entries(CATEGORY_LABELS).map(([key, l]) => (
            <Link key={key} className="btn primary" to={`/admin/posts/new?category=${key}`}>{l.new}</Link>
          ))}
        </div>
      </div>

      <p className="hint">
        المثبّتة في أعلى القوائم العامة: {pinnedCount}/{MAX_PINNED}
        {pinnedCount >= MAX_PINNED && ' — ألغِ تثبيت منشور لتثبيت آخر.'}
      </p>

      <div className="chips">
        <button className={category === '' ? 'on' : ''} onClick={() => setCategory('')}>الكل</button>
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <button key={key} className={category === key ? 'on' : ''} onClick={() => setCategory(key)}>{label}</button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {!loading && shown.length === 0 && <p className="muted">لا محتوى بعد.</p>}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>الغلاف</th><th>العنوان</th><th>النوع</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.pinned ? 'is-pinned' : ''}>
                  <td>{p.cover_url ? <img className="thumb" src={p.cover_url} alt="" /> : <div className="thumb" />}</td>
                  <td>
                    <Link to={`/admin/posts/${p.id}`}>{p.title}</Link>
                    {p.pinned && <span className="pin-badge"><Pin size={11} aria-hidden="true" /> مثبّت</span>}
                    <small>{p.author}</small>
                  </td>
                  <td>
                    {CATEGORIES[p.category]}
                    {p.mission_type_name && <small>{p.mission_type_name}</small>}
                    {p.paramedic_count > 0 && <small>{p.paramedic_count} مشاركين</small>}
                  </td>
                  <td><span className={`status ${p.status}`}>{STATUS[p.status]}</span></td>
                  <td>{formatDate(p.event_date || p.updated_at)}</td>
                  <td className="row-actions">
                    {isAdmin && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => togglePin(p)}
                        disabled={busyId === p.id || (!p.pinned && pinnedCount >= MAX_PINNED)}
                        title={p.pinned ? 'إلغاء التثبيت' : `تثبيت (${pinnedCount}/${MAX_PINNED})`}
                      >
                        {p.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {p.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                      </button>
                    )}
                    <Link to={`/admin/posts/${p.id}`}>تعديل</Link>
                    {isAdmin && <button className="link danger" onClick={() => remove(p)}>حذف</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
