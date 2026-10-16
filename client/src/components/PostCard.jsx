import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Pin } from 'lucide-react';
import { CATEGORIES, formatDate } from '../lib/api.js';
import TypeBadge from './TypeBadge.jsx';
import useReveal from '../hooks/useReveal.js';

export default function PostCard({ post }) {
  const base = post.category === 'mission' ? 'missions' : post.category === 'news' ? 'news' : 'activities';
  const ref = useReveal();
  return (
    <Link ref={ref} to={`/${base}/${post.id}`} className="post-card reveal">
      <div className="post-cover">
        {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" /> : <div className="cover-empty" />}
        {!!post.pinned && <span className="pin-flag"><Pin size={12} aria-hidden="true" /> مثبّت</span>}
        {post.category === 'mission' && post.mission_type_name
          ? <TypeBadge name={post.mission_type_name} color={post.mission_type_color} />
          : <span className="tag">{CATEGORIES[post.category] || 'نشاط'}</span>}
      </div>
      <div className="post-body">
        <h3>{post.title}</h3>
        {post.summary && <p>{post.summary}</p>}
        <div className="post-meta">
          <time>{formatDate(post.event_date || post.published_at)}</time>
          {post.paramedic_count > 0 && <span className="post-meta-count"><Users size={14} /> {post.paramedic_count}</span>}
        </div>
        <span className="post-card-cta">التفاصيل <ArrowLeft size={14} /></span>
      </div>
    </Link>
  );
}
