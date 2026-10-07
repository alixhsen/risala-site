import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Calendar } from 'lucide-react';
import PostCard from './PostCard.jsx';
import MediaMasonry from './MediaMasonry.jsx';
import Kicker from './Kicker.jsx';
import ShareBox from './ShareBox.jsx';
import useReveal from '../hooks/useReveal.js';
import { formatDate } from '../lib/api.js';

// The one detail layout used by every detail page (missions, activities, news):
// hero with a badge and title, a facts strip, the text beside a side card,
// the media wall, and related items.
export default function DetailPage({
  post,
  badge,
  backTo,
  backLabel,
  facts,
  aside,
  proseKicker,
  proseIcon,
  relatedTitle,
  relatedKicker,
  relatedIcon,
  relatedPosts,
  relatedBackTo,
  relatedBackLabel,
  emptyText = 'لا تفاصيل إضافية.',
}) {
  const infoRef = useReveal();
  const proseRef = useReveal();
  const EmptyCoverIcon = proseIcon;
  const dateValue = formatDate(post.event_date || post.published_at);
  const paragraphs = (post.body || post.summary || '').split(/\n+/).filter(Boolean);
  const others = relatedPosts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <article>
      <header className={`mission-hero${post.cover_url ? '' : ' no-cover'}`}>
        {post.cover_url
          ? <img className="mission-hero-img" src={post.cover_url} alt="" />
          : EmptyCoverIcon && (
            <span className="mission-hero-empty-icon" aria-hidden="true">
              <EmptyCoverIcon size={96} strokeWidth={1.3} />
            </span>
          )}
        <div className="wrap mission-hero-overlay">
          <Link to={backTo} className="mi-back"><ArrowRight size={15} aria-hidden="true" /> {backLabel}</Link>
          {badge}
          <h1>{post.title}</h1>
          <div className="mission-hero-meta">
            <span><Calendar size={15} aria-hidden="true" /> {dateValue}</span>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div ref={infoRef} className="mi-facts reveal">
          {facts.map(([Icon, label, value]) => (
            <div key={label} className="mi-fact">
              <span className="mi-fact-icon"><Icon size={18} aria-hidden="true" /></span>
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="wrap mi-body">
        <div ref={proseRef} className="mi-main reveal">
          <Kicker icon={proseIcon}>{proseKicker}</Kicker>
          <div className="prose">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            {paragraphs.length === 0 && <p className="muted">{emptyText}</p>}
          </div>

          {post.images.length > 0 && (
            <div className="mission-media">
              <div className="bar-title media-bar-title">
                <h3>الصور والفيديوهات</h3>
                <span className="media-count">{post.images.length} عنصر</span>
                <span className="media-hint"><ArrowLeft size={14} aria-hidden="true" /> اسحب لعرض المزيد</span>
              </div>
              <MediaMasonry items={post.images} />
            </div>
          )}
        </div>

        {/* On mobile this sits right after the content, before related posts -
            readers meet the crew that responded before being steered elsewhere.
            On desktop it becomes the sticky sidebar spanning both rows. */}
        <aside className="mi-crew">
          {aside}
          <ShareBox postId={post.id} title={post.title} coverUrl={post.cover_url} />
        </aside>

        {others.length > 0 && (
          <div className="mi-related">
            <div className="section-head">
              <div>
                <Kicker icon={relatedIcon}>{relatedKicker}</Kicker>
                <h2>{relatedTitle}</h2>
              </div>
              <Link to={relatedBackTo}>{relatedBackLabel} <ArrowLeft size={15} aria-hidden="true" /></Link>
            </div>
            <div className="post-grid">{others.map((p) => <PostCard key={p.id} post={p} />)}</div>
          </div>
        )}
      </div>

      <div className="wrap mission-detail-footer">
        <Link to={backTo} className="back-link"><ArrowRight size={16} aria-hidden="true" /> {backLabel}</Link>
      </div>
    </article>
  );
}
