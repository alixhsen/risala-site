import { useState } from 'react';
import { Play } from 'lucide-react';
import useReveal from '../hooks/useReveal.js';
import Lightbox from './Lightbox.jsx';

const delayStyle = (i, step = 60) => ({ transitionDelay: `${Math.min(i, 10) * step}ms` });

// A single photo tile - the first one in the set is shown larger on wide
// screens, so the wall reads as a curated layout rather than a flat grid.
function PhotoTile({ item, i, featured, onOpen }) {
  const ref = useReveal();
  return (
    <button
      ref={ref}
      type="button"
      className={`pd-gallery-photo reveal${featured ? ' featured' : ''}`}
      style={delayStyle(i)}
      onClick={onOpen}
      aria-label="عرض الصورة"
    >
      <img src={item.url} alt="" loading="lazy" />
    </button>
  );
}

// A video gets its own full-width 16:9 card with visible controls, instead of
// being squeezed into a small square photo tile.
function VideoTile({ item, i }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="pd-gallery-video reveal" style={delayStyle(i)}>
      <video src={item.url} controls preload="metadata" />
      <span className="pd-gallery-video-badge"><Play size={13} aria-hidden="true" /> فيديو</span>
    </div>
  );
}

export default function MediaMasonry({ items }) {
  const [viewer, setViewer] = useState(null);
  if (!items?.length) return null;

  const photos = items.filter((m) => m.kind !== 'video');
  const videos = items.filter((m) => m.kind === 'video');

  return (
    <div className="pd-gallery-wall">
      {photos.length > 0 && (
        <div className="pd-gallery-photos">
          {photos.map((item, i) => (
            <PhotoTile key={item.id ?? item.url} item={item} i={i} featured={i === 0 && photos.length > 2} onOpen={() => setViewer(i)} />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="pd-gallery-videos">
          {videos.map((item, i) => <VideoTile key={item.id ?? item.url} item={item} i={i} />)}
        </div>
      )}
      <Lightbox items={photos} index={viewer} onClose={() => setViewer(null)} onChange={setViewer} />
    </div>
  );
}
