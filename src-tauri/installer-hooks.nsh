; Shell verb registration for "Open in Terax".
;
; Windows 10 / fallback: classic registry verbs appear under "Show more options".
; Windows 11 (build >= 22000): sparse APPX package registers IExplorerCommand which
;   lands in the top-level modern context menu without "Show more options".
;
; perMachine install mode means the installer runs with admin rights, so certutil
; and Add-AppxPackage both have the access they need without extra elevation steps.
; NoWorkingDirectory keeps Explorer from overriding %V on Drive verbs.

!macro NSIS_HOOK_POSTINSTALL
  ; --- Classic registry verbs (Windows 10 / fallback) ---
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInTerax" "" "Open in Terax"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInTerax" "Icon" '"$INSTDIR\terax.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInTerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInTerax\command" "" '"$INSTDIR\terax.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInTerax" "" "Open in Terax"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInTerax" "Icon" '"$INSTDIR\terax.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInTerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInTerax\command" "" '"$INSTDIR\terax.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInTerax" "" "Open in Terax"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInTerax" "Icon" '"$INSTDIR\terax.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInTerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInTerax\command" "" '"$INSTDIR\terax.exe" "%V"'

  ; --- Windows 11 modern context menu (build >= 22000) ---
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntOp $R1 $R0 + 0
  ${If} $R1 >= 22000
    ; Trust the signing cert in the machine root store so Add-AppxPackage accepts it.
    ; perMachine mode guarantees admin rights here, so no separate elevation needed.
    ExecWait 'certutil.exe -addstore Root "$INSTDIR\terax_cert.cer"' $0

    ; Remove any stale registration from a previous install.
    ExecWait '$SYSDIR\WindowsPowerShell\v1.0\powershell.exe -NonInteractive -WindowStyle Hidden -Command "Get-AppxPackage -Name app.crynta.terax -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue"'

    ; Register the sparse APPX with ExternalLocation pointing to the install dir.
    ExecWait '$SYSDIR\WindowsPowerShell\v1.0\powershell.exe -NonInteractive -WindowStyle Hidden -Command "Add-AppxPackage -Path \"$INSTDIR\terax_shell_ext.appx\" -ExternalLocation \"$INSTDIR\""' $0
    ${If} $0 != 0
      DetailPrint "Note: Windows 11 context menu registration failed (exit $0). Classic menu entry is still active."
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInTerax"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInTerax"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInTerax"

  ExecWait '$SYSDIR\WindowsPowerShell\v1.0\powershell.exe -NonInteractive -WindowStyle Hidden -Command "Get-AppxPackage -Name app.crynta.terax -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue"'
!macroend
