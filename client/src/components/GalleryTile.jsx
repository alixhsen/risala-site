import { Expand } from 'lucide-react';
import useReveal from '../hooks/useReveal.js';

// One gallery photo. Clicking opens the viewer in place (via onOpen), never a new tab.
export default function GalleryTile({ photo, i = 0, onOpen, large = false }) {
  const ref = useReveal();
  return (
    <button
      ref={ref}
      type="button"
      className={`gallery-tile reveal${large ? ' large' : ''}`}
      style={{ transitionDelay: `${Math.min(i, 8) * 50}ms` }}
      onClick={() => onOpen(i)}
      aria-label={photo.caption ? `عرض: ${photo.caption}` : 'عرض الصورة'}
    >
      <img src={photo.url} alt={photo.caption || ''} loading="lazy" />
      <span className="gallery-tile-zoom" aria-hidden="true"><Expand size={18} /></span>
      {photo.caption && <span className="gallery-tile-caption">{photo.caption}</span>}
    </button>
  );
}
