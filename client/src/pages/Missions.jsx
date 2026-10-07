import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Siren, ArrowLeft, Calendar, Users, Search } from 'lucide-react';
import { useLoad } from '../App.jsx';
import { formatDate } from '../lib/api.js';
import PostCard from '../components/PostCard.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Missions() {
  const [typeId, setTypeId] = useState('');
  const types = useLoad('/public/mission-types', []);
  const { data, loading, error } = useLoad(
    `/public/posts?category=mission${typeId ? `&type=${typeId}` : ''}&limit=60`, []
  );
  const activeType = types.data.find((t) => String(t.id) === typeId);
  const [lead, ...rest] = data;
  const count = loading ? '' : `${data.length} ${activeType ? activeType.name : 'مهمة'}${typeId ? '' : ' مسجّلة'}`;

  return (
    <>
      <PageHeader
        icon={Siren}
        kicker="سجلّ العمليات"
        title="مهامّنا"
        lead="كل عملية ميدانية استجاب لها الفريق، موثّقة بتاريخها ونوعها وفريق الاستجابة."
        count={count}
      />

      <section className="wrap section tight">
        {types.data.length > 0 && (
          <div className="mlist-toolbar" role="group" aria-label="تصفية حسب النوع">
            <button type="button" className={`type-filter-btn ${typeId === '' ? 'on' : ''}`} onClick={() => setTypeId('')}>الكل</button>
            {types.data.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`type-filter-btn ${typeId === String(t.id) ? 'on' : ''}`}
                style={{ '--dot': t.color }}
                onClick={() => setTypeId(String(t.id))}
              >
                <span className="type-filter-dot" aria-hidden="true" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {!loading && !error && data.length === 0 && (
          <div className="mlist-empty">
            <span className="mlist-empty-icon"><Search size={26} aria-hidden="true" /></span>
            <h2>لا مهام {activeType ? `من نوع "${activeType.name}"` : 'بعد'}</h2>
            <p>جرّب نوعاً آخر من التصفية، أو عُد لعرض كل المهام.</p>
          </div>
        )}

        {lead && (
          <Link to={`/missions/${lead.id}`} className="mlist-feature">
            <div className="mlist-feature-media">
              {lead.cover_url ? <img src={lead.cover_url} alt="" /> : <div className="cover-empty" />}
            </div>
            <div className="mlist-feature-body">
              <span className="mlist-kicker">أحدث مهمّة</span>
              {lead.mission_type_name && <TypeBadge name={lead.mission_type_name} color={lead.mission_type_color} />}
              <h2>{lead.title}</h2>
              {lead.summary && <p>{lead.summary}</p>}
              <div className="mlist-meta">
                <span><Calendar size={14} aria-hidden="true" /> {formatDate(lead.event_date || lead.published_at)}</span>
                {lead.paramedic_count > 0 && <span><Users size={14} aria-hidden="true" /> {lead.paramedic_count} مشاركين</span>}
              </div>
              <span className="mlist-go">تفاصيل المهمة <ArrowLeft size={16} aria-hidden="true" /></span>
            </div>
          </Link>
        )}

        {rest.length > 0 && <div className="post-grid mlist-grid">{rest.map((p) => <PostCard key={p.id} post={p} />)}</div>}
      </section>
    </>
  );
}
