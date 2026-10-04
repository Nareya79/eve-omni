# Programm-Paket nach einer Aenderung an EVE-Omni.html neu bauen (ohne neues Electron):
# kopiert EVE-Omni.html ins Programm, packt Programm-Download/EVE-Omni neu als ZIP,
# zerlegt in 19-MB-Teile und erzeugt EVE-Omni-auspacken.bat (make_bat.py).
# Aufruf aus dem Projektordner:  python Programm-Quellcode/paket-neu.py 1.7.0
# Achtung: Aenderungen an main.js/preload.js/helfer.cs/package.json vorher selbst nach
# Programm-Download/EVE-Omni/resources/app kopieren.
import sys, os, shutil, zipfile, hashlib, subprocess, time
from pathlib import Path
ver = sys.argv[1]
root = Path(__file__).resolve().parent.parent
dl = root / 'Programm-Download'
shutil.copyfile(root / 'EVE-Omni.html', dl / 'EVE-Omni/resources/app/evecore/EVE-Omni.html')
shutil.copyfile(root / 'Programm-Quellcode/src/package.json', dl / 'EVE-Omni/resources/app/package.json')   # Version (Tray, Update-Prüfung) – blieb sonst stehen (4.0.63–4.0.65 zeigten 4.0.62)
# Y3/BB1: EVE Omni Soundtrack mitliefern – Quelle ist der Ordner "EVEOmni Soundtrack" (Titel dort tauschen + soundtrack.json anpassen, neu bauen).
# Nur die MP3s, das Cover mit gleichem Namen, soundtrack.json und LICENSE – Unterordner (z. B. _entfernt/) und Bilder ohne MP3 bleiben draussen.
ost = dl / 'EVE-Omni/resources/app/soundtrack'
src = root / 'EVEOmni Soundtrack'
if src.is_dir():
    shutil.rmtree(ost, ignore_errors=True)
    ost.mkdir()
    mp3 = {f.stem for f in src.glob('*.mp3')}
    for f in src.iterdir():
        if f.is_file() and (f.suffix == '.mp3' or f.name in ('soundtrack.json', 'LICENSE') or (f.suffix.lower() in ('.jpg', '.png') and f.stem in mp3)):
            shutil.copyfile(f, ost / f.name)
else:
    print('Hinweis: Musikordner fehlt (' + str(src) + ') – Soundtrack im Programm bleibt wie er ist')
# T23: eine laufende EVE-Omni.exe wird zum Tauschen in *.alt umbenannt – nie mitpacken, wegraeumen sobald sie frei ist
for f in (dl / 'EVE-Omni').glob('*.alt'):
    try: f.unlink()
    except OSError: pass
os.chdir(dl)
with zipfile.ZipFile('EVE-Omni-Programm.neu.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for r, dirs, files in os.walk('EVE-Omni'):
        z.write(r, Path(r).as_posix() + '/')
        for f in files:
            if not f.endswith('.alt'): z.write(os.path.join(r, f), Path(r, f).as_posix())
# Virenscanner/Explorer halten die frische Datei manchmal kurz fest -> bis 60 s nochmal versuchen
for i in range(30):
    try: os.replace('EVE-Omni-Programm.neu.zip', 'EVE-Omni-Programm.zip'); break
    except PermissionError:
        if i == 29: raise
        time.sleep(2)
for f in os.listdir('.'):
    # BB0: auch die Teile/BAT mit dem alten Namen EVECore wegraeumen
    if f.startswith(('EVE-Omni-Programm.zip.teil', 'EVECore-Programm.zip', 'EVECore-auspacken.bat')): os.remove(f)
data = open('EVE-Omni-Programm.zip', 'rb').read()
for i in range(0, len(data), 19000000):
    open('EVE-Omni-Programm.zip.teil%02d' % (i // 19000000), 'wb').write(data[i:i + 19000000])
subprocess.run([sys.executable, str(root / 'Programm-Quellcode/make_bat.py'), 'EVE-Omni-Programm.zip', '.', ver], check=True)
teile = b''.join(open(f, 'rb').read() for f in sorted(os.listdir('.')) if f.startswith('EVE-Omni-Programm.zip.teil'))
assert hashlib.sha256(teile).digest() == hashlib.sha256(data).digest(), 'Teile ergeben nicht das ZIP'
print('Paket fertig, Pruefsumme der Teile OK')
