// Shared building blocks for the admin screens: a page header, grouped form
// sections, and a sticky save bar. Keeps every admin form on one design.

export function AdminHead({ kicker, title, subtitle, actions, status }) {
  return (
    <header className="admin-head">
      <div className="admin-head-text">
        {kicker && <p className="admin-kicker-line">{kicker}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="admin-head-sub">{subtitle}</p>}
      </div>
      {(status || actions) && (
        <div className="admin-head-side">
          {status}
          {actions}
        </div>
      )}
    </header>
  );
}

// One grouped part of a form: icon, title, short help text, and its fields.
export function FormSection({ icon: Icon, title, help, children, aside }) {
  return (
    <section className="fsec">
      <header className="fsec-head">
        {Icon && <span className="fsec-icon"><Icon size={18} aria-hidden="true" /></span>}
        <div className="fsec-title">
          <h2>{title}</h2>
          {help && <p>{help}</p>}
        </div>
        {aside && <div className="fsec-aside">{aside}</div>}
      </header>
      <div className="fsec-body">{children}</div>
    </section>
  );
}

// Sticky bottom bar with the form's actions and any error.
export function SaveBar({ error, children, hint }) {
  return (
    <div className="savebar" role="region" aria-label="إجراءات النموذج">
      <div className="savebar-msg">
        {error ? <span className="error" role="alert">{error}</span> : hint && <span className="muted">{hint}</span>}
      </div>
      <div className="savebar-actions">{children}</div>
    </div>
  );
}
