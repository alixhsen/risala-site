// One-off: dumps every row from the local server/data/risala.db into
// server/data-export.json, in the exact shape init-sqlite.js's importer
// expects ({ TableName: [ {col: value, ...}, ... ] }). Run locally, then
// copy the resulting file to the production server as server/data-export.json
// before running `npm run db:init` there.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'data', 'risala.db'));

const TABLES = [
  'Users', 'Settings', 'MissionTypes', 'TeamMembers',
  'Posts', 'PostImages', 'PostParamedics',
  'GalleryImages', 'Messages',
  'InventoryUnits', 'InventoryCategories', 'InventoryItems', 'InventoryUsage', 'LoanedItems',
  'ServiceTypes', 'ServiceLogs',
  'AmbulanceCategories', 'AmbulanceTransactions', 'AmbulanceAssets',
  'Shifts', 'ShiftMembers',
  'BloodDonations', 'DonationItemTypes', 'CommunityDonations',
];

const dump = {};
for (const table of TABLES) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  dump[table] = rows;
  console.log(`${table}: ${rows.length} row(s)`);
}

const outPath = path.join(__dirname, 'data-export.json');
fs.writeFileSync(outPath, JSON.stringify(dump), 'utf8');
console.log(`\nWrote ${outPath}`);
