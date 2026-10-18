; Avoid mapping the multi-gigabyte uncompressed AI runtime in the NSIS compiler.
FileBufSize 4

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing the bundled offline voice and MCP runtime..."
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\windows\install-runtime.ps1"' $0
  ${If} ${Errors}
    SetErrorLevel 1
    Abort "Could not start bundled runtime installation."
  ${EndIf}
  ${If} $0 != 0
    SetErrorLevel 1
    Abort "Bundled runtime installation failed. Please retry the installer."
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\runtime.installing"
  RMDir /r "$INSTDIR\runtime.previous"
!macroend
