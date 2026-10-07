// Creates the database, tables, default settings and the first admin account.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sql, buildConfig } = require('../src/db');

const DB_NAME = process.env.DB_NAME || 'RisalaSite';

const DEFAULT_SETTINGS = {
  site_name: 'جمعية الرسالة للإسعاف الصحي',
  line1: 'جمعية الرسالة للإسعاف الصحي',
  line2: 'مركز الإمام علي الهادي (ع) التطوعي',
  line3: 'فرقة شهداء بئر حسن',
  tagline: 'في خدمة الإنسان والمجتمع',
  about_text: 'اكتب هنا نبذة عن الفريق: متى تأسس، المنطقة التي يخدمها، وأبرز مهامه.',
  history_text: 'اكتب هنا تاريخ الجمعية والفريق. يمكن تعديل هذا النص من لوحة التحكم.',
  logo_url: '/uploads/seed-logo.png',
  hero_url: '/uploads/seed-team-night.jpg',
  hero_quote: '',
  hero_quote_author: '',
  phone: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  donate_url: 'https://risaladonate.web.app',
  stat_volunteers: '',
  stat_vehicles: '',
  stat_missions: '',
  stat_years: '',
};

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME may only contain letters, numbers and _');
  // Leaving DB_USER empty connects with your own Windows login instead
  // (e.g. for LocalDB) - see server/.env.example.
  if (process.env.DB_USER && !process.env.DB_PASSWORD) {
    throw new Error('DB_USER is set but DB_PASSWORD is empty in server/.env.');
  }

  const master = await new sql.ConnectionPool(buildConfig('master')).connect();
  await master.request().query(`IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE [${DB_NAME}]`);
  await master.close();
  console.log(`Database ${DB_NAME} is ready.`);

  const pool = await new sql.ConnectionPool(buildConfig(DB_NAME)).connect();
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  for (const batch of schema.split(/^\s*GO\s*$/im)) {
    if (batch.trim()) await pool.request().query(batch);
  }
  console.log('Tables are ready.');

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.request()
      .input('k', sql.NVarChar(60), key)
      .input('v', sql.NVarChar(sql.MAX), value)
      .query('IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE [key] = @k) INSERT INTO dbo.Settings ([key], value) VALUES (@k, @v)');
  }

  // Starter images (logo, hero, gallery) so the site is not empty on first run.
  const seedDir = path.join(__dirname, '..', 'seed-images');
  const uploadDir = path.join(__dirname, '..', 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const seedFiles = fs.existsSync(seedDir) ? fs.readdirSync(seedDir) : [];
  for (const file of seedFiles) {
    const target = path.join(uploadDir, `seed-${file}`);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(seedDir, file), target);
  }
  const galleryCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.GalleryImages');
  if (galleryCount.recordset[0].n === 0) {
    for (const file of seedFiles.filter((f) => f.endsWith('.jpg'))) {
      await pool.request()
        .input('url', sql.NVarChar(300), `/uploads/seed-${file}`)
        .query('INSERT INTO dbo.GalleryImages (url) VALUES (@url)');
    }
  }

  // Starter mission types, so the admin has something to pick from on first run.
  const DEFAULT_MISSION_TYPES = [
    ['حالة مرضية', '#2f9e3a'],
    ['حالة وفاة', '#55615b'],
    ['حادث سير', '#c9252b'],
    ['غارة', '#7a2e2e'],
    ['استجابة ميدانية', '#1f6f28'],
    ['أخرى', '#b7a98b'],
  ];
  for (let i = 0; i < DEFAULT_MISSION_TYPES.length; i++) {
    const [name, color] = DEFAULT_MISSION_TYPES[i];
    await pool.request()
      .input('n', sql.NVarChar(80), name)
      .input('c', sql.NVarChar(20), color)
      .input('i', sql.Int, i)
      .query(`IF NOT EXISTS (SELECT 1 FROM dbo.MissionTypes WHERE name = @n)
              INSERT INTO dbo.MissionTypes (name, color, sort_order) VALUES (@n, @c, @i)`);
  }

  // Starter medical service types, for the admin-only services log.
  const DEFAULT_SERVICE_TYPES = ['تغيير جرح', 'تقطيب', 'تعليق مصل', 'قياس ضغط', 'قياس سكر', 'حقن دواء', 'إسعافات أولية عامة'];
  for (let i = 0; i < DEFAULT_SERVICE_TYPES.length; i++) {
    await pool.request()
      .input('n', sql.NVarChar(100), DEFAULT_SERVICE_TYPES[i])
      .input('i', sql.Int, i)
      .query(`IF NOT EXISTS (SELECT 1 FROM dbo.ServiceTypes WHERE name = @n)
              INSERT INTO dbo.ServiceTypes (name, sort_order) VALUES (@n, @i)`);
  }

  const existing = await pool.request().query("SELECT COUNT(*) AS n FROM dbo.Users WHERE role = 'admin'");
  if (existing.recordset[0].n === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await pool.request()
      .input('u', sql.NVarChar(50), username)
      .input('p', sql.NVarChar(200), await bcrypt.hash(password, 12))
      .input('d', sql.NVarChar(100), 'المدير')
      .query("INSERT INTO dbo.Users (username, password_hash, display_name, role) VALUES (@u, @p, @d, 'admin')");
    console.log('\nAdmin account created:');
    console.log(`  username: ${username}`);
    console.log(generated ? `  password: ${password}   (shown once - save it now)` : '  password: the ADMIN_PASSWORD you set');
  } else {
    console.log('An admin account already exists, not creating another.');
  }

  await pool.close();
  console.log('\nDone. Start the app with: npm run dev');
}

main().catch((err) => {
  console.error('\nDatabase setup failed:', err.message);
  process.exit(1);
});
