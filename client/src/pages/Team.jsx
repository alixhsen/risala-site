import { Users } from 'lucide-react';
import { useLoad } from '../App.jsx';
import TeamCard from '../components/TeamCard.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Team() {
  const { data, loading, error } = useLoad('/public/team', []);
  // Keep the admin's ordering, but show members under their group heading.
  const groups = [];
  for (const m of data) {
    const name = m.group_name || 'الفريق';
    let group = groups.find((g) => g.name === name);
    if (!group) groups.push((group = { name, members: [] }));
    group.members.push(m);
  }

  return (
    <>
      <PageHeader
        icon={Users}
        kicker="فريق العمل"
        title="فريقنا"
        lead="الوجوه التي تقف خلف كل استجابة ميدانية وكل مهمة ننجزها."
        count={!loading && data.length > 0 ? `${data.length} عضو` : ''}
      />

      <section className="wrap section tight">
        {error && <p className="error">{error}</p>}
        {!loading && !error && data.length === 0 && <p className="muted">ستُضاف أسماء أعضاء الفريق قريباً.</p>}
        {groups.map((g) => (
          <div key={g.name} className="team-group">
            <div className="team-group-title">
              <h2>{g.name}</h2>
            </div>
            <div className="team-grid">
              {g.members.map((m, i) => <TeamCard key={m.id} member={m} i={i} />)}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
