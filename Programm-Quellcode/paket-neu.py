# Programm-Paket nach einer Aenderung an EVE-Omni.html neu bauen (ohne neues Electron):
# kopiert EVE-Omni.html, package.json und Soundtrack nach Programm-Download/EVE-Omni
# (das Release packt tools/release-build.py daraus).
# Aufruf aus dem Projektordner:  python Programm-Quellcode/paket-neu.py 1.7.0
# Achtung: Aenderungen an main.js/preload.js/helfer.cs/package.json vorher selbst nach
# Programm-Download/EVE-Omni/resources/app kopieren.
import sys, shutil
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
# YY3 (17.10.2026): kein Teil-ZIP + auspacken.bat mehr – Verteilung nur über Setup + portable ZIP (tools/release-build.py); alte Reste wegräumen
for f in dl.iterdir():
    if f.name.startswith(('EVE-Omni-Programm.zip', 'EVE-Omni-Programm.neu.zip', 'EVE-Omni-auspacken.bat', 'EVECore-Programm.zip', 'EVECore-auspacken.bat')): f.unlink()
print('Programmordner aktualisiert')
