// Small colored pill for a mission type. Accepts either a flat {name,color}
// or a post-shaped object with mission_type_name/mission_type_color.
export default function TypeBadge({ type, name, color }) {
  const label = name || type?.name || type?.mission_type_name;
  const tint = color || type?.color || type?.mission_type_color || '#2f9e3a';
  if (!label) return null;
  return (
    <span className="type-badge" style={{ '--tint': tint }}>
      {label}
    </span>
  );
}
