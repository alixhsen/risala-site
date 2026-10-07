import { useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

// Full-screen image viewer. `items` is [{url, caption}], `index` is the open
// item (null = closed). Opens in place, never in a new tab.
export default function Lightbox({ items, index, onClose, onChange }) {
  const open = index !== null && index !== undefined && items.length > 0;
  const count = items.length;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index - 1 + count) % count);
      if (e.key === 'ArrowLeft') onChange((index + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, index, count, onClose, onChange]);

  if (!open) return null;
  const item = items[index];

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="عرض الصورة" onClick={onClose}>
      <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox-count">{index + 1} / {count}</span>
        <button type="button" className="lightbox-btn" aria-label="إغلاق" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </div>

      <figure className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <img src={item.url} alt={item.caption || ''} />
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>

      {count > 1 && (
        <>
          <button type="button" className="lightbox-nav next" aria-label="الصورة التالية" onClick={(e) => { e.stopPropagation(); onChange((index + 1) % count); }}>
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
          <button type="button" className="lightbox-nav prev" aria-label="الصورة السابقة" onClick={(e) => { e.stopPropagation(); onChange((index - 1 + count) % count); }}>
            <ChevronRight size={26} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
