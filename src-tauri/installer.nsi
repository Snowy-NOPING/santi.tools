; =====================================================
; santi.tools — Custom NSIS Installer
; =====================================================
; This is a Tauri NSIS template override.
; Tauri injects its own macros; we customize the UI here.

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; ── Branding ──────────────────────────────────────
Name "${PRODUCTNAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\${PRODUCTNAME}"
InstallDirRegKey HKCU "Software\${PRODUCTNAME}" "InstallDir"
RequestExecutionLevel user
Unicode true

; ── MUI Settings ──────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON "${TAURI_BUNDLE_ICON}"
!define MUI_UNICON "${TAURI_BUNDLE_ICON}"

; Custom colors — dark purple theme matching the app
!define MUI_BGCOLOR "0A0A0A"
!define MUI_TEXTCOLOR "E8E8E8"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-metro.bmp"
!define MUI_HEADERIMAGE_RIGHT

; Welcome page
!define MUI_WELCOMEPAGE_TITLE "welcome to santi.tools"
!define MUI_WELCOMEPAGE_TEXT "this installer will set up santi.tools on your computer.$\r$\n$\r$\na cobalt-powered media downloader.$\r$\n$\r$\nclick install to continue."
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-metro.bmp"

; Finish page
!define MUI_FINISHPAGE_TITLE "installation complete"
!define MUI_FINISHPAGE_TEXT "santi.tools has been installed.$\r$\n$\r$\nclick finish to launch the app."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${MAINBINARYNAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "launch santi.tools"
!define MUI_FINISHPAGE_LINK "santi.tools"
!define MUI_FINISHPAGE_LINK_LOCATION "https://santi.tools"

; ── Pages ─────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Install Section ───────────────────────────────
Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Tauri injects the actual file copy macros here
  !insertmacro TAURI_INSTALL_FILES

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry entries
  WriteRegStr HKCU "Software\${PRODUCTNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "DisplayName" "${PRODUCTNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "DisplayIcon" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "Publisher" "${MANUFACTURER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "NoRepair" 1

  ; Shortcuts
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  CreateDirectory "$SMPROGRAMS\${PRODUCTNAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

; ── Uninstall Section ─────────────────────────────
Section "Uninstall"
  !insertmacro TAURI_UNINSTALL_FILES

  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"

  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCTNAME}"

  DeleteRegKey HKCU "Software\${PRODUCTNAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
SectionEnd
