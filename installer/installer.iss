; =====================================================
; santi.tools — Custom Inno Setup Installer
; =====================================================

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#ifndef NsisExe
  #define NsisExe "..\src-tauri\target\release\bundle\nsis\santi.tools_0.1.0_x64-setup.exe"
#endif

#define AppName      "santi.tools"
#define AppPublisher "santi.tools"
#define AppURL       "https://github.com/Snowy-NOPING/santi.tools"
#define AppExeName   "santi.tools.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL=https://github.com/Snowy-NOPING/santi.tools/issues
AppUpdatesURL=https://github.com/Snowy-NOPING/santi.tools/releases
DefaultDirName={localappdata}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
OutputDir=..\dist
OutputBaseFilename=santi.tools-{#AppVersion}-setup
SetupIconFile=..\src-tauri\icons\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120
ShowLanguageDialog=no
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
CloseApplications=yes
WizardImageFile=wizard-image.bmp
WizardSmallImageFile=wizard-small.bmp
WizardImageStretch=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
english.WelcomeLabel1=welcome to santi.tools
english.WelcomeLabel2=a cobalt-powered media downloader for windows.%n%ngithub.com/Snowy-NOPING/santi.tools%n%nclick install to continue.
english.FinishedHeadingLabel=you're all set
english.FinishedLabel=santi.tools has been installed.%n%nclick finish to close.

[Files]
Source: "{#NsisExe}"; DestDir: "{tmp}"; Flags: deleteafterinstall noencryption

[Icons]
Name: "{group}\{#AppName}"; Filename: "{localappdata}\{#AppName}\{#AppExeName}"
Name: "{commondesktop}\{#AppName}"; Filename: "{localappdata}\{#AppName}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "create a desktop shortcut"; GroupDescription: "additional icons:"

[Run]
Filename: "{tmp}\{#ExtractFileName(NsisExe)}"; Parameters: "/S"; StatusMsg: "installing santi.tools..."; Flags: waituntilterminated
Filename: "{localappdata}\santi.tools\santi.tools.exe"; Description: "launch santi.tools"; Flags: nowait postinstall skipifsilent

[Code]
var
  AnimFrame:  Integer;
  DotLabel:   TLabel;
  BarPanel:   TPanel;
  BarFill:    TPanel;
  BarWidth:   Integer;
  BarProgress: Integer;
  AnimTimerId: LongWord;

function SetTimer(hWnd: LongWord; nIDEvent: LongWord; uElapse: LongWord; lpTimerFunc: LongWord): LongWord;
  external 'SetTimer@user32.dll stdcall';
function KillTimer(hWnd: LongWord; uIDEvent: LongWord): Boolean;
  external 'KillTimer@user32.dll stdcall';

procedure TimerProc(hWnd: LongWord; uMsg: LongWord; idEvent: LongWord; dwTime: LongWord);
begin
  AnimFrame := (AnimFrame + 1) mod 4;
  case AnimFrame of
    0: DotLabel.Caption := 'installing';
    1: DotLabel.Caption := 'installing .';
    2: DotLabel.Caption := 'installing . .';
    3: DotLabel.Caption := 'installing . . .';
  end;
  if BarProgress < BarWidth - 4 then
  begin
    BarProgress := BarProgress + 3;
    BarFill.Width := BarProgress;
  end;
end;

procedure InitializeWizard;
begin
  WizardForm.Color := $0A0A0A;
  WizardForm.Font.Name  := 'Segoe UI';
  WizardForm.Font.Color := $E8E8E8;
  WizardForm.Font.Size  := 10;

  WizardForm.WelcomeLabel1.Font.Size  := 20;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel1.Font.Color := $FFD4A0;
  WizardForm.WelcomeLabel2.Font.Color := $888888;
  WizardForm.WelcomeLabel2.Font.Size  := 10;

  WizardForm.FinishedHeadingLabel.Font.Size  := 20;
  WizardForm.FinishedHeadingLabel.Font.Style := [fsBold];
  WizardForm.FinishedHeadingLabel.Font.Color := $A0D47D;
  WizardForm.FinishedLabel.Font.Color := $888888;

  WizardForm.NextButton.Font.Color   := $0A0A0A;
  WizardForm.CancelButton.Font.Color := $888888;

  DotLabel := TLabel.Create(WizardForm);
  DotLabel.Parent    := WizardForm.InstallingPage;
  DotLabel.AutoSize  := False;
  DotLabel.Width     := WizardForm.InstallingPage.Width;
  DotLabel.Height    := 24;
  DotLabel.Left      := 0;
  DotLabel.Top       := WizardForm.InstallingPage.Height - 60;
  DotLabel.Alignment := taCenter;
  DotLabel.Font.Color := $FFD4A0;
  DotLabel.Font.Size  := 11;
  DotLabel.Caption    := 'installing';

  BarWidth := WizardForm.InstallingPage.Width - 40;

  BarPanel := TPanel.Create(WizardForm);
  BarPanel.Parent     := WizardForm.InstallingPage;
  BarPanel.Left       := 20;
  BarPanel.Top        := WizardForm.InstallingPage.Height - 30;
  BarPanel.Width      := BarWidth;
  BarPanel.Height     := 4;
  BarPanel.Color      := $222222;
  BarPanel.BevelOuter := bvNone;

  BarFill := TPanel.Create(WizardForm);
  BarFill.Parent     := BarPanel;
  BarFill.Left       := 0;
  BarFill.Top        := 0;
  BarFill.Width      := 0;
  BarFill.Height     := 4;
  BarFill.Color      := $FFD4A0;
  BarFill.BevelOuter := bvNone;

  BarProgress := 0;
  AnimFrame   := 0;
  AnimTimerId := 0;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpInstalling then
  begin
    WizardForm.NextButton.Enabled := False;
    AnimTimerId := SetTimer(0, 0, 350, CreateCallback(@TimerProc));
  end;

  if CurPageID = wpFinished then
  begin
    if AnimTimerId <> 0 then
    begin
      KillTimer(0, AnimTimerId);
      AnimTimerId := 0;
    end;
    if BarFill <> nil then BarFill.Width := BarWidth - 4;
    if DotLabel <> nil then
    begin
      DotLabel.Caption    := 'done  ✓';
      DotLabel.Font.Color := $A0D47D;
    end;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;

procedure DeinitializeSetup;
begin
  if AnimTimerId <> 0 then
    KillTimer(0, AnimTimerId);
end;
