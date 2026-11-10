; Next gives each build new asset names. NSIS /UPDATE otherwise retains old chunks.
; Only touch generated app/dependency files in a recognized installation, never the data profile.
!macro RequireAppClosed
  ${If} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro RestartManager_StartSession $R0
    StrCpy $R9 1
    ${If} $R0 != ""
      !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\${MAINBINARYNAME}.exe"
      ${If} $0 = 0
        System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
        StrCpy $R9 $0
      ${EndIf}
      !insertmacro RestartManager_EndSession $R0
    ${EndIf}
    ${If} $R9 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "请先保存并关闭录阶，再重新运行安装程序。$\nSave and close LuJie CareerKit, then run this installer again." /SD IDOK
      SetErrorLevel 2
      Abort
    ${EndIf}
  ${EndIf}
!macroend

; Tauri runs this macro after our hooks too. Keep both checks non-destructive.
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  !insertmacro RequireAppClosed
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; Silent NSIS runs skip the maintenance page where Tauri initializes its version comparison.
  ReadRegStr $R8 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${If} $R8 != ""
    nsis_tauri_utils::SemverCompare "${VERSION}" $R8
    Pop $R8
    ${If} $R8 = -1
      SetErrorLevel 2
      Abort "A newer LuJie CareerKit version is installed. Downgrades are not supported."
    ${EndIf}
  ${EndIf}
  !insertmacro RequireAppClosed
  ${If} ${FileExists} "$INSTDIR\backend\desktop-build.json"
  ${AndIf} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    RMDir /r "$INSTDIR\backend\.next"
    RMDir /r "$INSTDIR\backend\node_modules"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro RequireAppClosed
  ${If} ${FileExists} "$INSTDIR\backend\desktop-build.json"
    RMDir /r "$INSTDIR\backend\.next"
    RMDir /r "$INSTDIR\backend\node_modules"
  ${EndIf}
!macroend
