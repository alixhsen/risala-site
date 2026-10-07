import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { Share2, Copy, Check, Download } from 'lucide-react';

// Share card for a mission, activity or news post. The link is /s/:id, which
// previews the title and cover image and then opens the post.
export default function ShareBox({ postId, title, coverUrl }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const url = `${window.location.origin}/s/${postId}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;

  // Opens the device's share sheet. The cover image is attached where the device
  // allows files, so the title, image and link travel together.
  async function nativeShare() {
    setNote('');
    const data = { title, text: title, url };
    try {
      if (coverUrl && navigator.canShare) {
        const blob = await fetch(coverUrl).then((r) => r.blob());
        const file = new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) data.files = [file];
      }
    } catch {
      // The image could not be fetched: share the title and link alone.
    }
    try {
      await navigator.share(data);
    } catch (err) {
      if (err.name !== 'AbortError') setNote('تعذّرت المشاركة، جرّب نسخ الرابط.');
    }
  }

  async function copyLink() {
    setNote('');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote('تعذّر نسخ الرابط.');
    }
  }

  return (
    <section className="share-box" aria-label="مشاركة">
      <h3><Share2 size={16} aria-hidden="true" /> شارك هذا المنشور</h3>
      <p>عند إرسال الرابط يظهر العنوان وصورة الغلاف.</p>
      <div className="share-actions">
        <a className="share-btn wa" href={whatsapp} target="_blank" rel="noreferrer">
          <FaWhatsapp size={18} aria-hidden="true" /> واتساب
        </a>
        {canNativeShare && (
          <button type="button" className="share-btn" onClick={nativeShare}>
            <Share2 size={16} aria-hidden="true" /> مشاركة
          </button>
        )}
        <button type="button" className="share-btn" onClick={copyLink}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'تم نسخ الرابط' : 'نسخ الرابط'}
        </button>
        {coverUrl && (
          <a className="share-btn" href={coverUrl} download>
            <Download size={16} aria-hidden="true" /> تحميل الصورة
          </a>
        )}
      </div>
      {note && <p className="share-note" role="status">{note}</p>}
    </section>
  );
}
