#Requires -Version 5.1
<#
.SYNOPSIS
  Start the FastAPI backend and the Vite dev server together.

.DESCRIPTION
  Requires backend/.venv and frontend/node_modules to exist.
  Use -Sandbox when running inside the DSH sandbox so Vite/Vitest use the
  project-local preload workaround.

.EXAMPLE
  .\scripts\dev.ps1
  .\scripts\dev.ps1 -Sandbox
#>
param(
  [switch]$Sandbox
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$python = Join-Path $backend '.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
  throw "Missing $python. Create the backend venv first (see docs/ENVIRONMENT.md)."
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  throw "Missing frontend/node_modules. Run npm install first (see README.md)."
}

Write-Host 'Starting FastAPI on http://127.0.0.1:8000 ...' -ForegroundColor Cyan
$backendProcess = Start-Process `
  -FilePath $python `
  -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000') `
  -WorkingDirectory $backend `
  -PassThru

try {
  Push-Location $frontend
  Write-Host 'Starting Vite on http://127.0.0.1:5173 ...' -ForegroundColor Cyan
  if ($Sandbox) {
    npm run dev:sandbox
  } else {
    npm run dev
  }
} finally {
  Pop-Location
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Write-Host 'Stopping FastAPI ...' -ForegroundColor DarkGray
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
