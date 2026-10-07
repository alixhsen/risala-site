import { Link, useParams } from 'react-router-dom';
import { Calendar, Users, Tag, Siren } from 'lucide-react';
import { useLoad } from '../App.jsx';
import { formatDate } from '../lib/api.js';
import TypeBadge from '../components/TypeBadge.jsx';
import DetailPage from '../components/DetailPage.jsx';

export default function MissionDetail() {
  const { id } = useParams();
  const { data: post, loading, error } = useLoad(`/public/posts/${encodeURIComponent(id)}`, null);
  const related = useLoad('/public/posts?category=mission&limit=4', []);

  if (loading) return <section className="wrap section"><p className="muted">جارٍ التحميل…</p></section>;
  if (error || !post || post.category !== 'mission') {
    return (
      <section className="wrap section center">
        <div className="empty-state">
          <h1>المهمة غير موجودة</h1>
          <p>ربما أُزيلت، أو أن الرابط غير صحيح.</p>
          <Link className="btn primary" to="/missions">العودة إلى المهام</Link>
        </div>
      </section>
    );
  }

  const crew = post.paramedics.length;
  const facts = [
    post.mission_type_name && [Tag, 'نوع المهمة', post.mission_type_name],
    [Calendar, 'التاريخ', formatDate(post.event_date || post.published_at) || '—'],
    [Users, 'المشاركون', crew ? `${crew} مسعف` : '—'],
  ].filter(Boolean);

  const aside = (
    <>
      <h2>فريق الاستجابة</h2>
      {crew > 0
        ? (
          <div className="mi-crew-grid">
            {post.paramedics.map((p) => (
              <div key={p.id} className="mi-crew-card">
                <span className="mi-crew-photo">
                  {p.photo_url ? <img src={p.photo_url} alt="" /> : <span>{p.name.trim().charAt(0)}</span>}
                </span>
                <span className="mi-crew-name">{p.name}</span>
              </div>
            ))}
          </div>
        )
        : <p className="muted">لم تُسجَّل أسماء الفريق لهذه المهمة.</p>}
    </>
  );

  return (
    <DetailPage
      post={post}
      badge={post.mission_type_name ? <TypeBadge name={post.mission_type_name} color={post.mission_type_color} /> : null}
      backTo="/missions"
      backLabel="كل المهام"
      facts={facts}
      aside={aside}
      proseKicker="تفاصيل العملية"
      proseIcon={Siren}
      relatedTitle="مهام أخرى"
      relatedKicker="تابع القراءة"
      relatedIcon={Siren}
      relatedPosts={related.data}
      relatedBackTo="/missions"
      relatedBackLabel="كل المهام"
      emptyText="لا تفاصيل إضافية لهذه المهمة."
    />
  );
}
