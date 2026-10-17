# V8: Release-Check – prüft alles, was veröffentlicht wird, auf Privates und bricht dann ab (Rückgabewert 1).
#   python tools/release-check.py                     Standard: release/<neueste Version>/ (auch in ZIPs), EVE-Omni.html, Programm-Quellcode/src + demo.js,
#                                                     README.md, tools/, tests/, homepage/ (falls da), release/media/index.html
#   python tools/release-check.py <Pfad> [<Pfad> …]   nur diese Dateien/Ordner/ZIPs
#   python tools/release-check.py --technik           zusätzlich Programm-Quellcode/release-check.py (Version, Paket, Tests)
# Ausgabe je Fund: Datei – Zeile – Fund. Bilder/Videos kommen in eine Liste „bitte von Hand ansehen“.
import codecs, io, os, re, subprocess, sys, zipfile
from pathlib import Path
R = Path(__file__).resolve().parent.parent

# Suchbegriffe ROT13-verschlüsselt, damit dieses Werkzeug sich nicht selbst meldet
D = lambda s: codecs.decode(s, 'rot13')
# V6: Die privaten Namen (Charaktere, Benutzername, settings_…-Ordner) stehen nicht im öffentlichen Repo, sondern kommagetrennt
# in der Umgebungsvariable RELEASE_CHECK_NAMES (GitHub-Secret) oder lokal in tools/release-check-namen.txt (per .gitignore ausgeschlossen).
NAMES_FILE = R / 'tools' / 'release-check-namen.txt'
NAME_LIST = [n.strip() for n in (os.environ['RELEASE_CHECK_NAMES'] if 'RELEASE_CHECK_NAMES' in os.environ else (NAMES_FILE.read_text(encoding='utf-8') if NAMES_FILE.exists() else '')).replace('\n', ',').split(',') if n.strip()]
NAMES = re.compile('|'.join(re.escape(n) for n in NAME_LIST), re.I) if NAME_LIST else re.compile(r'(?!)')
REMOVED = re.compile(D('fhaoernx'), re.I)   # Soundtrack-Titel, der am 04.10.2026 überall raus ist – darf nirgends mehr auftauchen
ALLOW_NAME = re.compile(D('anerln') + r'\s+' + D('zlgurp'), re.I)       # Spenden-Charakter (erlaubt)
RULES = [
    ('Charaktername', NAMES),
    ('Benutzername/Pfad', re.compile(r'C:\\\\?Users\\\\?|C:' + r'/Users/|/home/(?!claude/)[a-z]+/', re.I)),
    ('alte Rücksprung-Adresse', re.compile(r'claude\.ai/artifact/SCXYB3dGYrVf9XaTZcQW7U')),
    ('Token (JWT)', re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')),
    ('Token (refresh_token)', re.compile(r'refresh_token"\s*:\s*"(?!demo")[A-Za-z0-9+/=_-]{20,}')),
    ('Client-Secret', re.compile(r'client_secret\s*["\']?\s*[:=]\s*["\']?[A-Za-z0-9]{8,}', re.I)),
    ('lange Hex-Kette', re.compile(r'(?<![A-Fa-f0-9#])[A-Fa-f0-9]{40,}(?![A-Fa-f0-9])')),
    ('lange Base64-Kette', re.compile(r'(?<![A-Za-z0-9+/=,])[A-Za-z0-9+/]{80,}={0,2}(?![A-Za-z0-9+/=])')),
    ('E-Mail', re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')),
    ('entfernter Titel', REMOVED),
]
ALLOW = [
    re.compile(r'aa3a93ff84e84013967e34b5e35b5267'),                      # öffentliche Client-ID der gemeinsamen App
    re.compile(r'contact@nareya79\.com', re.I),
    re.compile(r'Nareya79', re.I),
]
# Dateien, die nie veröffentlicht werden dürfen
FORBIDDEN = re.compile(r'(^|/)(UEBERGABE[^/]*\.md|PLAN[^/]*\.md|AUFTRAG[^/]*\.md|PROJEKT-ANWEISUNGEN\.txt|einstellungen\.json|backups/|Aufnahmen/|[^/]*Sync[^/]*\.bat|[^/]*\.alt)$|(^|/)(backups|Aufnahmen)/', re.I)
# Fremdsoftware (Lizenztexte von Chromium/Electron/Node-Paketen enthalten die E-Mails ihrer Autoren) und Prüfsummen: nicht prüfen
THIRD = re.compile(r'(^|/|!)(LICENSES?\.chromium\.html|LICENSE(S)?(\.[A-Za-z]+)?|COPYING|NOTICE)$|(^|/)node_modules/', re.I)
CHECKSUM = re.compile(r'(^|/)SHA256SUMS(\.txt)?$', re.I)
MEDIA = re.compile(r'\.(png|jpe?g|gif|webp|mp4|webm|mov)$', re.I)
TEXT = re.compile(r'\.(html?|js|cjs|mjs|json|md|txt|cs|py|css|svg|ini|cfg|iss|bat|ps1|xml|yml|yaml|csv|log)$', re.I)
SKIP_DIRS = {'node_modules', '.git', '__pycache__'}

def allowed(rule, line, m):
    hit = m.group(0)
    if any(a.search(hit) for a in ALLOW): return True
    if rule == 'Charaktername' and ALLOW_NAME.search(line[max(0, m.start() - 8):m.end() + 8]): return True
    if rule in ('lange Base64-Kette', 'lange Hex-Kette'):
        pre = line[max(0, m.start() - 40):m.start()]
        if 'base64,' in pre or 'data:' in pre or 'sha256' in pre.lower() or 'sha512-' in pre or 'integrity=' in pre or 'virustotal.com/gui/file/' in pre or pre.endswith('@'): return True   # … auch Actions@Commit-SHA (V6)   # eingebettete Bilder/Prüfsummen
        if rule == 'lange Hex-Kette' and len(hit) == 64 and re.match(r'RELEASE-NOTES', SRC_NAME[0].split('/')[-1]): return True   # SHA256 in Release-Notes
        if rule == 'lange Base64-Kette' and not re.search(r'[0-9]', hit) or re.fullmatch(r'[a-z/]+', hit): return True   # Pfade/Wörter
    if rule == 'alte Rücksprung-Adresse' and re.search(r'(EVE-Omni\.html|main\.js)$', SRC_NAME[0]): return True   # Standard für „eigene Rücksprung-Adresse“ (V2, beim Nutzer nötig)
    return False

SRC_NAME = ['']
def scan_text(name, text, out):
    SRC_NAME[0] = name
    for no, line in enumerate(text.splitlines(), 1):
        if len(line) > 20000:   # sehr lange Zeilen (eingebettete Daten): in Stücken
            parts = [(line[i:i + 20000], i) for i in range(0, len(line), 19000)]
        else: parts = [(line, 0)]
        for part, _ in parts:
            for rule, rx in RULES:
                for m in rx.finditer(part):
                    if not allowed(rule, part, m): out.append((name, no, rule, m.group(0)[:80]))

def scan_bytes(name, data, out, media):
    if FORBIDDEN.search(name.replace('\\', '/')): out.append((name, 0, 'verbotene Datei', name.split('/')[-1])); return
    if REMOVED.search(name): out.append((name, 0, 'entfernter Titel im Dateinamen', name.split('/')[-1]))   # auch Bilder/MP3s
    if THIRD.search(name.replace(chr(92), '/')): return
    if MEDIA.search(name): media.append(name); return
    if name.lower().endswith('.zip'):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                for n in z.namelist():
                    if n.endswith('/'):
                        if FORBIDDEN.search(n): out.append((name + '!' + n, 0, 'verbotener Ordner', n))
                        continue
                    if any(('/' + d + '/') in ('/' + n) for d in SKIP_DIRS): continue
                    scan_bytes(name + '!' + n, z.read(n), out, media)
        except zipfile.BadZipFile: out.append((name, 0, 'ZIP kaputt', ''))
        return
    if NAMES.search(name) and not ALLOW_NAME.search(name): out.append((name, 0, 'Charaktername im Dateinamen', name))
    if TEXT.search(name):
        txt = data.decode('utf-8', 'replace')
        if CHECKSUM.search(name.replace(chr(92), '/')): txt = re.sub(r'^[0-9a-f]{64}  ', '', txt, flags=re.M)   # Prüfsummen sind gewollt
        scan_text(name, txt, out)

def scan_path(p, out, media):
    p = Path(p)
    if p.is_file(): scan_bytes(str(p.relative_to(R)) if p.is_relative_to(R) else str(p), p.read_bytes(), out, media); return
    for root, dirs, files in os.walk(p):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = Path(root).relative_to(R) if Path(root).is_relative_to(R) else Path(root)
        for d in list(dirs):
            if FORBIDDEN.search((rel / d).as_posix() + '/'): out.append(((rel / d).as_posix(), 0, 'verbotener Ordner', d)); dirs.remove(d)
        for f in files:
            if Path(root) / f == NAMES_FILE: continue   # die Namensliste selbst (lokal, nie im Repo)
            scan_bytes((rel / f).as_posix(), (Path(root) / f).read_bytes(), out, media)

def default_targets():
    t = [R / 'EVE-Omni.html', R / 'Programm-Quellcode/src', R / 'Programm-Quellcode/demo.js', R / 'README.md', R / 'tools', R / 'tests', R / '.github']
    rel = R / 'release'
    if rel.is_dir():
        vs = sorted([d for d in rel.iterdir() if d.is_dir() and re.match(r'\d+\.\d+', d.name)], key=lambda d: [int(x) for x in re.findall(r'\d+', d.name)])
        if vs: t.append(vs[-1])
        if (rel / 'media/index.html').exists(): t.append(rel / 'media/index.html')
    if (R / 'homepage').is_dir(): t.append(R / 'homepage')
    return [x for x in t if x.exists()]

def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    targets = [Path(a).resolve() for a in args] or default_targets()
    out, media = [], []
    print('EVE Omni Release-Check (Datenschutz)')
    if not NAME_LIST: print('  HINWEIS: keine privaten Namen (RELEASE_CHECK_NAMES bzw. tools/release-check-namen.txt) – Namensprüfung übersprungen, übrige Regeln laufen')
    for t in targets: print('  prüfe ' + (str(t.relative_to(R)) if t.is_relative_to(R) else str(t))); scan_path(t, out, media)
    if out:
        print('\nFUNDE (Datei – Zeile – Fund):')
        for f in out:
            line = '  ' + f[0] + ' – ' + (str(f[1]) if f[1] else '-') + ' – ' + f[2] + ': ' + f[3]
            print(NAMES.sub('***', line) if os.environ.get('RELEASE_CHECK_NAMES') else line)   # V6: Namen aus dem Secret nie ins CI-Log
    if media:
        print('\nBitte von Hand ansehen (Bilder/Videos, ' + str(len(media)) + '):')
        for m in media[:200]: print('  ' + m)
    rc = 1 if out else 0
    if '--technik' in argv:
        print('\nTechnik-Check:'); rc |= subprocess.call([sys.executable, str(R / 'Programm-Quellcode/release-check.py')] + (['--schnell'] if '--schnell' in argv else []), cwd=R)
    print('\n' + ('ALLES OK' if rc == 0 else ('%d FUNDE – nicht veröffentlichen' % len(out) if out else 'Technik-Check FEHLER')))
    return rc

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
