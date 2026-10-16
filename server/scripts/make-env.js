// Creates server/.env from .env.example with a fresh random JWT secret.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('server/.env already exists, leaving it unchanged.');
} else {
  const secret = crypto.randomBytes(48).toString('hex');
  const text = fs.readFileSync(examplePath, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  fs.writeFileSync(envPath, text);
  console.log('Created server/.env. Now run: npm run db:init');
}
