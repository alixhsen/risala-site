import { Newspaper } from 'lucide-react';
import { useLoad } from '../App.jsx';
import NewsRow from '../components/NewsRow.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function News() {
  const { data, loading, error } = useLoad('/public/posts?category=news&limit=60', []);

  return (
    <>
      <PageHeader
        icon={Newspaper}
        kicker="آخر المستجدات"
        title="الأخبار والإعلانات"
        lead="كل جديد الفريق والجمعية: بيانات، إعلانات، ومستجدات تهمّ المتابعين."
        count={loading ? '' : `${data.length} خبر منشور`}
      />

      <section className="wrap section tight">
        {error && <p className="error">{error}</p>}
        {!loading && !error && data.length === 0 && <p className="muted">لا أخبار بعد.</p>}
        <div className="news-list">
          {data.map((p, i) => <NewsRow key={p.id} post={p} i={i} />)}
        </div>
      </section>
    </>
  );
}
