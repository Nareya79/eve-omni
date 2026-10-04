# Erzeugt EVE-Omni-auspacken.bat fuer die in 19-MB-Teile zerlegte ZIP (Pruefsumme + Anzahl Teile).
# Aufruf: python3 make_bat.py <zip> <zielordner> <version>
import sys, hashlib, os
z, out, ver = sys.argv[1], sys.argv[2], sys.argv[3]
h = hashlib.sha256(open(z,'rb').read()).hexdigest()
n = len([f for f in os.listdir(out) if f.startswith('EVE-Omni-Programm.zip.teil')])
ids=' '.join('%02d'%i for i in range(n))
parts='+'.join('EVE-Omni-Programm.zip.teil%02d'%i for i in range(n))
L=['@echo off','setlocal','title EVE Omni - Programm auspacken','cd /d "%~dp0"','echo.','echo  EVE-Omni-Programm (Beta '+ver+') wird zusammengesetzt ...',
'for %%i in ('+ids+') do if not exist "EVE-Omni-Programm.zip.teil%%i" (echo  FEHLER: Teil %%i fehlt - bitte alle '+str(n)+' Teile in diesen Ordner legen. & goto :ende)',
'tasklist /FI "IMAGENAME eq EVE-Omni.exe" 2>nul | findstr /I /C:"EVE-Omni.exe" >nul && (echo  EVE Omni laeuft noch - bitte zuerst beenden: Rechtsklick auf das Symbol unten rechts - Beenden. & goto :ende)',
# BB0: altes EVECore muss zu sein, damit EVE Omni beim ersten Start seine Daten sauber uebernimmt
'tasklist /FI "IMAGENAME eq EVECore.exe" 2>nul | findstr /I /C:"EVECore.exe" >nul && (echo  EVECore laeuft noch - bitte zuerst beenden: Rechtsklick auf das Symbol unten rechts - Beenden. Deine Daten uebernimmt EVE Omni beim ersten Start. & goto :ende)',
'copy /b /y '+parts+' EVE-Omni-Programm.zip >nul',
'if errorlevel 1 (echo  FEHLER beim Zusammensetzen. & goto :ende)',
'set "HASH="',
"for /f \"skip=1 delims=\" %%h in ('certutil -hashfile EVE-Omni-Programm.zip SHA256') do if not defined HASH set \"HASH=%%h\"",
'set "HASH=%HASH: =%"',
'if /I not "%HASH%"=="'+h+'" (echo  FEHLER: Pruefsumme stimmt nicht - Datei beschaedigt. Bitte Claude Bescheid geben. & goto :ende)',
'echo  Pruefsumme OK.',
'echo  Entpacke nach "%~dp0EVE-Omni" ...',
"powershell -NoProfile -ExecutionPolicy Bypass -Command \"Expand-Archive -LiteralPath 'EVE-Omni-Programm.zip' -DestinationPath '.' -Force\"",
'if errorlevel 1 (echo  FEHLER beim Entpacken. Die Datei EVE-Omni-Programm.zip kannst du auch per Rechtsklick - Alle extrahieren entpacken. & goto :ende)',
'if not exist "EVE-Omni\\EVE-Omni.exe" (echo  FEHLER: EVE-Omni.exe nicht gefunden. & goto :ende)',
'echo.','echo  Fertig. Im Ordner EVE-Omni liegt EVE-Omni.exe - einfach doppelklicken.',
'echo  Deine Daten und Einstellungen bleiben erhalten, sie liegen nicht in diesem Ordner.',
'if exist "EVECore\\EVECore.exe" echo  EVECore heisst jetzt EVE Omni. Den alten Ordner EVECore kannst du loeschen, sobald EVE Omni einmal lief.',
'echo  Die Teil-Dateien und EVE-Omni-Programm.zip kannst du danach loeschen.',
'start "" explorer "%~dp0EVE-Omni"',':ende','echo.','pause','endlocal','']
open(os.path.join(out,'EVE-Omni-auspacken.bat'),'wb').write('\r\n'.join(L).encode('ascii'))
print('bat', n, h)
