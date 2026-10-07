// Small icon + label used above every section heading sitewide, so each
// section reads with a consistent, identifiable glyph instead of bare text.
export default function Kicker({ icon: Icon, children, light }) {
  return (
    <p className={`section-kicker${light ? ' light' : ''}`}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </p>
  );
}
