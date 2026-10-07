// Shared pieces for the admin list pages: summary tiles, a search and filter
// bar, status chips, icon buttons and an empty state.
import { Search } from 'lucide-react';

export function StatTiles({ items }) {
  return (
    <div className="stat-tiles">
      {items.map((it) => (
        <article key={it.label} className={`stat-tile tone-${it.tone || 'brand'}`}>
          <span className="stat-tile-label">{it.label}</span>
          <strong className="stat-tile-value">{it.value ?? '–'}</strong>
          {it.sub && <span className="stat-tile-sub">{it.sub}</span>}
        </article>
      ))}
    </div>
  );
}

export function FilterBar({ search, onSearch, placeholder = 'بحث…', children }) {
  return (
    <div className="filter-bar">
      {onSearch && (
        <label className="filter-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} placeholder={placeholder} onChange={(e) => onSearch(e.target.value)} aria-label={placeholder} />
        </label>
      )}
      {children && <div className="filter-controls">{children}</div>}
    </div>
  );
}

export function ChipFilter({ value, options, onChange, label = 'تصفية' }) {
  return (
    <div className="chip-filter" role="group" aria-label={label}>
      {options.map(([val, text, count]) => (
        <button key={String(val)} type="button" className={value === val ? 'on' : ''} aria-pressed={value === val} onClick={() => onChange(val)}>
          {text}
          {count !== undefined && <span className="chip-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function IconButton({ icon: Icon, label, onClick, tone = 'default', disabled, title }) {
  return (
    <button type="button" className={`icon-btn tone-${tone}`} onClick={onClick} disabled={disabled} aria-label={label} title={title || label}>
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

export function EmptyPanel({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-panel">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Thumb({ src, alt = '' }) {
  return src
    ? <img className="thumb-sq" src={src} alt={alt} loading="lazy" />
    : <span className="thumb-sq thumb-empty" aria-hidden="true" />;
}
