import { useState } from 'react';
import { uploadImage } from '../lib/api.js';

// Upload-one-image field. `value` is the stored URL, `onChange(url)` updates it.
export default function ImageInput({ label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field image-input">
      <span>{label}</span>
      <div className="image-input-row">
        {value ? <img src={value} alt="" /> : <div className="image-empty">لا صورة</div>}
        <div>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} />
          {value && <button type="button" className="link danger" onClick={() => onChange('')}>إزالة</button>}
          {busy && <small>جارٍ الرفع…</small>}
          {error && <small className="error">{error}</small>}
        </div>
      </div>
    </div>
  );
}
