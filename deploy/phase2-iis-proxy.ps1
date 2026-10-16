# Phase 2: reverse-proxy risalabirhasan.com (IIS) -> localhost:4000 (Node/PM2).
# Installs URL Rewrite + ARR (additive IIS modules - ramya's static site
# doesn't use rewrite rules, so this doesn't affect it), then creates a new
# IIS site with host-header bindings for the domain. Run as Administrator,
# AFTER Phase 1 is confirmed working at http://185.192.23.234:4000.

$ErrorActionPreference = 'Stop'
$Domain      = 'risalabirhasan.com'
$WwwDomain   = 'www.risalabirhasan.com'
$NodePort    = 4000
$SiteName    = 'RisalaBirHasan'
$SitePath    = 'C:\sites\risala-proxy'   # empty folder, just holds web.config
$TargetDir   = 'C:\sites\risala-team-site'

Write-Host "`n=== 1. Install URL Rewrite module (if missing) ===" -ForegroundColor Cyan
$rewriteInstalled = Get-WebGlobalModule -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'RewriteModule' }
if (-not $rewriteInstalled) {
  $msi = "$env:TEMP\rewrite_amd64.msi"
  Invoke-WebRequest 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile $msi
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
  Write-Host "URL Rewrite installed." -ForegroundColor Green
} else {
  Write-Host "URL Rewrite already installed." -ForegroundColor Green
}

Write-Host "`n=== 2. Install Application Request Routing (ARR) (if missing) ===" -ForegroundColor Cyan
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\ARR')) {
  $msi = "$env:TEMP\requestRouter_amd64.msi"
  Invoke-WebRequest 'https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi' -OutFile $msi
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
  Write-Host "ARR installed." -ForegroundColor Green
} else {
  Write-Host "ARR already installed." -ForegroundColor Green
}

Write-Host "`n=== 3. Restart IIS so the new modules load, then enable ARR proxying ===" -ForegroundColor Cyan
iisreset
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"

Write-Host "`n=== 4. Create the site folder + reverse-proxy web.config ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $SitePath | Out-Null
@"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToRisalaNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:$NodePort/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
"@ | Set-Content "$SitePath\web.config" -Encoding UTF8

Write-Host "`n=== 5. Create the IIS site with host-header bindings ===" -ForegroundColor Cyan
Import-Module WebAdministration
if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
  Write-Host "Site '$SiteName' already exists - skipping creation. Check its bindings manually if needed." -ForegroundColor Yellow
} else {
  New-Website -Name $SiteName -PhysicalPath $SitePath -Port 80 -HostHeader $Domain
  New-WebBinding -Name $SiteName -Protocol http -Port 80 -HostHeader $WwwDomain
  Write-Host "Site '$SiteName' created, bound to $Domain and $WwwDomain on port 80." -ForegroundColor Green
}

Write-Host "`n=== 6. Point risala-site's TRUST_PROXY setting at IIS ===" -ForegroundColor Cyan
$envPath = Join-Path $TargetDir 'server\.env'
$envContent = Get-Content $envPath
if ($envContent -match '^TRUST_PROXY=') {
  $envContent = $envContent -replace '^TRUST_PROXY=.*', 'TRUST_PROXY=1'
} else {
  $envContent += 'TRUST_PROXY=1'
}
if ($envContent -match '^CLIENT_ORIGIN=') {
  $envContent = $envContent -replace '^CLIENT_ORIGIN=.*', "CLIENT_ORIGIN=http://$Domain"
} else {
  $envContent += "CLIENT_ORIGIN=http://$Domain"
}
$envContent | Set-Content $envPath
pm2 restart risala-site

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "Once DNS for $Domain / $WwwDomain points at 185.192.23.234, test:"
Write-Host "  http://$Domain"
Write-Host "`nHTTPS is NOT set up yet - that's a separate step (win-acme / Let's Encrypt)"
Write-Host "to run once DNS has propagated. Ask for that script when you're ready."
