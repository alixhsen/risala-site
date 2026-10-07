import { useEffect, useRef, useState } from 'react';

// Animates 0 -> target once the element scrolls into view. `target` may be
// a plain number or a string like "50+" / "٢٥" - only a leading run of
// digits is animated, anything else (prefix/suffix) is kept as-is.
export default function useCountUp(raw, { duration = 1100 } = {}) {
  const ref = useRef(null);
  const match = String(raw ?? '').match(/(\d+)/);
  const target = match ? Number(match[1]) : null;
  const prefix = match ? String(raw).slice(0, match.index) : '';
  const suffix = match ? String(raw).slice(match.index + match[1].length) : '';
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || target === null) return undefined;
    if (!('IntersectionObserver' in window)) { setN(target); return undefined; }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          setN(Math.round(target * (1 - (1 - p) ** 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  const display = target === null ? String(raw ?? '') : `${prefix}${n}${suffix}`;
  return [ref, display];
}
