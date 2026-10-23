# V3: alles für eine Veröffentlichung in release/<version>/ bauen und prüfen.
#   python tools/release-build.py            (Version aus EVE-Omni.html)
#   python tools/release-build.py --ohne-test  ohne Probe-Installation
#   python tools/release-build.py --src <Programmordner>   V6/CI: fertig gebauter Ordner aus build.js (mit Soundtrack), ohne paket-neu.py
#   python tools/release-build.py --summen [<Ordner>]      V6: SHA256SUMS.txt neu schreiben + prüfen (nach dem Signieren des Installers)
#   python tools/release-build.py --pruefen <Ordner>       V6: nur prüfen – Dateiliste vollständig, Prüfsummen stimmen
# Schritte: Programm-Paket auffrischen (paket-neu.py – die Teil-ZIPs + .bat bleiben für den eigenen PC, werden nicht veröffentlicht),
# Installer EVE-Omni-Setup-<v>.exe (Inno Setup, tools/installer.iss), EVE-Omni-<v>-portable.zip, EVE-Omni-Soundtrack.zip, SHA256SUMS.txt,
# Probe: Installer still in einen Testordner installieren + Dateien/Version prüfen + still deinstallieren, portable ZIP prüfen,
# zum Schluss V8 (tools/release-check.py auf den Release-Ordner). Rückgabewert 0 = fertig zum Hochladen.
# Electron selbst wird hier nicht neu gebaut: Programm-Download/EVE-Omni bzw. --src stammt aus build.js (offizielle Electron-ZIP, SHA256 geprüft).
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
R = Path(__file__).resolve().parent.parent
ISCC = [p for p in [Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs/Inno Setup 6/ISCC.exe', Path('C:/Program Files (x86)/Inno Setup 6/ISCC.exe'), Path('C:/Program Files/Inno Setup 6/ISCC.exe')] if p.exists()]
def say(t): print(t, flush=True)
def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()
def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv and sys.argv.index(name) + 1 < len(sys.argv) else None
def names(v): return ['EVE-Omni-Setup-' + v + '.exe', 'EVE-Omni-Update-' + v + '.exe', 'EVE-Omni-' + v + '-portable.zip', 'EVE-Omni-Soundtrack.zip']   # BC2: Update = Setup ohne Soundtrack

def summen(out, v):
    (out / 'SHA256SUMS.txt').write_text(''.join(sha(out / n) + '  ' + n + '\n' for n in names(v)), encoding='utf-8', newline='\n')

def pruefen(out, v):
    # V6: genau die 4 Dateien, SHA256SUMS.txt passt zu jeder Datei
    lst = sorted(p.name for p in out.iterdir())
    c1 = lst == sorted(names(v) + ['SHA256SUMS.txt'])
    say(('  OK    ' if c1 else '  FEHLER ') + 'Dateiliste: ' + ', '.join(lst))
    sums = dict(reversed(l.split('  ', 1)) for l in (out / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines() if '  ' in l) if (out / 'SHA256SUMS.txt').exists() else {}
    c2 = sorted(sums) == sorted(names(v)) and all((out / n).exists() and sha(out / n) == sums[n] for n in names(v))
    say(('  OK    ' if c2 else '  FEHLER ') + 'Prüfsummen (SHA256SUMS.txt)')
    return c1 and c2

def main():
    v = re.search(r'var EVECORE_VERSION = "([^"]+)"', (R / 'EVE-Omni.html').read_text(encoding='utf-8')).group(1)
    if '--pruefen' in sys.argv or '--summen' in sys.argv:
        out = Path(arg('--pruefen') or arg('--summen') or R / 'release' / v).resolve()
        if '--summen' in sys.argv: summen(out, out.name); say('  SHA256SUMS.txt neu')
        return 0 if pruefen(out, out.name) else 1
    src_v = json.loads((R / 'Programm-Quellcode/src/package.json').read_text(encoding='utf-8'))['version']
    if src_v != v: raise SystemExit('Programm-Quellcode/src/package.json hat ' + src_v + ', EVE-Omni.html ' + v + ' – Version angleichen')
    SRC = Path(arg('--src')).resolve() if arg('--src') else R / 'Programm-Download' / 'EVE-Omni'
    out = R / 'release' / v
    say('EVE Omni Release ' + v + ' → ' + str(out.relative_to(R)))
    # 1) Programm-Paket auffrischen (HTML, Soundtrack, Teil-ZIPs) – nur lokal, in CI kommt der Ordner fertig aus build.js
    if not arg('--src'): subprocess.run([sys.executable, str(R / 'Programm-Quellcode/paket-neu.py'), v], cwd=R, check=True)
    app_v = json.loads((SRC / 'resources/app/package.json').read_text(encoding='utf-8'))['version']
    if app_v != v: raise SystemExit('Programm-Version ' + app_v + ' ≠ ' + v + ' – package.json nach Programm-Download kopieren')
    # AU3: exe trägt Symbol + Version aus src/icon.ico (Programm-Download behielt sonst das alte Symbol B von 03.10.)
    if subprocess.call(['node', str(R / 'tools/exe-symbol.js'), str(SRC / 'EVE-Omni.exe'), str(R / 'Programm-Quellcode/src/icon.ico'), v]) != 0:
        raise SystemExit('EVE-Omni.exe: Symbol/Version nicht gesetzt – siehe oben')
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    # 2) portable ZIP (ohne alte exe-Reste)
    pz = out / ('EVE-Omni-' + v + '-portable.zip')
    with zipfile.ZipFile(pz, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for root, dirs, files in os.walk(SRC):
            for f in files:
                if f.endswith('.alt'): continue
                if root == str(SRC) and f == 'EVE-Omni.html': continue   # 23.10.: lokale Kopie neben der exe nie ausliefern (5.2.0 hatte 5.1.0)
                p = Path(root) / f; z.write(p, ('EVE Omni' / p.relative_to(SRC)).as_posix())
    say('  ' + pz.name + ' (' + str(pz.stat().st_size // 1048576) + ' MB)')
    # 3) Soundtrack-ZIP
    st = SRC / 'resources/app/soundtrack'
    sz = out / 'EVE-Omni-Soundtrack.zip'
    with zipfile.ZipFile(sz, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(st.iterdir()) if st.is_dir() else []:
            if f.is_file(): z.write(f, 'EVE Omni Soundtrack/' + f.name)
        lic = R / 'EVEOmni Soundtrack' / 'LICENSE'
        if (st / 'LICENSE').exists(): pass   # kommt schon oben aus dem Programm-Ordner mit
        elif lic.exists(): z.write(lic, 'EVE Omni Soundtrack/LICENSE')
        elif (R / 'soundtrack/LICENSE').exists(): z.write(R / 'soundtrack/LICENSE', 'EVE Omni Soundtrack/LICENSE')   # Repo
        else: say('  Hinweis: EVEOmni Soundtrack/LICENSE fehlt – Soundtrack-ZIP ohne Lizenzdatei')
    say('  ' + sz.name + ' (' + str(sz.stat().st_size // 1048576) + ' MB)')
    # 4) Installer
    if not ISCC: raise SystemExit('Inno Setup (ISCC.exe) nicht gefunden – winget install JRSoftware.InnoSetup')
    subprocess.run([str(ISCC[0]), '/Q', '/DAppVersion=' + v, '/DSrcDir=' + str(SRC), '/DOutDir=' + str(out), '/DIconFile=' + str(R / 'Programm-Quellcode/src/icon.ico'), str(R / 'tools/installer.iss')], check=True)
    setup = out / ('EVE-Omni-Setup-' + v + '.exe')
    say('  ' + setup.name + ' (' + str(setup.stat().st_size // 1048576) + ' MB)')
    # BC2: Update-Setup ohne Soundtrack (EVE Omni lädt es über „Jetzt aktualisieren“)
    subprocess.run([str(ISCC[0]), '/Q', '/DAppVersion=' + v, '/DNoSoundtrack', '/DSrcDir=' + str(SRC), '/DOutDir=' + str(out), '/DIconFile=' + str(R / 'Programm-Quellcode/src/icon.ico'), str(R / 'tools/installer.iss')], check=True)
    upd = out / ('EVE-Omni-Update-' + v + '.exe')
    say('  ' + upd.name + ' (' + str(upd.stat().st_size // 1048576) + ' MB)')
    # 5) Prüfsummen
    summen(out, v)
    say('  SHA256SUMS.txt')
    ok = True
    # 6) Probe: still installieren, prüfen, still deinstallieren (Daten bleiben – stiller Modus antwortet „Nein“)
    if '--ohne-test' not in sys.argv:
        tmp = Path(tempfile.mkdtemp(prefix='eveomni-setup-'))
        # 23.10.: Probe hat dieselbe AppId wie die echte Installation – ihr Deinstallieren löschte deren Windows-Eintrag (Apps) + Startmenü-Verknüpfung.
        # Vorher sichern, danach zurückspielen.
        KEY = r'HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\{6E0D2B7A-4C1F-4B8E-9A55-3E0E7A1B0001}_is1'
        LNK = Path(os.environ.get('APPDATA', '')) / 'Microsoft/Windows/Start Menu/Programs/EVE Omni.lnk'
        had_key = subprocess.call(['reg', 'export', KEY, str(tmp / 'uninst.reg'), '/y'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
        lnk_bak = LNK.read_bytes() if LNK.exists() else None
        try:
            r = subprocess.run([str(setup), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/DIR=' + str(tmp / 'EVE Omni'), '/COMPONENTS=main,soundtrack,omnibreaker', '/LOG=' + str(tmp / 'setup.log')], timeout=600)
            inst = tmp / 'EVE Omni'
            iv = json.loads((inst / 'resources/app/package.json').read_text(encoding='utf-8'))['version'] if (inst / 'resources/app/package.json').exists() else None
            c1 = r.returncode == 0 and (inst / 'EVE-Omni.exe').exists() and iv == v and (inst / 'resources/app/evecore/EVE-Omni.html').exists() and any((inst / 'resources/app/soundtrack').glob('*.mp3'))
            say(('  OK    ' if c1 else '  FEHLER ') + 'Probe-Installation (exe, Version ' + str(iv) + ', HTML, Soundtrack)')
            # BC2: Update-Setup still drüber (ohne /EOUPDATE, sonst startet das Programm) – Soundtrack muss bleiben, alte HTML neben der exe weg
            (inst / 'EVE-Omni.html').write_text('alt', encoding='utf-8')
            ru = subprocess.run([str(upd), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/DIR=' + str(inst), '/LOG=' + str(tmp / 'update.log')], timeout=600)
            cu = ru.returncode == 0 and (inst / 'EVE-Omni.exe').exists() and any((inst / 'resources/app/soundtrack').glob('*.mp3')) and not (inst / 'EVE-Omni.html').exists()
            say(('  OK    ' if cu else '  FEHLER ') + 'Probe-Update (Soundtrack bleibt, alte HTML neben der exe weg)')
            c1 = c1 and cu
            un = inst / 'unins000.exe'
            r2 = subprocess.run([str(un), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], timeout=300) if un.exists() else None
            import time; time.sleep(3)
            c2 = r2 is not None and r2.returncode == 0 and not (inst / 'EVE-Omni.exe').exists()
            say(('  OK    ' if c2 else '  FEHLER ') + 'Probe-Deinstallation')
            ok = ok and c1 and c2
        finally:
            subprocess.call(['reg', 'delete', KEY, '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if had_key: subprocess.call(['reg', 'import', str(tmp / 'uninst.reg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if lnk_bak is not None: LNK.write_bytes(lnk_bak)
            elif LNK.exists(): LNK.unlink()
            say('  OK    Windows-Eintrag + Startmenü der echten Installation wiederhergestellt' if had_key else '  Hinweis: keine echte Installation – nichts wiederherzustellen')
            shutil.rmtree(tmp, ignore_errors=True)
        with zipfile.ZipFile(pz) as z:
            n = set(z.namelist()); pv = json.loads(z.read('EVE Omni/resources/app/package.json'))['version']
            hv = [m.group(1) for x in n if x.endswith('EVE-Omni.html') and 'omnibreaker' not in x.lower() for m in [re.search(r'var EVECORE_VERSION = "([^"]+)"', z.read(x).decode('utf-8', 'replace'))] if m]
            c3 = 'EVE Omni/EVE-Omni.exe' in n and pv == v and 'EVE Omni/resources/app/evecore/EVE-Omni.html' in n and not any(x.endswith('.alt') for x in n) and 'EVE Omni/EVE-Omni.html' not in n and hv and all(x == v for x in hv)
        say(('  OK    ' if c3 else '  FEHLER ') + 'portable ZIP (exe, Version ' + pv + ', HTML ' + '/'.join(hv) + ')')
        ok = ok and c3
        # AU3: Symbol der exe im fertigen Paket nachprüfen
        tz = Path(tempfile.mkdtemp(prefix='eveomni-exe-'))
        try:
            with zipfile.ZipFile(pz) as z: z.extract('EVE Omni/EVE-Omni.exe', tz)
            ok = subprocess.call(['node', str(R / 'tools/exe-symbol.js'), str(tz / 'EVE Omni/EVE-Omni.exe'), str(R / 'Programm-Quellcode/src/icon.ico'), v, '--pruefen']) == 0 and ok
        finally:
            shutil.rmtree(tz, ignore_errors=True)
    ok = pruefen(out, v) and ok
    # 7) Englisch-Check (4.0.73, Meldung „almost 50% German“): ganzes Programm im EN-Modus + Tray/Menüs/Dialoge aus main.js
    say('\nEnglisch-Check:')
    shx = shutil.which('sh') or shutil.which('bash')
    rc_en = subprocess.call([shx, 'tests/run-local-windows.sh', 'test-i18n-voll.js test-i18n-en.js test-main-i18n.js'], cwd=R) if shx else 1
    say(('  OK    ' if rc_en == 0 else '  FEHLER ') + 'keine deutschen Texte im Englisch-Modus' + ('' if shx else ' (sh nicht gefunden – aus Git Bash starten)'))
    ok = ok and rc_en == 0
    # 8) V8
    say('\nV8 Release-Check:')
    rc = subprocess.call([sys.executable, str(R / 'tools/release-check.py'), str(out)], cwd=R)
    ok = ok and rc == 0
    say('\n' + ('FERTIG – release/' + v + ' kann hochgeladen werden (GitHub-Release).' if ok else 'NICHT FERTIG – siehe Fehler oben.'))
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
