<#
  SQ2-0 — Gate 0 smoke test: does a local Ollama model reliably emit a TOOL CALL?
  Part of the Auditor Station side quest (SQ-2). Repeatable; safe to re-run.

  What it does, per model:
    - warm-up call (loads the model; not scored)
    - N measured calls with one tool defined + a question that SHOULD trigger it
    - records: tool-call hit rate, tool name, tokens/sec (avg), one-time load seconds
  Then prints a results table, picks a winner, and writes a log file you can keep.

  This needs ONLY Ollama + the models. No catalog.db, no repo, no real tools.

  Usage (from this folder):
    powershell -ExecutionPolicy Bypass -File .\gate0-smoke-test.ps1
    # -Models omitted => auto-detects every installed candidate (3B/7B/14B) and tests each.
    # or pin an explicit set:
    .\gate0-smoke-test.ps1 -Models qwen2.5:14b,qwen2.5:7b,qwen2.5:3b -Repeats 5
#>

param(
  # Empty => auto-detect installed candidates from `ollama list` (see $Candidates below).
  [string[]] $Models   = @(),
  [int]      $Repeats  = 5,
  [string]   $Question = "Trace BADMUS F.G. across all MDAs",
  [string]   $OllamaUrl = "http://localhost:11434"
)

# Known-good tool-capable candidates, largest -> smallest. Auto-detect tests whichever are pulled.
$Candidates = @("qwen2.5:14b", "qwen2.5:7b", "qwen2.5:3b", "llama3.2:3b")

$ErrorActionPreference = "Stop"

# ---- the single tool the model should choose ----
$tools = @(
  @{
    type = "function"
    function = @{
      name = "search_beneficiary"
      description = "Search for a car-loan beneficiary by name across all MDAs. Use this whenever the user asks to trace, find, or look up a person."
      parameters = @{
        type = "object"
        properties = @{
          name = @{ type = "string"; description = "The person name to search for" }
        }
        required = @("name")
      }
    }
  }
)

function Invoke-OllamaChat($model) {
  $bodyObj = @{
    model    = $model
    stream   = $false
    messages = @( @{ role = "user"; content = $Question } )
    tools    = $tools
  }
  $body = $bodyObj | ConvertTo-Json -Depth 12
  return Invoke-RestMethod -Uri "$OllamaUrl/api/chat" -Method Post `
           -Body $body -ContentType "application/json" -TimeoutSec 600
}

# ---- environment banner ----
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Host ""
Write-Host "==================== SQ2-0 Gate 0 smoke test ====================" -ForegroundColor Cyan
Write-Host ("Laptop RAM : {0} GB   ({1})" -f $ramGb, $(if ($ramGb -ge 15) {"16GB tier -> 7B/14B viable"} elseif ($ramGb -ge 7) {"8GB tier -> 3B floor"} else {"under 8GB -> below floor, results may be unreliable"}))
Write-Host ("Ollama URL : {0}" -f $OllamaUrl)
Write-Host ("Question   : {0}" -f $Question)
Write-Host ("Repeats    : {0} measured calls per model" -f $Repeats)
Write-Host ""

# ---- reachability + which models are present ----
try {
  $tags = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -Method Get -TimeoutSec 30
} catch {
  Write-Host "Cannot reach Ollama at $OllamaUrl. Is it installed and running? (OllamaSetup.exe)" -ForegroundColor Red
  exit 1
}
$present = @($tags.models | ForEach-Object { $_.name })

# ---- auto-detect: if no -Models given, test every installed candidate ----
if (-not $Models -or $Models.Count -eq 0) {
  $Models = $Candidates | Where-Object { $c = $_; $present | Where-Object { $_ -eq $c -or $_ -like "$c*" } }
  if (-not $Models -or $Models.Count -eq 0) {
    Write-Host "No known candidates pulled. Run e.g.:  ollama pull qwen2.5:7b" -ForegroundColor Yellow
    $Models = $Candidates  # show the 'not pulled' hints
  }
}
Write-Host ("Models     : {0}" -f ($Models -join ", ")) -ForegroundColor DarkGray
Write-Host ("Installed  : {0}" -f ($present -join ", ")) -ForegroundColor DarkGray
Write-Host ""

$results = @()

foreach ($model in $Models) {
  Write-Host ("--- {0} ---" -f $model) -ForegroundColor Cyan

  # is it pulled? (tags carry names like 'qwen2.5:3b'; match exact or prefix)
  $have = $present | Where-Object { $_ -eq $model -or $_ -like "$model*" }
  if (-not $have) {
    Write-Host ("  NOT PULLED. Run:  ollama pull {0}" -f $model) -ForegroundColor Yellow
    $results += [pscustomobject]@{ Model=$model; ToolCalls="--"; Rate="not pulled"; "Tok/s"="--"; "Load(s)"="--"; LastTool="--" }
    continue
  }

  # warm-up (load) — not scored
  $loadSec = "--"
  try {
    $warm = Invoke-OllamaChat $model
    if ($warm.load_duration) { $loadSec = [math]::Round($warm.load_duration / 1e9, 1) }
  } catch {
    Write-Host ("  ERROR on warm-up: {0}" -f $_.Exception.Message) -ForegroundColor Red
    $results += [pscustomobject]@{ Model=$model; ToolCalls="--"; Rate="error"; "Tok/s"="--"; "Load(s)"=$loadSec; LastTool="--" }
    continue
  }

  $hits = 0; $tpsList = @(); $lastTool = ""
  for ($i = 1; $i -le $Repeats; $i++) {
    $r = Invoke-OllamaChat $model
    $tc = $r.message.tool_calls
    if ($tc) {
      $hits++
      $lastTool = $tc[0].function.name
      $argTxt = ($tc[0].function.arguments | ConvertTo-Json -Compress)
      Write-Host ("  call {0}/{1}: TOOL CALL  name={2} args={3}" -f $i, $Repeats, $lastTool, $argTxt) -ForegroundColor Green
    } else {
      $snippet = ($r.message.content -replace "\s+"," ")
      if ($snippet.Length -gt 70) { $snippet = $snippet.Substring(0,70) + "..." }
      Write-Host ("  call {0}/{1}: prose (no tool)  '{2}'" -f $i, $Repeats, $snippet) -ForegroundColor Yellow
    }
    if ($r.eval_count -and $r.eval_duration) {
      $tpsList += [math]::Round($r.eval_count / ($r.eval_duration / 1e9), 1)
    }
  }

  $avgTps = if ($tpsList.Count) { [math]::Round(($tpsList | Measure-Object -Average).Average, 1) } else { "--" }
  $rate   = "{0}/{1}" -f $hits, $Repeats
  Write-Host ("  => tool-call rate {0}, avg {1} tok/s, load {2}s" -f $rate, $avgTps, $loadSec)
  Write-Host ""

  $results += [pscustomobject]@{
    Model     = $model
    ToolCalls = $hits
    Rate      = $rate
    "Tok/s"   = $avgTps
    "Load(s)" = $loadSec
    LastTool  = if ($lastTool) { $lastTool } else { "(none)" }
  }
}

# ---- results table ----
Write-Host "==================== RESULTS ====================" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host

# ---- winner: highest tool-call hits, tiebreak tokens/sec ----
$scored = $results | Where-Object { $_.ToolCalls -is [int] }
if ($scored) {
  $winner = $scored | Sort-Object `
    @{ Expression = { [int]$_.ToolCalls }; Descending = $true }, `
    @{ Expression = { if ($_."Tok/s" -eq "--") { 0 } else { [double]$_."Tok/s" } }; Descending = $true } |
    Select-Object -First 1
  Write-Host ("RECOMMENDED PIN: {0}   (rate {1}, {2} tok/s)" -f $winner.Model, $winner.Rate, $winner."Tok/s") -ForegroundColor Green
  if ([int]$winner.ToolCalls -lt $Repeats) {
    Write-Host "NOTE: winner did not hit 100% -> the SQ2-4 deterministic fallback router is required (already planned)." -ForegroundColor Yellow
  }
  Write-Host "Record this model:quant string in SQ2-0 DoD and station.config." -ForegroundColor Green
} else {
  Write-Host "No model produced a scorable result. Pull a model first: ollama pull qwen2.5:3b" -ForegroundColor Yellow
}

# ---- log file for the SQ2-0 record ----
$stamp = (Get-Date).ToString("yyyy-MM-dd-HHmmss")
$logDir = Join-Path $PSScriptRoot "..\audit"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logPath = Join-Path $logDir "gate0-smoke-$stamp.txt"
@(
  "SQ2-0 Gate 0 smoke test"
  "when      : $stamp"
  "laptop RAM: $ramGb GB"
  "question  : $Question"
  "repeats   : $Repeats"
  ""
  ($results | Format-Table -AutoSize | Out-String)
) | Set-Content -Path $logPath -Encoding utf8
Write-Host ("Log written: {0}" -f $logPath) -ForegroundColor DarkGray
