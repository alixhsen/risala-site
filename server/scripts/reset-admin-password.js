// Resets a user's password directly in the local SQLite file.
// Usage: node scripts/reset-admin-password.js <username> <new-password>
const path = require('path');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const [username = 'admin', password] = process.argv.slice(2);
if (!password || password.length < 8) {
  console.error('Usage: node scripts/reset-admin-password.js <username> <new-password (8+ chars)>');
  process.exit(1);
}
const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'risala.db'));
const res = db.prepare('UPDATE Users SET password_hash = ?, active = 1 WHERE username = ?').run(bcrypt.hashSync(password, 12), username);
if (res.changes === 0) {
  console.error(`No user named "${username}". Existing users: ${db.prepare('SELECT username FROM Users').all().map((u) => u.username).join(', ')}`);
  process.exit(1);
}
console.log(`Password for "${username}" updated.`);
