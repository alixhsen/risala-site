# Read-only discovery script. Makes NO changes to the server - just reports
# what's already installed/running so a deployment plan for risala-team-site
# can be written that won't collide with the existing ramya app.
# Run this in an elevated PowerShell session (Run as Administrator) on the
# VPS itself (via RDP), then copy/paste its full output back.

Write-Host "`n==================== SYSTEM ====================" -ForegroundColor Cyan
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, OSArchitecture, Version
Write-Host "CPU cores:" (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
$mem = Get-CimInstance Win32_OperatingSystem
Write-Host ("RAM: {0:N0} MB total, {1:N0} MB free" -f ($mem.TotalVisibleMemorySize/1KB), ($mem.FreePhysicalMemory/1KB))
Get-PSDrive C | Select-Object @{n='Drive';e={$_.Name}}, @{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}}, @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}

Write-Host "`n==================== NODE / GIT / RUNTIMES ====================" -ForegroundColor Cyan
foreach ($cmd in @('node','npm','git','pm2','nssm')) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) {
    try { $ver = & $cmd --version 2>$null } catch { $ver = '(found, version check failed)' }
    Write-Host "  $cmd : $($found.Source) -> $ver"
  } else {
    Write-Host "  $cmd : NOT FOUND" -ForegroundColor Yellow
  }
}

Write-Host "`n==================== IIS ====================" -ForegroundColor Cyan
$iis = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
if ($iis -and $iis.InstallState -eq 'Installed') {
  Write-Host "IIS is installed." -ForegroundColor Green
  Import-Module WebAdministration -ErrorAction SilentlyContinue
  Write-Host "`n--- IIS Sites ---"
  Get-Website | Select-Object Name, State, PhysicalPath, @{n='Bindings';e={($_.bindings.Collection | ForEach-Object { $_.bindingInformation + ' (' + $_.protocol + ')' }) -join '; '}} | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
  Write-Host "--- Installed IIS modules (looking for ARR / URL Rewrite) ---"
  Get-WebGlobalModule -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Rewrite|ApplicationRequestRouting|ARR' } | Select-Object Name
  $arrReg = Test-Path 'HKLM:\SOFTWARE\Microsoft\ARR'
  Write-Host "ARR registry key present: $arrReg"
} else {
  Write-Host "IIS is NOT installed." -ForegroundColor Yellow
}

Write-Host "`n==================== LISTENING PORTS (with owning process) ====================" -ForegroundColor Cyan
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Sort-Object LocalPort |
  Select-Object LocalAddress, LocalPort, OwningProcess, @{n='Process';e={ (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName }} |
  Format-Table -AutoSize | Out-String -Width 200 | Write-Host

Write-Host "`n==================== NODE.EXE PROCESSES (to find ramya's app folder/port) ====================" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Select-Object ProcessId, CommandLine | Format-List | Out-String -Width 300 | Write-Host

Write-Host "`n==================== WINDOWS SERVICES (node/pm2/nssm-related) ====================" -ForegroundColor Cyan
Get-Service | Where-Object { $_.Name -match 'node|pm2|ramya|risala' -or $_.DisplayName -match 'node|pm2|ramya|risala' } |
  Select-Object Name, DisplayName, Status | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

Write-Host "`n==================== SCHEDULED TASKS (node/pm2-related) ====================" -ForegroundColor Cyan
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match 'node|pm2|ramya|risala' } |
  Select-Object TaskName, State | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

Write-Host "`n==================== FIREWALL (enabled inbound rules with a specific local port) ====================" -ForegroundColor Cyan
Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue |
  Get-NetFirewallPortFilter |
  Where-Object { $_.LocalPort -and $_.LocalPort -ne 'Any' } |
  Select-Object LocalPort, Protocol -Unique | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

Write-Host "`n==================== DONE - copy everything above back ====================" -ForegroundColor Cyan
