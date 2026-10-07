import { useCallback, useRef } from 'react';

// Attaches `.in-view` once an element with the `reveal` class scrolls into
// the viewport, so the CSS fade/slide-up transition can play. Returns a
// callback ref (not useRef+useEffect) so it still works correctly when the
// element itself only mounts later - e.g. inside `{data && <el ref={...}>}`
// once async data arrives, which a mount-only effect would miss entirely.
export default function useReveal() {
  const observer = useRef(null);
  if (!observer.current && typeof IntersectionObserver !== 'undefined') {
    observer.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in-view');
        observer.current.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
  }
  return useCallback((node) => {
    if (!node) return;
    if (observer.current) observer.current.observe(node);
    else node.classList.add('in-view');
  }, []);
}
