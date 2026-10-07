import { Link, useParams } from 'react-router-dom';
import { Calendar, Tag, Images, ShieldCheck, Newspaper, Activity } from 'lucide-react';
import { useLoad } from '../App.jsx';
import { CATEGORIES, formatDate } from '../lib/api.js';
import DetailPage from '../components/DetailPage.jsx';

const COPY = {
  activity: { back: '/activities', backLabel: 'كل الأنشطة', related: 'أنشطة أخرى', kicker: 'نشاط آخر', icon: ShieldCheck, proseIcon: Activity },
  news: { back: '/news', backLabel: 'كل الأخبار', related: 'أخبار أخرى', kicker: 'خبر آخر', icon: Newspaper, proseIcon: Newspaper },
};

// Activity and news detail pages, built on the same layout as the missions.
export default function PostDetail({ category = 'activity' }) {
  const { id } = useParams();
  const { data: post, loading, error } = useLoad(`/public/posts/${encodeURIComponent(id)}`, null);
  const related = useLoad(`/public/posts?category=${category}&limit=4`, []);
  const copy = COPY[category];

  if (loading) return <section className="wrap section"><p className="muted">جارٍ التحميل…</p></section>;
  if (error || !post || post.category !== category) {
    return (
      <section className="wrap section center">
        <div className="empty-state">
          <h1>المنشور غير موجود</h1>
          <p>ربما أُزيل، أو أن الرابط غير صحيح.</p>
          <Link className="btn primary" to={copy.back}>{copy.backLabel}</Link>
        </div>
      </section>
    );
  }

  const photoCount = post.images.length;
  const facts = [
    [Tag, 'التصنيف', CATEGORIES[post.category] || '—'],
    [Calendar, 'التاريخ', formatDate(post.event_date || post.published_at) || '—'],
    [Images, 'الصور والفيديوهات', photoCount ? `${photoCount} عنصر` : '—'],
  ];

  return (
    <DetailPage
      post={post}
      badge={<span className="tag">{CATEGORIES[post.category]}</span>}
      backTo={copy.back}
      backLabel={copy.backLabel}
      facts={facts}
      proseKicker={CATEGORIES[post.category]}
      proseIcon={copy.proseIcon}
      relatedTitle={copy.related}
      relatedKicker={copy.kicker}
      relatedIcon={copy.icon}
      relatedPosts={related.data}
      relatedBackTo={copy.back}
      relatedBackLabel={copy.backLabel}
      emptyText="لا تفاصيل إضافية لهذا المنشور."
    />
  );
}
