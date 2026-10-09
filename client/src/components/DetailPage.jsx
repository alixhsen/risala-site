import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Pin } from 'lucide-react';
import PostCard from './PostCard.jsx';
import MediaMasonry from './MediaMasonry.jsx';
import Kicker from './Kicker.jsx';
import ShareBox from './ShareBox.jsx';
import useReveal from '../hooks/useReveal.js';

// The one detail layout used by every detail page (missions, activities, news):
// a plain editorial header (title, lead, stat chips), a large unobstructed
// cover photo with nothing printed on top of it, then the write-up beside a
// sticky crew/share sidebar, the media gallery and related posts.
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
  const coverRef = useReveal();
  const bodyRef = useReveal();
  const EmptyCoverIcon = proseIcon;
  const paragraphs = (post.body || post.summary || '').split(/\n+/).filter(Boolean);
  const others = relatedPosts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <article className="pd">
      <div className="wrap pd-topbar">
        <Link to={backTo} className="pd-back"><ArrowRight size={15} aria-hidden="true" /> {backLabel}</Link>
        {post.pinned && <span className="pd-pinned"><Pin size={12} aria-hidden="true" /> مثبّت</span>}
      </div>

      <div className="wrap pd-head">
        {badge}
        <h1>{post.title}</h1>
        {facts.length > 0 && (
          <div className="pd-meta">
            {facts.map(([Icon, label, value]) => (
              <span key={label} className="pd-meta-item">
                <Icon size={16} aria-hidden="true" />
                <span className="pd-meta-text"><small>{label}</small><strong>{value}</strong></span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* A plain, fully visible cover photo - nothing is printed on top of it,
          so it never has to be cropped or darkened to keep text legible, and
          it can be shown generously large on wide desktop windows. */}
      <div className="wrap">
        <div ref={coverRef} className={`pd-cover reveal${post.cover_url ? '' : ' no-cover'}`}>
          {post.cover_url
            ? <img src={post.cover_url} alt="" />
            : EmptyCoverIcon && <EmptyCoverIcon className="pd-cover-icon" size={104} strokeWidth={1.2} aria-hidden="true" />}
        </div>
      </div>

      <div ref={bodyRef} className="wrap pd-body reveal">
        <div className="pd-main">
          <Kicker icon={proseIcon}>{proseKicker}</Kicker>
          <div className="prose">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            {paragraphs.length === 0 && <p className="muted">{emptyText}</p>}
          </div>

          {post.images.length > 0 && (
            <div className="pd-gallery">
              <div className="bar-title pd-gallery-title">
                <h3>الصور والفيديوهات</h3>
                <span className="pd-gallery-count">{post.images.length} عنصر</span>
                <span className="pd-gallery-hint"><ArrowLeft size={14} aria-hidden="true" /> اسحب لعرض المزيد</span>
              </div>
              <MediaMasonry items={post.images} />
            </div>
          )}
        </div>

        {/* On mobile this sits right after the content, before related posts -
            readers meet the crew that responded before being steered elsewhere.
            On desktop it becomes the sticky sidebar spanning both rows. */}
        <aside className="pd-aside">
          {aside}
          <ShareBox postId={post.id} title={post.title} coverUrl={post.cover_url} />
        </aside>

        {others.length > 0 && (
          <div className="pd-related">
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

      <div className="wrap pd-footer">
        <Link to={backTo} className="pd-footer-link"><ArrowRight size={16} aria-hidden="true" /> {backLabel}</Link>
      </div>
    </article>
  );
}
