; V3: Installer für EVE Omni (Inno Setup 6). Wird von tools/release-build.py aufgerufen:
;   ISCC.exe /DAppVersion=4.0.61 /DSrcDir=<Programm-Download\EVE-Omni> /DOutDir=<release\4.0.61> /DIconFile=<icon.ico> tools\installer.iss
; Installation ohne Admin-Rechte nach %LOCALAPPDATA%\Programs\EVE Omni. Benutzerdaten (%APPDATA%\EVE Omni, Sicherungen) bleiben beim
; Deinstallieren, außer man bestätigt „Auch meine Daten löschen“.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SrcDir
  #define SrcDir "..\Programm-Download\EVE-Omni"
#endif
#ifndef OutDir
  #define OutDir "..\release\" + AppVersion
#endif
#ifndef IconFile
  #define IconFile "..\Programm-Quellcode\src\icon.ico"
#endif

[Setup]
AppId={{6E0D2B7A-4C1F-4B8E-9A55-3E0E7A1B0001}
AppName=EVE Omni
AppVersion={#AppVersion}
AppVerName=EVE Omni Beta {#AppVersion}
AppPublisher=Nareya79
AppPublisherURL=https://omni.nareya79.com
AppSupportURL=https://discord.gg/Tyxt6J8yPR
AppUpdatesURL=https://github.com/Nareya79/eve-omni/releases
DefaultDirName={localappdata}\Programs\EVE Omni
DisableProgramGroupPage=yes
DisableDirPage=yes
UsePreviousAppDir=no
PrivilegesRequired=lowest
OutputDir={#OutDir}
OutputBaseFilename=EVE-Omni-Setup-{#AppVersion}
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\EVE-Omni.exe
UninstallDisplayName=EVE Omni
VersionInfoVersion={#AppVersion}.0
VersionInfoProductName=EVE Omni
VersionInfoDescription=EVE Omni Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
de.Soundtrack=EVE Omni Soundtrack (23 Titel, Jukebox)
en.Soundtrack=EVE Omni soundtrack (23 tracks, jukebox)
de.Desktop=Symbol auf dem Desktop
en.Desktop=Desktop icon
de.Running=EVE Omni läuft noch. Bitte erst beenden (Rechtsklick auf das Symbol unten rechts › Beenden) und dann „Wiederholen“.
en.Running=EVE Omni is still running. Please quit it first (right-click the tray icon › Quit), then click “Retry”.
de.DelData=Auch meine Daten löschen?%n%nDas löscht Logins, Trades, Einstellungen und Sicherungen von EVE Omni unwiderruflich (%APPDATA%\EVE Omni und Dokumente\EVE-Omni-Sicherungen).%n%nIm Zweifel „Nein“ – dann bleiben sie für eine spätere Installation erhalten.
en.DelData=Also delete my data?%n%nThis permanently deletes EVE Omni logins, trades, settings and backups (%APPDATA%\EVE Omni and Documents\EVE-Omni-Sicherungen).%n%nIf unsure choose “No” – they are kept for a later installation.

[Components]
Name: "main"; Description: "EVE Omni"; Types: full compact custom; Flags: fixed
Name: "soundtrack"; Description: "{cm:Soundtrack}"; Types: full

[Tasks]
Name: "desktopicon"; Description: "{cm:Desktop}"; Flags: unchecked

[Files]
Source: "{#SrcDir}\*"; DestDir: "{app}"; Components: main; Excludes: "*.alt,resources\app\soundtrack\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SrcDir}\resources\app\soundtrack\*"; DestDir: "{app}\resources\app\soundtrack"; Components: soundtrack; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

[Icons]
; Gleicher Ort und Name wie die Verknüpfung, die das Programm selbst pflegt (Windows-Meldungen brauchen die AppUserModelID)
Name: "{userprograms}\EVE Omni"; Filename: "{app}\EVE-Omni.exe"; AppUserModelID: "de.eveomni.app"
Name: "{userdesktop}\EVE Omni"; Filename: "{app}\EVE-Omni.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\EVE-Omni.exe"; Description: "{cm:LaunchProgram,EVE Omni}"; Flags: nowait postinstall skipifsilent

[Code]
function EveOmniRunning(): Boolean;
var Rc: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/C tasklist /FI "IMAGENAME eq EVE-Omni.exe" /NH | find /I "EVE-Omni.exe" >NUL', '', SW_HIDE, ewWaitUntilTerminated, Rc) and (Rc = 0);
end;

function WaitClosed(): Boolean;
begin
  Result := True;
  while EveOmniRunning() do
    if SuppressibleMsgBox(CustomMessage('Running'), mbError, MB_RETRYCANCEL, IDCANCEL) = IDCANCEL then begin Result := False; exit; end;
end;

function InitializeSetup(): Boolean;
begin
  Result := WaitClosed();
end;

function InitializeUninstall(): Boolean;
begin
  Result := WaitClosed();
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    if SuppressibleMsgBox(CustomMessage('DelData'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES then begin
      DelTree(ExpandConstant('{userappdata}\EVE Omni'), True, True, True);
      DelTree(ExpandConstant('{userdocs}\EVE-Omni-Sicherungen'), True, True, True);
    end;
end;
