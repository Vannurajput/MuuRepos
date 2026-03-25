$ErrorActionPreference = 'Stop'

param(
  [string]$ServiceName = 'MuBrowserScheduler'
)

try {
  sc.exe query $ServiceName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Output "Service $ServiceName not found; nothing to remove."
    exit 0
  }

  sc.exe stop $ServiceName | Out-Null
  Start-Sleep -Seconds 1
  sc.exe delete $ServiceName | Out-Null
  Write-Output "Removed service $ServiceName"
} catch {
  Write-Warning "Failed to remove service $ServiceName: $_"
}
