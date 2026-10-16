import { Link } from 'react-router-dom';
import { ArrowLeft, Pin } from 'lucide-react';
import { formatDate } from '../lib/api.js';
import useReveal from '../hooks/useReveal.js';

// News and announcements read best as a dated list, not a grid of cards.
export default function NewsRow({ post, i = 0 }) {
  const ref = useReveal();
  return (
    <Link ref={ref} to={`/news/${post.id}`} className="news-row reveal" style={{ transitionDelay: `${Math.min(i, 8) * 50}ms` }}>
      <time className="news-date" dateTime={post.published_at}>{formatDate(post.event_date || post.published_at)}</time>
      <div className="news-body">
        <h3>{!!post.pinned && <span className="pin-flag inline"><Pin size={11} aria-hidden="true" /> مثبّت</span>}{post.title}</h3>
        {post.summary && <p>{post.summary}</p>}
      </div>
      <ArrowLeft className="news-arrow" size={20} aria-hidden="true" />
    </Link>
  );
}
