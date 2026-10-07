import Kicker from './Kicker.jsx';

// Shared heading block for list pages: kicker, title, lead line and an
// optional count. Every list page opens the same way so the site feels unified.
export default function PageHeader({ icon, kicker, title, lead, count }) {
  return (
    <header className="page-header">
      <div className="wrap">
        <Kicker icon={icon}>{kicker}</Kicker>
        <h1>{title}</h1>
        {lead && <p className="page-header-lead">{lead}</p>}
        {count && <p className="page-header-count">{count}</p>}
      </div>
    </header>
  );
}
