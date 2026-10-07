import { ShieldCheck } from 'lucide-react';
import { useLoad } from '../App.jsx';
import PostCard from '../components/PostCard.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Activities() {
  const { data, loading, error } = useLoad('/public/posts?category=activity&limit=60', []);

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        kicker="جاهزية دائمة"
        title="أنشطتنا"
        lead="مناورات وتدريبات ومواكبات يقوم بها الفريق لرفع جاهزيته وتطوير مهارات أعضائه باستمرار."
        count={loading ? '' : `${data.length} نشاط موثّق`}
      />

      <section className="wrap section tight">
        {error && <p className="error">{error}</p>}
        {!loading && !error && data.length === 0 && <p className="muted">لا أنشطة بعد.</p>}
        <div className="post-grid">{data.map((p) => <PostCard key={p.id} post={p} />)}</div>
      </section>
    </>
  );
}
