$ErrorActionPreference = 'Stop'

param(
  [string]$InstallDir,
  [string]$ServiceName = 'MuBrowserScheduler'
)

# ----------------------------
# 1) GUARANTEED LOGGING
# Try ProgramData first, fallback to TEMP if ProgramData fails
# ----------------------------
$logDirPrimary = Join-Path $env:ProgramData 'MuBrowserScheduler'
$logDirFallback = Join-Path $env:TEMP 'MuBrowserScheduler'
$logDir = $logDirPrimary

try {
  New-Item -ItemType Directory -Force -Path $logDirPrimary | Out-Null
} catch {
  $logDir = $logDirFallback
  New-Item -ItemType Directory -Force -Path $logDirFallback | Out-Null
}

$logFile = Join-Path $logDir 'service-install.log'

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $logFile -Value $line
}

function IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function RunSc([string[]]$args) {
  Log ("sc.exe " + ($args -join " "))
  & sc.exe @args 2>&1 | ForEach-Object { Log $_ }
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe failed (exit=$LASTEXITCODE): sc.exe $($args -join ' ')"
  }
}

try {
  Log "=== Installing Scheduler Service ==="
  Log "LogFile: $logFile"
  Log "RunningAsAdmin: $(IsAdmin)"
  Log "InstallDir arg: '$InstallDir'"
  Log "PSScriptRoot: '$PSScriptRoot'"

  # ----------------------------
  # 2) ADMIN REQUIRED CHECK
  # ----------------------------
  if (-not (IsAdmin)) {
    throw "Not running as Administrator. Service install requires admin."
  }

  # If installer didn't pass InstallDir, infer from script folder
  if (-not $InstallDir) {
    $InstallDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  }
  Log "Resolved InstallDir: '$InstallDir'"

  # ----------------------------
  # 3) FIND SERVICE EXE (prefer dedicated scheduler exe)
  # ----------------------------
  $serviceExe = Join-Path $InstallDir 'service\MuulScheduler.exe'
  $exePath = $null

  if (Test-Path $serviceExe) {
    $exePath = $serviceExe
    Log "Using dedicated service exe: $exePath"
  } else {
    Log "Dedicated service exe not found at $serviceExe, falling back to MuulBrowser*.exe --scheduler-service"
    $fallback = Get-ChildItem -Path $InstallDir -Filter "*.exe" -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "MuulBrowser*.exe" } |
      Select-Object -First 1 -ExpandProperty FullName
    if ($fallback) {
      $exePath = $fallback
      Log "Fallback exe: $exePath"
    }
  }

  if (-not $exePath) {
    Log "Could not find scheduler service exe. Listing EXEs found:"
    Get-ChildItem -Path $InstallDir -Filter "*.exe" -ErrorAction SilentlyContinue |
      ForEach-Object { Log ("EXE: " + $_.FullName) }
    throw "Scheduler service EXE not found in $InstallDir"
  }

  # ----------------------------
  # 4) CREATE SERVICE COMMAND
  # ----------------------------
  $binPathValue = "`"$exePath`""
  if ($exePath -like "*MuulBrowser*.exe") {
    $binPathValue = "`"$exePath`" --scheduler-service"
  }
  Log "binPathValue: $binPathValue"

  # If service exists, remove it first
  & sc.exe query $ServiceName 2>&1 | ForEach-Object { Log $_ }
  if ($LASTEXITCODE -eq 0) {
    Log "Service exists. Stopping and deleting..."
    & sc.exe stop $ServiceName 2>&1 | ForEach-Object { Log $_ }
    Start-Sleep -Seconds 2
    & sc.exe delete $ServiceName 2>&1 | ForEach-Object { Log $_ }
    Start-Sleep -Seconds 2
  } else {
    Log "Service does not exist yet (expected on first install)."
  }

  RunSc @('create', $ServiceName, 'binPath=', $binPathValue, 'DisplayName=', 'MuBrowser Scheduler', 'start=', 'auto')
  RunSc @('description', $ServiceName, 'Runs MuBrowser background scheduler jobs')
  RunSc @('start', $ServiceName)

  # ----------------------------
  # 5) VERIFY SERVICE EXISTS
  # ----------------------------
  Log "Verifying service..."
  & sc.exe query $ServiceName 2>&1 | ForEach-Object { Log $_ }

  if ($LASTEXITCODE -ne 0) {
    throw "Service verification failed after create/start."
  }

  Log "SUCCESS: Installed and started $ServiceName"
  exit 0
}
catch {
  Log ("FAILED: " + $_.Exception.Message)
  Log ("STACK: " + $_.ScriptStackTrace)
  exit 1
}
