import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useLoad } from '../App.jsx';
import GalleryTile from '../components/GalleryTile.jsx';
import Lightbox from '../components/Lightbox.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Gallery() {
  const { data, loading, error } = useLoad('/public/gallery', []);
  const [album, setAlbum] = useState('');
  const [viewer, setViewer] = useState(null);
  const albums = [...new Set(data.map((g) => g.album).filter(Boolean))];
  const shown = album ? data.filter((g) => g.album === album) : data;

  return (
    <>
      <PageHeader
        icon={Camera}
        kicker="لقطات ميدانية"
        title="معرض الصور"
        lead="صور موثّقة من مهامنا وأنشطتنا وفعالياتنا على مدار العمل الميداني."
        count={!loading && data.length > 0 ? `${data.length} صورة` : ''}
      />

      <section className="wrap section tight">
        {albums.length > 0 && (
          <div className="chips" role="group" aria-label="تصفية حسب الألبوم">
            <button type="button" className={album === '' ? 'on' : ''} onClick={() => setAlbum('')}>الكل</button>
            {albums.map((a) => <button key={a} type="button" className={album === a ? 'on' : ''} onClick={() => setAlbum(a)}>{a}</button>)}
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {!loading && !error && data.length === 0 && <p className="muted">لا صور بعد.</p>}
        <div className="gallery-grid">
          {shown.map((g, i) => <GalleryTile key={g.id} photo={g} i={i} onOpen={setViewer} />)}
        </div>
      </section>

      <Lightbox items={shown} index={viewer} onClose={() => setViewer(null)} onChange={setViewer} />
    </>
  );
}
