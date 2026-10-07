import { useLoad } from '../App.jsx';

// Checkbox roster for picking who was on a mission, grouped like the public
// Team page. `value` is an array of TeamMembers ids, `onChange` replaces it.
export default function ParamedicPicker({ value, onChange }) {
  const { data } = useLoad('/admin/team', []);
  const groups = [];
  for (const m of data) {
    const name = m.group_name || 'الفريق';
    let group = groups.find((g) => g.name === name);
    if (!group) groups.push((group = { name, members: [] }));
    group.members.push(m);
  }

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  if (!data.length) return <p className="hint">لا يوجد أعضاء في الفريق بعد. أضفهم من صفحة الفريق أولاً.</p>;

  return (
    <div className="paramedic-picker">
      {groups.map((g) => (
        <div key={g.name} className="paramedic-group">
          <h4>{g.name}</h4>
          <div className="paramedic-options">
            {g.members.map((m) => (
              <label key={m.id} className={`paramedic-chip ${value.includes(m.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={value.includes(m.id)} onChange={() => toggle(m.id)} />
                {m.photo_url ? <img src={m.photo_url} alt="" /> : <span className="avatar-xs">{m.name.trim().charAt(0)}</span>}
                {m.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
