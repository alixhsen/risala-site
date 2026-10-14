import { useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLoad } from '../App.jsx';
import PostCard from '../components/PostCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 12;

export default function Activities() {
  const [page, setPage] = useState(1);
  const topRef = useRef(null);
  const { data, loading, error } = useLoad(`/public/posts?category=activity&page=${page}&limit=${PAGE_SIZE}`, { items: [], total: 0 });
  const posts = data.items || [];
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  function changePage(p) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        kicker="جاهزية دائمة"
        title="أنشطتنا"
        lead="مناورات وتدريبات ومواكبات يقوم بها الفريق لرفع جاهزيته وتطوير مهارات أعضائه باستمرار."
        count={loading ? '' : `${data.total ?? 0} نشاط موثّق`}
      />

      <section className="wrap section tight" ref={topRef}>
        {error && <p className="error">{error}</p>}
        {!loading && !error && posts.length === 0 && <p className="muted">لا أنشطة بعد.</p>}
        <div className="post-grid">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        <Pagination page={page} totalPages={totalPages} onChange={changePage} />
      </section>
    </>
  );
}
