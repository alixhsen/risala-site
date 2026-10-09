const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { query } = require('./src/db.js');
(async () => {
  const username = 'qa_social_test';
  const password = 'QaTest!2026';
  const hash = await bcrypt.hash(password, 10);
  const existing = await query('SELECT id FROM dbo.Users WHERE username = @u', { u: username });
  if (existing.length) {
    await query('UPDATE dbo.Users SET password_hash = @h, active = 1 WHERE username = @u', { h: hash, u: username });
  } else {
    await query(
      `INSERT INTO dbo.Users (username, password_hash, display_name, role, active) VALUES (@u, @h, @d, 'admin', 1)`,
      { u: username, h: hash, d: 'QA Social Test' }
    );
  }
  console.log('ready');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
