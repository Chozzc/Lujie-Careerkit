; Next gives each build new asset names. NSIS /UPDATE otherwise retains old chunks.
; Only touch generated app/dependency files in a recognized installation, never the data profile.
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
  ${If} ${FileExists} "$INSTDIR\backend\desktop-build.json"
  ${AndIf} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
    RMDir /r "$INSTDIR\backend\.next"
    RMDir /r "$INSTDIR\backend\node_modules"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} ${FileExists} "$INSTDIR\backend\desktop-build.json"
    !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
    RMDir /r "$INSTDIR\backend\.next"
    RMDir /r "$INSTDIR\backend\node_modules"
  ${EndIf}
!macroend
