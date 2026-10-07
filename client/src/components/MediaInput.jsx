import { useState } from 'react';
import { uploadMedia } from '../lib/api.js';

// Multi-upload field for a post's sub media: images and short video clips,
// mixed in one ordered list. `value` is [{url, kind}], `onChange` replaces it.
export default function MediaInput({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function addFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of files) {
        const media = await uploadMedia(file);
        onChange([...value, media]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = (url) => onChange(value.filter((m) => m.url !== url));

  return (
    <div className="field">
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={addFiles}
        disabled={busy}
      />
      {busy && <small>جارٍ الرفع…</small>}
      {error && <small className="error">{error}</small>}
      <div className="admin-photos large">
        {value.map((m) => (
          <figure key={m.url} className={m.kind === 'video' ? 'media-video' : ''}>
            {m.kind === 'video'
              ? <video src={m.url} muted />
              : <img src={m.url} alt="" />}
            {m.kind === 'video' && <span className="play-badge">▶</span>}
            <button type="button" className="link danger" onClick={() => remove(m.url)}>إزالة</button>
          </figure>
        ))}
      </div>
    </div>
  );
}
