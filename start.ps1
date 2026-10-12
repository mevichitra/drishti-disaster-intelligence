# DRISHTI - one-shot launcher (Windows / PowerShell)
#   .\start.ps1            start MongoDB (Docker), seed if empty, build UI, run server on :5055
#   .\start.ps1 -Reseed    wipe and regenerate the 3.6M-record dataset first (~35 s)
param([switch]$Reseed, [int]$Days = 365)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

docker compose -f "$root\docker-compose.yml" up -d | Out-Null
Start-Sleep 3

if (-not (Test-Path "$root\server\node_modules")) { Push-Location "$root\server"; npm install --no-audit --no-fund; Pop-Location }
if (-not (Test-Path "$root\client\node_modules")) { Push-Location "$root\client"; npm install --no-audit --no-fund; Pop-Location }

Push-Location "$root\client"; npm run build; Pop-Location

if ($Reseed) { $env:SEED_DAYS = $Days; Push-Location "$root\server"; node src/seed.js; Pop-Location }

Get-NetTCPConnection -LocalPort 5055 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Push-Location "$root\server"
try { node src/index.js } catch { Write-Host "Server exited: $_" }
if ($LASTEXITCODE -ne 0) { Write-Host "If the database is empty run:  .\start.ps1 -Reseed" }
Pop-Location
