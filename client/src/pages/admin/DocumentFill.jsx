import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Download } from 'lucide-react';
import { AdminHead } from '../../components/admin/AdminPage.jsx';
import { useLoad } from '../../App.jsx';

// Fields whose value is naturally longer than a single line get a textarea
// instead of a text input.
const LONG_FIELDS = new Set([
  'notes', 'condition_notes', 'items_received', 'equipment_needed',
  'attendees_present', 'attendees_absent', 'skills_hobbies',
]);

export default function DocumentFill() {
  const { templateId } = useParams();
  const { data: templates, error: loadError } = useLoad('/admin/document-templates', []);
  const template = templates.find((t) => t.id === templateId);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  async function fillAndDownload(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/document-templates/${templateId}/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'risala-admin' },
        credentials: 'same-origin',
        body: JSON.stringify(values),
      });
      if (res.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'تعذّر إنشاء الملف');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : `${templateId}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!templates.length) return <div className="admin-loading"><span className="loader" /> جارٍ التحميل…</div>;
  if (!template) return <p className="error">هذا النموذج غير موجود.</p>;

  return (
    <>
      <AdminHead
        kicker="النماذج والمحاضر"
        title={template.title}
        subtitle="عبّئ الحقول ثم نزّل نسخة Word من المستند الأصلي بالبيانات التي أدخلتها."
        actions={<Link className="btn" to="/admin/documents"><ArrowRight size={16} aria-hidden="true" /> رجوع</Link>}
      />

      <form className="card form" onSubmit={fillAndDownload}>
        <div className="field-row">
          {template.fields.map((f) => (
            <label className="field" key={f.name}>
              <span>{f.label}</span>
              {LONG_FIELDS.has(f.name) ? (
                <textarea
                  rows={3}
                  value={values[f.name] || ''}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : (
                <input
                  value={values[f.name] || ''}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="btn primary" disabled={busy}>
            <Download size={16} aria-hidden="true" /> {busy ? 'جارٍ التنزيل…' : 'تعبئة وتنزيل Word'}
          </button>
        </div>
      </form>
    </>
  );
}
