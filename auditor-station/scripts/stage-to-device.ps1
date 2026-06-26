<#
  SQ2-0 — Stage the Gate 0 kit onto a removable device (e.g. D:\).
  Part of the Auditor Station side quest (SQ-2). Repeatable; safe to re-run.

  WHAT IT COPIES (never the repo, never PII):
    - gate0-smoke-test.ps1   (the only thing you need to run Gate 0)
    - INSTALL.md             (the guide, so it travels with the kit)
    - run-gate0.cmd          (double-click runner, generated)
    - MANIFEST.sha256        (integrity check for the kit, generated)
  Optionally (-IncludeModels): the local Ollama model blobs, for an AIR-GAPPED laptop
    that has no internet to `ollama pull`. This is large (a 14B is ~9 GB).

  GOVERNANCE: this kit has NO catalog.db and NO citizen data — Gate 0 only proves the
  model emits tool calls. The data bundle is a later, separate, encrypted transfer.

  Usage (from this folder, on the machine that HAS the models):
    powershell -ExecutionPolicy Bypass -File .\stage-to-device.ps1
    # custom drive / with models for an air-gapped target:
    .\stage-to-device.ps1 -Drive E:\ -IncludeModels
#>

param(
  [string] $Drive        = "D:\",
  [string] $FolderName   = "auditor-station-gate0",
  [switch] $IncludeModels
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Drive)) {
  Write-Host "Removable device not found at '$Drive'. Plug it in or pass -Drive E:\" -ForegroundColor Red
  exit 1
}

$here    = $PSScriptRoot                                   # ...\auditor-station\scripts
$station = Split-Path $here -Parent                        # ...\auditor-station
$dest    = Join-Path $Drive $FolderName
New-Item -ItemType Directory -Path $dest -Force | Out-Null

Write-Host ""
Write-Host "==================== Stage Gate 0 kit ====================" -ForegroundColor Cyan
Write-Host ("Target : {0}" -f $dest)
Write-Host ""

# ---- 1. the two files that matter ----
$payload = @(
  @{ src = (Join-Path $here    "gate0-smoke-test.ps1"); name = "gate0-smoke-test.ps1" },
  @{ src = (Join-Path $station "INSTALL.md");           name = "INSTALL.md" }
)
foreach ($p in $payload) {
  if (-not (Test-Path $p.src)) { Write-Host ("  MISSING: {0}" -f $p.src) -ForegroundColor Red; exit 1 }
  Copy-Item $p.src (Join-Path $dest $p.name) -Force
  Write-Host ("  copied  {0}" -f $p.name) -ForegroundColor Green
}

# ---- 2. a double-click runner (so the auditor needn't type the bypass flag) ----
$runner = @'
@echo off
REM Gate 0 — double-click to run the local model smoke test.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\gate0-smoke-test.ps1"
echo.
pause
'@
Set-Content -Path (Join-Path $dest "run-gate0.cmd") -Value $runner -Encoding ascii
Write-Host "  wrote   run-gate0.cmd (double-click runner)" -ForegroundColor Green

# ---- 3. optional: Ollama model blobs for an air-gapped laptop ----
if ($IncludeModels) {
  $modelsSrc = Join-Path $env:USERPROFILE ".ollama\models"
  if (-not (Test-Path $modelsSrc)) {
    Write-Host ("  -IncludeModels: no models found at {0}" -f $modelsSrc) -ForegroundColor Yellow
  } else {
    $modelsDest = Join-Path $dest "ollama-models"
    $sizeGb = [math]::Round((Get-ChildItem $modelsSrc -Recurse -File | Measure-Object Length -Sum).Sum / 1GB, 1)
    Write-Host ("  copying Ollama models (~{0} GB) ... this can take a while" -f $sizeGb) -ForegroundColor DarkGray
    Copy-Item $modelsSrc $modelsDest -Recurse -Force
    Write-Host ("  copied  ollama-models\  ({0} GB)" -f $sizeGb) -ForegroundColor Green
    Write-Host "    On the air-gapped laptop, copy this folder's contents into:" -ForegroundColor DarkGray
    Write-Host "      %USERPROFILE%\.ollama\models   (then Ollama sees the models offline)" -ForegroundColor DarkGray
  }
}

# ---- 4. integrity manifest for the kit ----
$manifest = Get-ChildItem $dest -Recurse -File | Where-Object { $_.Name -ne "MANIFEST.sha256" } |
  ForEach-Object {
    $rel = $_.FullName.Substring($dest.Length).TrimStart('\')
    "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash, $rel
  }
Set-Content -Path (Join-Path $dest "MANIFEST.sha256") -Value $manifest -Encoding ascii
Write-Host "  wrote   MANIFEST.sha256" -ForegroundColor Green

Write-Host ""
Write-Host "Done. On the auditor laptop: open the folder on the device and double-click run-gate0.cmd" -ForegroundColor Cyan
Write-Host ("  (or copy {0} to the laptop's local disk first, then run it there)" -f $FolderName) -ForegroundColor DarkGray
Write-Host ""
