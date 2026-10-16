// Creates server/data/risala.db from database/schema.sqlite.sql, then (if
// server/data-export.json exists - the one-time dump index.js wrote from the
// old SQL Server database) imports every row from it, preserving every id so
// foreign keys and any bookmarked URLs keep working. Safe to run again: it
// only creates tables that don't exist yet, and only imports a table that's
// currently empty, so it never duplicates or overwrites real data.
//
// After that, any table still empty (a genuinely fresh install, or one with
// no data-export.json) gets the same starter data and first admin account
// that server/scripts/init-db.js used to create for the SQL Server version -
// without this, a fresh `npm run db:init` leaves Users empty with no way to
// log in, since every account-management route requires an existing admin.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'risala.db');
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', 'schema.sqlite.sql');
const EXPORT_PATH = path.join(__dirname, '..', 'data-export.json');

// Insert order matters: a table must come after every table its foreign
// keys point to.
const IMPORT_ORDER = [
  'Users', 'Settings', 'MissionTypes', 'TeamMembers',
  'Posts', 'PostImages', 'PostParamedics',
  'GalleryImages', 'Messages',
  'InventoryUnits', 'InventoryCategories', 'InventoryItems', 'InventoryUsage', 'LoanedItems',
  'ServiceTypes', 'ServiceLogs',
  'AmbulanceCategories', 'AmbulanceTransactions', 'AmbulanceAssets',
  'Shifts', 'ShiftMembers',
  'BloodDonations', 'DonationItemTypes', 'CommunityDonations',
];

function toBound(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function isEmpty(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;
}

function insertMany(db, table, columns, rows) {
  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`);
  db.exec('BEGIN');
  try {
    for (const row of rows) stmt.run(row);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

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
const DEFAULT_MISSION_TYPES = [
  ['حالة مرضية', '#2f9e3a'], ['حالة وفاة', '#55615b'], ['حادث سير', '#c9252b'],
  ['غارة', '#7a2e2e'], ['استجابة ميدانية', '#1f6f28'], ['أخرى', '#b7a98b'],
];
const DEFAULT_SERVICE_TYPES = ['تغيير جرح', 'تقطيب', 'تعليق مصل', 'قياس ضغط', 'قياس سكر', 'حقن دواء', 'إسعافات أولية عامة'];
const DEFAULT_INVENTORY_UNITS = ['قطعة', 'صندوق', 'عبوة', 'زجاجة', 'كيس', 'طقم', 'لفة', 'زوج', 'غرام'];
const DEFAULT_INVENTORY_CATEGORIES = [
  'مستلزمات الحماية الشخصية', 'العناية بالجروح والضمادات', 'مستلزمات الحقن والمحاليل الوريدية',
  'معدات التنفس', 'القسطرة والمسالك البولية', 'معدات الحركة والتجهيزات الطبية',
  'التعقيم والأدوات الجراحية', 'النظافة والمطهرات', 'مستلزمات عامة',
];
const DEFAULT_AMBULANCE_CATEGORIES = [
  ['تبرعات', 'income'], ['دعم جهة مانحة', 'income'], ['اشتراكات', 'income'], ['إيرادات أخرى', 'income'],
  ['وقود', 'outcome'], ['صيانة', 'outcome'], ['تأمين', 'outcome'], ['رسوم وضرائب', 'outcome'], ['مصاريف أخرى', 'outcome'],
];
const DEFAULT_DONATION_ITEM_TYPES = ['دواء', 'حفاضات أطفال', 'حليب أطفال'];

// Starter data for every managed-list table, in case this table came up
// empty (no data-export.json, or the export simply never had rows for it) -
// mirrors what database/schema.sql used to seed inline for the SQL Server
// version. Skipped per-table if real data (imported or otherwise) is
// already there, so this never overwrites anything.
function seedDefaults(db) {
  if (isEmpty(db, 'Settings')) {
    insertMany(db, 'Settings', ['key', 'value'],
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));
    console.log('Settings: seeded defaults.');
  }
  if (isEmpty(db, 'MissionTypes')) {
    insertMany(db, 'MissionTypes', ['name', 'color', 'sort_order'],
      DEFAULT_MISSION_TYPES.map(([name, color], i) => ({ name, color, sort_order: i })));
    console.log('MissionTypes: seeded defaults.');
  }
  if (isEmpty(db, 'ServiceTypes')) {
    insertMany(db, 'ServiceTypes', ['name', 'sort_order'],
      DEFAULT_SERVICE_TYPES.map((name, i) => ({ name, sort_order: i })));
    console.log('ServiceTypes: seeded defaults.');
  }
  if (isEmpty(db, 'InventoryUnits')) {
    insertMany(db, 'InventoryUnits', ['name', 'sort_order'],
      DEFAULT_INVENTORY_UNITS.map((name, i) => ({ name, sort_order: i })));
    console.log('InventoryUnits: seeded defaults.');
  }
  if (isEmpty(db, 'InventoryCategories')) {
    insertMany(db, 'InventoryCategories', ['name', 'sort_order'],
      DEFAULT_INVENTORY_CATEGORIES.map((name, i) => ({ name, sort_order: i })));
    console.log('InventoryCategories: seeded defaults.');
  }
  if (isEmpty(db, 'AmbulanceCategories')) {
    insertMany(db, 'AmbulanceCategories', ['name', 'kind', 'sort_order'],
      DEFAULT_AMBULANCE_CATEGORIES.map(([name, kind], i) => ({ name, kind, sort_order: i })));
    console.log('AmbulanceCategories: seeded defaults.');
  }
  if (isEmpty(db, 'DonationItemTypes')) {
    insertMany(db, 'DonationItemTypes', ['name', 'sort_order'],
      DEFAULT_DONATION_ITEM_TYPES.map((name, i) => ({ name, sort_order: i })));
    console.log('DonationItemTypes: seeded defaults.');
  }
}

// Without this, a fresh database has zero rows in Users and nobody can log
// in - every user-management route requires an existing admin session, so
// there would be no way to create the first account short of editing the
// database file by hand.
function ensureAdminAccount(db) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM Users WHERE role = 'admin'").get().n;
  if (existing > 0) {
    console.log('An admin account already exists, not creating another.');
    return;
  }
  const username = process.env.ADMIN_USERNAME || 'admin';
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO Users (username, password_hash, display_name, role) VALUES (@u, @p, @d, 'admin')")
    .run({ u: username, p: bcrypt.hashSync(password, 12), d: 'المدير' });
  console.log('\nAdmin account created:');
  console.log(`  username: ${username}`);
  console.log(generated ? `  password: ${password}   (shown once - save it now)` : '  password: the ADMIN_PASSWORD you set');
}

function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  console.log(`Schema ready at ${DB_PATH}`);

  if (!fs.existsSync(EXPORT_PATH)) {
    console.log('No data-export.json found - nothing to import (fresh database).');
  } else {
    const dump = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));

    for (const table of IMPORT_ORDER) {
      const rows = dump[table] || [];
      if (!rows.length) continue;
      const already = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
      if (already > 0) {
        console.log(`${table}: already has ${already} row(s), skipping import.`);
        continue;
      }
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((c) => `@${c}`).join(', ');
      const stmt = db.prepare(`INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`);
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          const bound = {};
          for (const c of columns) bound[c] = toBound(row[c]);
          stmt.run(bound);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw new Error(`Importing ${table} failed: ${err.message}`);
      }
      console.log(`${table}: imported ${rows.length} row(s).`);
    }

    console.log('Import complete.');
  }

  seedDefaults(db);
  ensureAdminAccount(db);
}

main();
