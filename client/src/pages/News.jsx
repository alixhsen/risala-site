import { useRef, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useLoad } from '../App.jsx';
import NewsRow from '../components/NewsRow.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 10;

export default function News() {
  const [page, setPage] = useState(1);
  const topRef = useRef(null);
  const { data, loading, error } = useLoad(`/public/posts?category=news&page=${page}&limit=${PAGE_SIZE}`, { items: [], total: 0 });
  const posts = data.items || [];
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  function changePage(p) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <PageHeader
        icon={Newspaper}
        kicker="آخر المستجدات"
        title="الأخبار والإعلانات"
        lead="كل جديد الفريق والجمعية: بيانات، إعلانات، ومستجدات تهمّ المتابعين."
        count={loading ? '' : `${data.total ?? 0} خبر منشور`}
      />

      <section className="wrap section tight" ref={topRef}>
        {error && <p className="error">{error}</p>}
        {!loading && !error && posts.length === 0 && <p className="muted">لا أخبار بعد.</p>}
        <div className="news-list">
          {posts.map((p, i) => <NewsRow key={p.id} post={p} i={i} />)}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={changePage} />
      </section>
    </>
  );
}
