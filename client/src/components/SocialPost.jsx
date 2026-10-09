import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, RotateCcw } from 'lucide-react';
import { drawSocial, loadImage, instagramHandle } from '../lib/cover.js';

// A single generated image: a canvas preview plus its own download button.
// Dragging the preview slides the shared photo crop (both cards use the
// same cover photo, so they stay in sync).
function SocialCard({ draw, label, text, fileSuffix, fileBase, onPointerDown, onPointerMove, onPointerUp }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !draw) return;
    canvas.width = 1080;
    canvas.height = 1350;
    draw(canvas.getContext('2d'));
  }, [draw]);

  function download() {
    canvasRef.current.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(fileBase || 'منشور').replace(/[\\/:*?"<>|]/g, '').trim() || 'منشور'}-${fileSuffix}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/jpeg', 0.92);
  }

  return (
    <figure className="social-card">
      <div className="social-card-canvas">
        <canvas
          ref={canvasRef}
          className="draggable"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <figcaption>
        <strong>{label}</strong>
        <span>{text}</span>
        <button type="button" className="btn outline" onClick={download}>
          <Download size={15} aria-hidden="true" /> تنزيل الصورة
        </button>
      </figcaption>
    </figure>
  );
}

// Two ready-to-post Instagram/Facebook images, generated automatically from
// the post's own fields as they're filled in - no separate design step.
// The first pairs the cover photo with the title, date and short summary;
// the second carries the same design with the date, the response team and
// the full details, so posting both together reads as one consistent set.
// Both share one zoom/position for the photo - drag either preview, or use
// the zoom slider, and both stay in sync since it's the same source photo.
export default function SocialPost({ settings, title, coverUrl, dateLabel, typeLabel, summary, body, names }) {
  const drag = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [logo, setLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [crop, setCrop] = useState({ zoom: 1, posX: 0, posY: 0 });

  useEffect(() => {
    let alive = true;
    Promise.all(['400', '700', '900'].map((w) => document.fonts.load(`${w} 40px "Cairo"`, 'نشاط')))
      .catch(() => {})
      .then(() => alive && setFontsReady(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (settings.logo_url) loadImage(settings.logo_url).then((img) => alive && setLogo(img)).catch(() => {});
    return () => { alive = false; };
  }, [settings.logo_url]);

  useEffect(() => {
    let alive = true;
    setPhotoFailed(false);
    setCrop({ zoom: 1, posX: 0, posY: 0 });
    if (!coverUrl) { setPhoto(null); return undefined; }
    loadImage(coverUrl)
      .then((img) => alive && setPhoto(img))
      .catch(() => alive && setPhotoFailed(true));
    return () => { alive = false; };
  }, [coverUrl]);

  // Drag on either preview to slide the shared photo crop.
  const onPointerDown = (e) => {
    if (!photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, posX: crop.posX, posY: crop.posY };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    setCrop((c) => ({
      ...c,
      posX: clamp(drag.current.posX - ((e.clientX - drag.current.x) / rect.width) * 2.4),
      posY: clamp(drag.current.posY - ((e.clientY - drag.current.y) / rect.height) * 2.4),
    }));
  };
  const onPointerUp = () => { drag.current = null; };

  if (!coverUrl) {
    return (
      <p className="hint"><ImageOff size={15} aria-hidden="true" /> ارفع صورة الغلاف أولاً، لتُنشأ صورتا التواصل الاجتماعي تلقائياً.</p>
    );
  }
  if (photoFailed) return <p className="error">تعذّر تحميل صورة الغلاف.</p>;
  if (!photo || !fontsReady) return <p className="muted">جارٍ تجهيز الصور…</p>;

  const base = {
    photo, logo, zoom: crop.zoom, posX: crop.posX, posY: crop.posY, color: 'green',
    line1: settings.line1, line3: settings.line3,
    phone: settings.phone, instagramHandle: instagramHandle(settings.instagram),
    dateLabel,
  };

  return (
    <div className="social-generated">
      <div className="social-zoom">
        <span>تكبير الصورة</span>
        <input
          type="range" min="1" max="3" step="0.01" value={crop.zoom}
          aria-label="تكبير الصورة"
          onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
        />
        <strong>{Math.round(crop.zoom * 100)}%</strong>
        <button type="button" className="btn gen-reset" onClick={() => setCrop({ zoom: 1, posX: 0, posY: 0 })}>
          <RotateCcw size={14} aria-hidden="true" /> إعادة الضبط
        </button>
      </div>
      <p className="social-zoom-hint">اسحب أي صورة لتحريكها، أو كبّرها من المنزلق - التغيير ينعكس على الصورتين معاً.</p>

      <div className="social-pair">
        <SocialCard
          label="الصورة الأولى"
          text="الغلاف مع العنوان والتاريخ والملخّص"
          fileSuffix="غلاف"
          fileBase={title}
          draw={(ctx) => drawSocial(ctx, 1080, 1350, { ...base, title, typeLabel, body: summary })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <SocialCard
          label="الصورة الثانية"
          text="نفس التصميم - التاريخ، الفريق والتفاصيل الكاملة"
          fileSuffix="تفاصيل"
          fileBase={title}
          draw={(ctx) => drawSocial(ctx, 1080, 1350, { ...base, body, names })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
    </div>
  );
}
