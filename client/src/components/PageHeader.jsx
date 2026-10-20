import Kicker from './Kicker.jsx';

// Shared heading block for list pages: kicker, title, lead line and an
// optional count. Every list page opens the same way so the site feels unified.
export default function PageHeader({ icon, kicker, title, lead, count, divider }) {
  return (
    <header className="page-header">
      <div className="wrap">
        <Kicker icon={icon}>{kicker}</Kicker>
        <h1>{title}</h1>
        {lead && <p className="page-header-lead">{lead}</p>}
        {divider && count && <span className="page-header-divider" aria-hidden="true" />}
        {count && <p className="page-header-count">{count}</p>}
      </div>
    </header>
  );
}
