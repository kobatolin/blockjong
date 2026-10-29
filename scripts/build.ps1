#Requires -Version 5.1
<#
.SYNOPSIS
  Build the frontend, typecheck the backend and verify the production bundle.

.EXAMPLE
  .\scripts\build.ps1
  .\scripts\build.ps1 -Sandbox
#>
param(
  [switch]$Sandbox,
  [switch]$Test
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$backend = Join-Path $root 'backend'
$python = Join-Path $backend '.venv\Scripts\python.exe'

if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  throw "Missing frontend/node_modules. Run npm install first (see README.md)."
}
if (-not (Test-Path $python)) {
  throw "Missing $python. Create the backend venv first (see docs/ENVIRONMENT.md)."
}

Push-Location $frontend
try {
  if ($Test) {
    if ($Sandbox) { npm run test:sandbox } else { npm run test }
    if ($LASTEXITCODE -ne 0) { throw 'Vitest failed.' }
  }
  if ($Sandbox) { npm run build:sandbox } else { npm run build }
  if ($LASTEXITCODE -ne 0) { throw 'Vite build failed.' }
} finally {
  Pop-Location
}

Push-Location $backend
try {
  & $python -m py_compile `
    app\main.py `
    app\config.py `
    app\schemas.py `
    app\routers\config.py `
    app\routers\assets.py
  if ($LASTEXITCODE -ne 0) { throw 'py_compile failed.' }
} finally {
  Pop-Location
}

$distIndex = Join-Path $frontend 'dist\index.html'
if (-not (Test-Path $distIndex)) {
  throw "Build output missing: $distIndex"
}

Write-Host ''
Write-Host 'Build OK.' -ForegroundColor Green
Write-Host "  frontend/dist  -> served by FastAPI at http://127.0.0.1:8000"
Write-Host '  next: cd backend; .\.venv\Scripts\python -m uvicorn app.main:app --port 8000'
