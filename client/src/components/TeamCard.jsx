import useReveal from '../hooks/useReveal.js';

// Roster card: portrait photo (or initial when there is none) with the name
// and role set on a shade at the bottom. Used on the home page and Team page.
export default function TeamCard({ member, i = 0 }) {
  const ref = useReveal();
  return (
    <article ref={ref} className="roster-card reveal" style={{ transitionDelay: `${Math.min(i, 8) * 60}ms` }}>
      <div className="roster-photo">
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} loading="lazy" />
          : <span className="roster-initial" aria-hidden="true">{member.name.trim().charAt(0)}</span>}
      </div>
      <div className="roster-info">
        <span className="roster-bar" aria-hidden="true" />
        <h3>{member.name}</h3>
        {member.role_title && <p>{member.role_title}</p>}
      </div>
    </article>
  );
}
