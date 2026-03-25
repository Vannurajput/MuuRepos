!macro customInstall
  ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\\resources\\scheduler-service\\installService.ps1"'
!macroend

!macro customUnInstall
  ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\\resources\\scheduler-service\\uninstallService.ps1"'
!macroend
