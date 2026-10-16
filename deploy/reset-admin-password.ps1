# Resets an admin/editor account's password directly in the production
# SQLite database. Run as Administrator, from anywhere (it uses an absolute
# path to the db). Prompts for the password securely (not shown on screen,
# not something Claude ever sees).

$DbPath = 'C:\sites\risala-team-site\server\data\risala.db'

$Username = Read-Host "Username to reset (default: admin)"
if ([string]::IsNullOrWhiteSpace($Username)) { $Username = 'admin' }

$Password1 = Read-Host "New password" -AsSecureString
$Password2 = Read-Host "Confirm new password" -AsSecureString
$Plain1 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($Password1))
$Plain2 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($Password2))

if ($Plain1 -ne $Plain2) {
  Write-Host "Passwords don't match. Aborting." -ForegroundColor Red
  exit 1
}
if ($Plain1.Length -lt 8) {
  Write-Host "Password must be at least 8 characters. Aborting." -ForegroundColor Red
  exit 1
}

$NodeScript = @'
const path = require('path');
const bcrypt = require(path.join('C:\\sites\\risala-team-site\\server\\node_modules\\bcryptjs'));
const { DatabaseSync } = require('node:sqlite');

const [, , dbPath, username, password] = process.argv;
const db = new DatabaseSync(dbPath);
const user = db.prepare('SELECT id FROM Users WHERE username = @u').get({ u: username });
if (!user) {
  console.error(`No user found with username "${username}".`);
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
db.prepare('UPDATE Users SET password_hash = @h WHERE id = @id').run({ h: hash, id: user.id });
console.log(`Password updated for "${username}" (id ${user.id}).`);
'@
$NodeScriptPath = "$env:TEMP\reset-pw.js"
$NodeScript | Set-Content $NodeScriptPath -Encoding UTF8

node $NodeScriptPath $DbPath $Username $Plain1

Remove-Item $NodeScriptPath -Force
Remove-Variable Plain1, Plain2 -ErrorAction SilentlyContinue

Write-Host "`nRestart the app so nothing has a stale session expecting the old password check logic (not required, but tidy):" -ForegroundColor Cyan
Write-Host "  pm2 restart risala-site"
