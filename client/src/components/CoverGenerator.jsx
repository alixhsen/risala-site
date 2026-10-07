import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Frame, ClipboardList, Palette, Upload, Type, Ruler, RotateCcw, Download, Check } from 'lucide-react';
import { SIZES, BAND_COLORS, drawCover, drawFrame, drawInfoCard, loadImage } from '../lib/cover.js';
import { uploadImage } from '../lib/api.js';

const DRAW = { cover: drawCover, frame: drawFrame, info: drawInfoCard };

const MODES = [
  { key: 'cover', icon: ImageIcon, title: 'غلاف نشاط', text: 'صورة كاملة مع عنوان وشريط سفلي', color: 'grey' },
  { key: 'frame', icon: Frame, title: 'إطار بسيط', text: 'صورة داخل إطار بالشعار والاسم', color: 'green' },
  { key: 'info', icon: ClipboardList, title: 'بطاقة معلومات', text: 'نص منظّم بتفاصيل النشاط', color: 'green' },
];

const SIZE_CARDS = [
  { key: 'portrait', title: 'عمودي', ratio: '4:5', use: 'إنستغرام وفيسبوك' },
  { key: 'square', title: 'مربع', ratio: '1:1', use: 'منشورات' },
  { key: 'wide', title: 'أفقي', ratio: '16:9', use: 'غلاف الموقع' },
];

// One numbered step of the controls: a header with its icon and help, then its fields.
function Block({ step, icon: Icon, title, help, children }) {
  return (
    <section className="gen-block">
      <header className="gen-block-head">
        <span className="gen-step" aria-hidden="true">{step}</span>
        <div>
          <h3><Icon size={16} aria-hidden="true" /> {title}</h3>
          {help && <p>{help}</p>}
        </div>
      </header>
      <div className="gen-block-body">{children}</div>
    </section>
  );
}

// Photo + info-card generator. `settings` supplies the logo and identity
// lines. `onUse(url)` (optional) receives the uploaded result, e.g. as a
// post cover - only offered for the photo modes, not the info card.
// `initialInfo` optionally prefills the info-card fields from a mission.
export default function CoverGenerator({ settings, initialTitle = '', initialInfo, onUse }) {
  const canvasRef = useRef(null);
  const drag = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [fileName, setFileName] = useState('');
  const [logo, setLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [o, setO] = useState({
    mode: 'cover',
    size: 'portrait',
    color: 'grey',
    title: initialTitle || 'نشاط للفريق',
    subtitle1: '',
    subtitle2: '',
    zoom: 1,
    posX: 0,
    posY: 0,
    typeLabel: initialInfo?.typeLabel || '',
    dateLabel: initialInfo?.dateLabel || '',
    names: (initialInfo?.names || []).join('، '),
    body: initialInfo?.body || '',
  });
  const set = (patch) => setO((prev) => ({ ...prev, ...patch }));
  const size = SIZES[o.size];
  const isPhotoMode = o.mode === 'cover' || o.mode === 'frame';

  useEffect(() => {
    let alive = true;
    if (settings.logo_url) loadImage(settings.logo_url).then((img) => alive && setLogo(img)).catch(() => {});
    // Canvas text falls back to a system font unless the web font is loaded first.
    Promise.all([
      ...['400', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Cairo"`, 'نشاط')),
      document.fonts.load('700 40px "Dubai"', 'نشاط'),
    ])
      .catch(() => {})
      .then(() => alive && setFontsReady(true));
    return () => { alive = false; };
  }, [settings.logo_url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const opts = {
      ...o,
      photo, logo, line1: settings.line1, line2: settings.line2, line3: settings.line3,
      names: o.names.split(/[,،\n]/).map((n) => n.trim()).filter(Boolean),
    };
    DRAW[o.mode](canvas.getContext('2d'), size.w, size.h, opts);
  }, [o, photo, logo, size, settings, fontsReady]);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const url = URL.createObjectURL(file);
      setPhoto(await loadImage(url));
      URL.revokeObjectURL(url);
      setFileName(file.name);
      set({ zoom: 1, posX: 0, posY: 0 });
    } catch (err) {
      setError(err.message);
    }
  }

  // Drag on the preview to slide the photo inside its box.
  const onPointerDown = (e) => {
    if (!photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, posX: o.posX, posY: o.posY };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    set({
      posX: clamp(drag.current.posX - ((e.clientX - drag.current.x) / rect.width) * 2.4),
      posY: clamp(drag.current.posY - ((e.clientY - drag.current.y) / rect.height) * 2.4),
    });
  };
  const onPointerUp = () => { drag.current = null; };

  const toBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.92));

  async function download() {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(o.title || 'cover').replace(/[\\/:*?"<>|]/g, '').trim() || 'cover'}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function useAsCover() {
    setBusy(true);
    setError('');
    try {
      onUse(await uploadImage(await toBlob(), 'cover.jpg'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hint = isPhotoMode
    ? 'اسحب الصورة داخل المعاينة لتحريكها. الشعار واسم الفريق يؤخذان من الإعدادات.'
    : 'تُصمَّم بطاقة المعلومات لتُنشر مع صورة الغلاف كمنشور من صورتين على إنستغرام.';

  // Step numbers shift when the photo step is hidden (info mode).
  const n = (base) => (isPhotoMode ? String(base) : String(base - 1));

  return (
    <div className="gen">
      <div className="gen-controls">
        <Block step={1} icon={Palette} title="نوع التصميم" help="اختر الشكل، والمعاينة تتحدّث مباشرة.">
          <div className="gen-modes" role="radiogroup" aria-label="نوع التصميم">
            {MODES.map(({ key, icon: Icon, title, text }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={o.mode === key}
                className={`gen-mode${o.mode === key ? ' on' : ''}`}
                onClick={() => set({ mode: key, color: MODES.find((m) => m.key === key).color })}
              >
                <Icon size={20} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </Block>

        {isPhotoMode && (
          <Block step={2} icon={Upload} title="الصورة" help="ارفع صورة من جهازك، ثم اسحبها داخل المعاينة لتحريكها.">
            <label className={`gen-drop${photo ? ' has-file' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} aria-label="اختيار صورة" />
              <Upload size={20} aria-hidden="true" />
              <strong>{photo ? 'تغيير الصورة' : 'اختر صورة'}</strong>
              <span>{fileName || 'JPG أو PNG أو WEBP'}</span>
            </label>
            <div className="gen-zoom">
              <span>التكبير</span>
              <input type="range" min="1" max="3" step="0.01" value={o.zoom} disabled={!photo} aria-label="تكبير الصورة" onChange={(e) => set({ zoom: Number(e.target.value) })} />
              <strong>{Math.round(o.zoom * 100)}%</strong>
              <button type="button" className="btn gen-reset" disabled={!photo} onClick={() => set({ zoom: 1, posX: 0, posY: 0 })}>
                <RotateCcw size={14} aria-hidden="true" /> إعادة الضبط
              </button>
            </div>
          </Block>
        )}

        <Block step={n(3)} icon={Type} title="المحتوى" help={o.mode === 'info' ? 'النص يظهر داخل البطاقة بالترتيب.' : 'العنوان والأسطر تظهر أسفل الصورة.'}>
          {o.mode === 'cover' && (
            <>
              <label className="field"><span>العنوان الرئيسي</span>
                <input value={o.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />
              </label>
              <label className="field"><span>السطر الأول</span>
                <input value={o.subtitle1} maxLength={70} placeholder="مثال: دورة إسعافات أولية" onChange={(e) => set({ subtitle1: e.target.value })} />
              </label>
              <label className="field"><span>السطر الثاني</span>
                <input value={o.subtitle2} maxLength={70} onChange={(e) => set({ subtitle2: e.target.value })} />
              </label>
            </>
          )}

          {o.mode === 'info' && (
            <>
              <label className="field"><span>العنوان</span>
                <input value={o.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
              </label>
              <div className="field-row">
                <label className="field"><span>النوع</span>
                  <input value={o.typeLabel} maxLength={40} placeholder="مثال: حادث سير" onChange={(e) => set({ typeLabel: e.target.value })} />
                </label>
                <label className="field"><span>التاريخ</span>
                  <input value={o.dateLabel} maxLength={40} placeholder="مثال: ٥ تشرين الأول ٢٠٢٦" onChange={(e) => set({ dateLabel: e.target.value })} />
                </label>
              </div>
              <label className="field"><span>المشاركون (افصل بين الأسماء بفاصلة)</span>
                <input value={o.names} onChange={(e) => set({ names: e.target.value })} />
              </label>
              <label className="field"><span>التفاصيل</span>
                <textarea rows={5} value={o.body} onChange={(e) => set({ body: e.target.value })} />
              </label>
            </>
          )}
        </Block>

        <Block step={n(4)} icon={Ruler} title="المقاس واللون" help="المقاس يحدّد الشكل النهائي، واللون يلوّن الشريط والإطار.">
          <p className="gen-sublabel">المقاس</p>
          <div className="gen-sizes">
            {SIZE_CARDS.map((s) => (
              <button key={s.key} type="button" className={`gen-size${o.size === s.key ? ' on' : ''}`} aria-pressed={o.size === s.key} onClick={() => set({ size: s.key })}>
                <span className="gen-ratio" style={{ width: (44 * SIZES[s.key].w) / SIZES[s.key].h, height: 44 }} aria-hidden="true" />
                <strong>{s.title} {s.ratio}</strong>
                <span>{s.use}</span>
              </button>
            ))}
          </div>
          <p className="gen-sublabel">اللون</p>
          <div className="gen-swatches">
            {Object.entries(BAND_COLORS).map(([k, v]) => (
              <button key={k} type="button" className={`gen-swatch${o.color === k ? ' on' : ''}`} style={{ '--swatch': v.band }} aria-pressed={o.color === k} aria-label={v.label} onClick={() => set({ color: k })}>
                <span aria-hidden="true" />
                <small>{v.label}</small>
              </button>
            ))}
          </div>
        </Block>
      </div>

      <aside className="gen-stage" aria-label="المعاينة">
        <div className="gen-stage-bar">
          <strong>المعاينة</strong>
          <span>{size.w} × {size.h} بكسل</span>
        </div>
        <div className="gen-canvas-wrap">
          <canvas
            ref={canvasRef}
            className={photo ? 'draggable' : ''}
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <p className="gen-hint">{hint}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="gen-stage-actions">
          <button type="button" className="btn primary" disabled={isPhotoMode && !photo} onClick={download}>
            <Download size={16} aria-hidden="true" /> تنزيل الصورة
          </button>
          {onUse && isPhotoMode && (
            <button type="button" className="btn" disabled={!photo || busy} onClick={useAsCover}>
              <Check size={16} aria-hidden="true" /> {busy ? 'جارٍ الرفع…' : 'استخدمها غلافاً للمنشور'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
