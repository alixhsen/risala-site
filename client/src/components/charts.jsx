// Small dependency-free charts for the admin dashboard and reports.
// All colours come from the design tokens, so charts follow the site palette.

const PALETTE = ['#1a5130', '#c5a059', '#2f9e3a', '#235c9a', '#c0272d', '#8a5b00', '#5c7a66', '#9b783a'];
export const colorAt = (i) => PALETTE[i % PALETTE.length];

// Column chart. data: [{ label, value }]
export function ColumnChart({ data, height = 260, ariaLabel }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = niceMax(max);
  const W = 720;
  const H = height;
  const padL = 40;
  const padB = 34;
  const padT = 18;
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(34, band * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t) => {
        const y = padT + plotH * (1 - t);
        return (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y} y2={y} className="chart-grid" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="chart-tick">{Math.round(top * t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + band * i + (band - barW) / 2;
        const h = (d.value / top) * plotH;
        const y = padT + plotH - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)} rx="4" className="chart-bar" />
            {d.value > 0 && <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="chart-value">{d.value}</text>}
            <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="chart-label">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut chart. slices: [{ label, value, color? }]
export function Donut({ slices, size = 200, centerLabel, centerValue }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx="100" cy="100" r={r} className="donut-track" />
        {total > 0 && slices.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={r}
              className="donut-slice"
              stroke={s.color || colorAt(i)}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="100" y="96" textAnchor="middle" className="donut-value">{centerValue}</text>
        <text x="100" y="120" textAnchor="middle" className="donut-label">{centerLabel}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <span className="legend-dot" style={{ background: s.color || colorAt(i) }} aria-hidden="true" />
            <span className="legend-text">{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
        {slices.length === 0 && <li className="muted">لا بيانات لهذه الفترة.</li>}
      </ul>
    </div>
  );
}

// Horizontal ranking bars. rows: [{ label, value }]
export function HBars({ rows, empty = 'لا بيانات لهذه الفترة.' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="hbars">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="hbars-head">
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
          <div className="hbars-track">
            <span style={{ width: `${(r.value / max) * 100}%`, background: colorAt(i) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Round the axis maximum up to a clean number (1, 2, 5 x 10^n).
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * p;
}
