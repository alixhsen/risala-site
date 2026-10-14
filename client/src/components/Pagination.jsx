import { ChevronRight, ChevronLeft } from 'lucide-react';

// Numbered pager with a windowed range (current ± 1, plus first/last and
// ellipses for the gaps). `page` is 1-based; `onChange` receives the new page.
function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const items = pageList(page, totalPages);

  return (
    <nav className="pager" aria-label="تصفّح الصفحات">
      <button type="button" className="pager-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="الصفحة السابقة">
        <ChevronRight size={16} aria-hidden="true" /> <span className="pager-label">السابق</span>
      </button>
      <div className="pager-nums">
        {items.map((p, i) => (
          <span key={p}>
            {i > 0 && p - items[i - 1] > 1 && <span className="pager-ellipsis">…</span>}
            <button
              type="button"
              className={`pager-num ${p === page ? 'on' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          </span>
        ))}
      </div>
      <button type="button" className="pager-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="الصفحة التالية">
        <span className="pager-label">التالي</span> <ChevronLeft size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
