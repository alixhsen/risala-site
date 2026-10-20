// One-off/reusable importer for donor data exported from the old Firebase
// Realtime Database ("Risala Donate", risaladonate.web.app) into the new
// self-hosted BloodDonors registry. Safe to re-run: any phone number already
// in the table is skipped, so running it again with the same (or a newer)
// export never creates duplicates.
//
// Usage: node server/scripts/import-blood-donors.js <path-to-export.json>
// Expects the RTDB export shape: { "Donors": { "<key>": { name, phone,
// bloodType, city, district, governorate, timestamp, ... }, ... } }
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'risala.db');
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function toArea(d) {
  const parts = [d.city, d.district, d.governorate].map((p) => (p || '').trim()).filter(Boolean);
  return [...new Set(parts)].join('، ').slice(0, 100);
}

function toCreatedAt(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node server/scripts/import-blood-donors.js <path-to-export.json>');
    process.exit(1);
  }
  const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
  const donors = dump.Donors || dump;

  const db = new DatabaseSync(DB_PATH);
  const exists = db.prepare('SELECT 1 FROM BloodDonors WHERE phone = @phone');
  const insert = db.prepare(`
    INSERT INTO BloodDonors (name, phone, blood_type, area, created_at)
    VALUES (@name, @phone, @blood_type, @area, COALESCE(@created_at, datetime('now')))`);

  let inserted = 0, skippedDuplicate = 0, skippedInvalid = 0;
  db.exec('BEGIN');
  try {
    for (const [key, d] of Object.entries(donors)) {
      const name = (d.name || '').trim();
      const phone = String(d.phone ?? key).trim();
      const blood_type = BLOOD_TYPES.includes(d.bloodType) ? d.bloodType : null;
      if (!name || !phone || !blood_type) { skippedInvalid++; continue; }
      if (exists.get({ phone })) { skippedDuplicate++; continue; }
      insert.run({ name, phone, blood_type, area: toArea(d) || null, created_at: toCreatedAt(d.timestamp) });
      inserted++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`Imported ${inserted} donor(s). Skipped ${skippedDuplicate} duplicate(s), ${skippedInvalid} invalid record(s).`);
}

main();
