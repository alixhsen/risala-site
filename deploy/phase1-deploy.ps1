# Phase 1: deploy risala-team-site standalone under PM2 on port 4000.
# Does NOT touch IIS, ramya's site, or any existing port/binding - purely
# additive (new folder, new PM2 process, new port). Run as Administrator.

$ErrorActionPreference = 'Stop'
$RepoUrl   = 'https://github.com/alixhsen/risala-site.git'
$TargetDir = 'C:\sites\risala-team-site'
$Port      = 4000

Write-Host "`n=== 1. Checking port $Port is free ===" -ForegroundColor Cyan
$inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
  throw "Port $Port is already in use by process $($inUse.OwningProcess). Aborting - edit `$Port in this script and retry."
}
Write-Host "Port $Port is free." -ForegroundColor Green

Write-Host "`n=== 2. Getting the code ===" -ForegroundColor Cyan
if (Test-Path $TargetDir) {
  Write-Host "Directory exists - pulling latest instead of cloning." -ForegroundColor Yellow
  Set-Location $TargetDir
  git pull
} else {
  git clone $RepoUrl $TargetDir
  Set-Location $TargetDir
}
# If the clone/pull above failed with an auth error, the repo is private -
# you'll need a GitHub personal access token in the URL (or an SSH deploy
# key) - see the chat message for details.

Write-Host "`n=== 3. Installing dependencies (root + server + client) ===" -ForegroundColor Cyan
npm run setup

Write-Host "`n=== 4. Setting PORT=$Port in server\.env ===" -ForegroundColor Cyan
$envPath = Join-Path $TargetDir 'server\.env'
$envContent = Get-Content $envPath
if ($envContent -match '^PORT=') {
  $envContent = $envContent -replace '^PORT=.*', "PORT=$Port"
} else {
  $envContent += "PORT=$Port"
}
$envContent | Set-Content $envPath

Write-Host "`n=== 5. Review server\.env before continuing ===" -ForegroundColor Yellow
Write-Host "Opening it in Notepad. If you want to CHOOSE the first admin"
Write-Host "username/password yourself, set ADMIN_USERNAME / ADMIN_PASSWORD now."
Write-Host "Otherwise a random password is generated and printed once in step 6."
notepad $envPath
Read-Host "Press Enter here once you've saved/closed Notepad to continue"

Write-Host "`n=== 6. Creating the database (first run only - safe to re-run) ===" -ForegroundColor Cyan
npm run db:init

Write-Host "`n=== 7. Building the production client ===" -ForegroundColor Cyan
Write-Host "(This step is memory-hungry. If it fails or hangs on this small" -ForegroundColor Yellow
Write-Host " VPS, run: pm2 stop ramya-whatever-its-called ; npm run build ; pm2 restart that-app" -ForegroundColor Yellow
npm run build

Write-Host "`n=== 8. Starting under PM2 ===" -ForegroundColor Cyan
try { pm2 delete risala-site 2>$null | Out-Null } catch { }  # ignore error if it doesn't exist yet (fresh install)
$env:NODE_ENV = 'production'
pm2 start "$TargetDir\server\src\index.js" --name risala-site --cwd "$TargetDir"
pm2 save

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "Test the site at:   http://185.192.23.234:$Port"
Write-Host "Admin panel at:     http://185.192.23.234:$Port/admin"
Write-Host "`nCheck it's healthy with: pm2 logs risala-site --lines 50"
Write-Host "Check memory with:       Get-Process node | Select-Object Id,WorkingSet"
