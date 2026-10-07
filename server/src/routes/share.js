const express = require('express');
const { query } = require('../db');
const { wrap, idParam } = require('../util');

const router = express.Router();

const PAGE_PATHS = { mission: '/missions', activity: '/activities', news: '/news' };
const esc = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Share page for a published post. WhatsApp, Facebook and other link previews
// read the title, summary and cover image from the tags sent here; people are
// then sent on to the post itself.
router.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const rows = id ? await query(
    "SELECT id, title, summary, cover_url, category FROM dbo.Posts WHERE id = @id AND status = 'published'",
    { id }
  ) : [];
  if (!rows.length) return res.status(404).type('text').send('الصفحة غير موجودة');

  const post = rows[0];
  const [line] = await query("SELECT value FROM dbo.Settings WHERE [key] = 'line1'");
  const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const target = `${PAGE_PATHS[post.category] || ''}/${post.id}`;
  const image = `${base}${post.cover_url || '/logo.png'}`;
  const siteName = (line && line.value) || 'جمعية الرسالة للاسعاف الصحي';
  const description = post.summary || siteName;

  res.type('html').send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(post.title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${esc(siteName)}" />
  <meta property="og:title" content="${esc(post.title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:url" content="${esc(`${base}/s/${post.id}`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="${esc(base + target)}" />
  <meta http-equiv="refresh" content="0; url=${esc(target)}" />
</head>
<body>
  <a href="${esc(target)}">${esc(post.title)}</a>
  <script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`);
}));

module.exports = router;
