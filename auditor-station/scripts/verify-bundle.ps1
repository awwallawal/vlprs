<#
  verify-bundle.ps1 — confirm a copied Auditor Station bundle is intact (SQ2-8).

  Dependency-free (PowerShell only) so it runs BEFORE `pnpm install`. Recomputes the SHA-256 of
  every file listed in BUNDLE.sha256 and compares. Run it on the laptop after copying from D:.

    powershell -ExecutionPolicy Bypass -File .\scripts\verify-bundle.ps1
    # or double-click verify-bundle.cmd at the bundle root.
#>

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
# Bundle root is wherever BUNDLE.sha256 lives (script may sit at root or in scripts\).
$root = if (Test-Path (Join-Path $here "BUNDLE.sha256")) { $here } else { Split-Path $here -Parent }
$manifest = Join-Path $root "BUNDLE.sha256"

if (-not (Test-Path $manifest)) {
  Write-Host "BUNDLE.sha256 not found near $here - is this an Auditor Station bundle?" -ForegroundColor Red
  exit 1
}

Write-Host "Verifying bundle at: $root" -ForegroundColor Cyan
$fail = 0; $ok = 0
foreach ($line in Get-Content $manifest) {
  if (-not $line.Trim()) { continue }
  $parts    = $line -split '\s+', 2
  $expected = $parts[0].ToLower()
  $rel      = $parts[1].Trim()
  $path     = Join-Path $root $rel
  if (-not (Test-Path $path)) { Write-Host "MISSING  $rel" -ForegroundColor Yellow; $fail++; continue }
  $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expected) { Write-Host "MISMATCH $rel" -ForegroundColor Yellow; $fail++ }
  else { $ok++ }
}

Write-Host ""
if ($fail -eq 0) {
  Write-Host "OK - $ok files verified. Bundle is intact." -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILED - $fail problem(s). Do NOT use this copy; re-copy from D: and re-verify." -ForegroundColor Red
  exit 1
}
