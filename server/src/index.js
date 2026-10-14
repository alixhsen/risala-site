const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing in server/.env. Run "npm run setup" from the project folder first.');
  process.exit(1);
}

const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { requireAuth, requireCsrfHeader } = require('./auth');
const { getPool, query } = require('./db');

// Same ALTER as database/schema.sql (and just as idempotent) - applied here
// too so this boot picks it up without a separate `npm run db:init` pass.
async function migrate() {
  await query(`IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'permissions')
    ALTER TABLE dbo.Users ADD permissions NVARCHAR(MAX) NULL`);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
// Behind a reverse proxy (IIS, nginx) set TRUST_PROXY=1 so the login rate limit
// sees each visitor's real address instead of the proxy's.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin', requireCsrfHeader, requireAuth, require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

// Share links (/s/:id) return the preview tags for WhatsApp and Facebook.
app.use('/s', require('./routes/share'));

// In production (after `npm run build`) the API also serves the website.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const isVideo = req.path.includes('upload-video');
    return res.status(400).json({ error: isVideo ? 'حجم الفيديو أكبر من 150 ميغابايت' : 'حجم الصورة أكبر من 12 ميغابايت' });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  const dbDown = ['ESOCKET', 'ELOGIN', 'ETIMEOUT', 'ECONNCLOSED', 'EINSTLOOKUP'].includes(err.code);
  res.status(dbDown ? 503 : 500).json({ error: dbDown ? 'تعذر الاتصال بقاعدة البيانات' : 'حدث خطأ في الخادم' });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  getPool()
    .then(async () => {
      console.log('Connected to SQL Server.');
      try { await migrate(); } catch (err) { console.error('Migration failed:', err.message); }
    })
    .catch((err) => console.error(`Could not connect to SQL Server: ${err.message}\nCheck the DB_ settings in server/.env.`));
});
