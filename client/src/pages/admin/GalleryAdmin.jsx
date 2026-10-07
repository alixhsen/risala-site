import { useDialog } from '../../components/admin/Dialog.jsx';
import { useState } from 'react';
import { Camera, Eye, EyeOff, Trash2, UploadCloud, Images } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import { api } from '../../lib/api.js';
import { AdminHead, FormSection } from '../../components/admin/AdminPage.jsx';

export default function GalleryAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/gallery', []);
  const [album, setAlbum] = useState('');
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });

  const visible = data.filter((g) => g.visible).length;
  const albums = [...new Set(data.map((g) => g.album).filter(Boolean))];

  async function upload(files) {
    const list = [...files];
    if (!list.length) return;
    const form = new FormData();
    list.forEach((f) => form.append('images', f));
    form.append('album', album);
    setState({ busy: true, error: '' });
    try {
      await api('/admin/gallery', { method: 'POST', form });
      setState({ busy: false, error: '' });
      reload();
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  async function update(img, patch) {
    await api(`/admin/gallery/${img.id}`, { method: 'PUT', body: { caption: img.caption, album: img.album, visible: !!img.visible, ...patch } })
      .catch((err) => notify(err.message));
    reload();
  }

  async function remove(img) {
    if (!(await confirm('حذف هذه الصورة نهائياً؟', { danger: true }))) return;
    await api(`/admin/gallery/${img.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="المحتوى"
        title="معرض الصور"
        subtitle={`${data.length} صورة · ${visible} ظاهرة للزوار · ${albums.length} ألبوم`}
      />

      <FormSection icon={UploadCloud} title="رفع صور جديدة" help="اختر الألبوم أولاً، ثم اسحب الصور إلى المربع أو اختر من جهازك (حتى 30 صورة).">
        <div className="gal-upload">
          <label className="field">
            <span>الألبوم (اختياري)</span>
            <input maxLength={80} list="gal-albums" placeholder="مهمات، تدريب، آليات…" value={album} onChange={(e) => setAlbum(e.target.value)} />
            <datalist id="gal-albums">{albums.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
          <label
            className={`gal-drop${drag ? ' over' : ''}${state.busy ? ' busy' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          >
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={state.busy}
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
            />
            <UploadCloud size={28} aria-hidden="true" />
            <strong>{state.busy ? 'جارٍ الرفع…' : 'اسحب الصور هنا أو اختر من جهازك'}</strong>
            <small>JPG أو PNG أو WebP</small>
          </label>
        </div>
        {state.error && <p className="error" role="alert">{state.error}</p>}
      </FormSection>

      {error && <p className="error">{error}</p>}

      {data.length === 0 && (
        <div className="empty-panel">
          <Camera size={28} aria-hidden="true" />
          <h2>لا صور في المعرض بعد</h2>
          <p>ارفع أول صورة من المربع أعلاه، وستظهر هنا لتعليقها وإخفائها أو حذفها.</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="gal-grid">
          {data.map((img) => (
            <article key={img.id} className={`gal-card${img.visible ? '' : ' is-hidden'}`}>
              <div className="gal-media">
                <img src={img.url} alt={img.caption || ''} loading="lazy" />
                <span className={`gal-state ${img.visible ? 'on' : 'off'}`}>
                  {img.visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                  {img.visible ? 'ظاهرة' : 'مخفية'}
                </span>
                <div className="gal-tools">
                  <button type="button" onClick={() => update(img, { visible: !img.visible })} aria-label={img.visible ? 'إخفاء الصورة' : 'إظهار الصورة'}>
                    {img.visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                  <button type="button" className="danger" onClick={() => remove(img)} aria-label="حذف الصورة">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="gal-meta">
                <input
                  defaultValue={img.caption || ''}
                  placeholder="أضف تعليقاً…"
                  maxLength={200}
                  aria-label="تعليق الصورة"
                  onBlur={(e) => e.target.value !== (img.caption || '') && update(img, { caption: e.target.value })}
                />
                {img.album && <span className="gal-album"><Images size={12} aria-hidden="true" /> {img.album}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
