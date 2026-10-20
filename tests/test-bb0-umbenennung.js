// BB0 (27.09.2026): EVECore heisst jetzt EVE Omni – Datenumzug mit Beispielordner, Sicherungen, Name/Symbol, Speicher-Schluessel unveraendert
const fs = require('fs'), path = require('path');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const umzug = require('/home/claude/umzug.js');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');   // = EVE-Omni.html (Runner kopiert sie unter altem Namen)
try{
  // Beispielordner wie %APPDATA%\EVECore
  const T = '/tmp/bb0-umzug', A = path.join(T, 'EVECore'), N = path.join(T, 'EVE Omni');
  fs.rmSync(T, { recursive: true, force: true });
  const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(A, f)), { recursive: true }); fs.writeFileSync(path.join(A, f), t); };
  put('einstellungen.json', '{"autostart":false}');
  put('Local Storage/leveldb/000003.log', 'eve-zentrale-trades-v1');
  put('Partitions/browser/Cookies', 'spotify');
  put('Partitions/browser/Cache/Cache_Data/f_000001', 'gross');
  put('Cache/Cache_Data/f_000002', 'gross');
  put('GPUCache/data_0', 'x');
  assert(umzug.moveOnce(A, N) === true, 'BB0: alter Ordner wird beim ersten Start kopiert');
  assert(fs.readFileSync(path.join(N, 'einstellungen.json'), 'utf8') === '{"autostart":false}' && fs.readFileSync(path.join(N, 'Local Storage/leveldb/000003.log'), 'utf8') === 'eve-zentrale-trades-v1', 'BB0: Einstellungen + localStorage übernommen');
  assert(fs.existsSync(path.join(N, 'Partitions/browser/Cookies')), 'BB0: Browser-Anmeldungen (persist:browser) übernommen');
  assert(!fs.existsSync(path.join(N, 'Cache')) && !fs.existsSync(path.join(N, 'GPUCache')) && !fs.existsSync(path.join(N, 'Partitions/browser/Cache')), 'BB0: Zwischenspeicher nicht mitkopiert');
  assert(fs.existsSync(path.join(A, 'einstellungen.json')) && !fs.existsSync(N + '.neu'), 'BB0: alter Ordner bleibt als Sicherung, kein Rest vom Umzug');
  fs.writeFileSync(path.join(N, 'einstellungen.json'), '{"neu":1}');
  assert(umzug.moveOnce(A, N) === false && fs.readFileSync(path.join(N, 'einstellungen.json'), 'utf8') === '{"neu":1}', 'BB0: zweiter Start überschreibt nichts');
  // 2.0.37: neuer Ordner schon da, aber leer (Testlauf / Hinweis-Start) -> zur Seite legen und trotzdem umziehen
  const N2 = path.join(T, 'EVE Omni 2'); fs.mkdirSync(N2); fs.writeFileSync(path.join(N2, 'einstellungen.json'), '{"leer":1}');
  assert(umzug.moveOnce(A, N2) === true && fs.readFileSync(path.join(N2, 'einstellungen.json'), 'utf8') === '{"autostart":false}' && fs.existsSync(path.join(N2, umzug.MARK)), 'BB0: leerer neuer Ordner ohne Merker -> Daten kommen trotzdem');
  assert(fs.readdirSync(T).some(n => /^EVE Omni 2 \(vor Umzug \d+\)$/.test(n)), 'BB0: der leere Ordner wird zur Seite gelegt, nicht gelöscht');
  assert(umzug.moveOnce(path.join(T, 'gibtsnicht'), path.join(T, 'neu2')) === false && !fs.existsSync(path.join(T, 'neu2')), 'BB0: neuer Nutzer ohne alten Ordner: nichts kopiert');
  // Sicherungsordner
  const SA = path.join(T, 'EVECore-Sicherungen'), SN = path.join(T, 'EVE-Omni-Sicherungen');
  fs.mkdirSync(SA); fs.writeFileSync(path.join(SA, 'EVECore-Sicherung-2026-09-20_1200.json'), '{}'); fs.writeFileSync(path.join(SA, 'notiz.txt'), 'x');
  fs.mkdirSync(SN); fs.writeFileSync(path.join(SN, 'EVE-Omni-Sicherung-2026-09-27_1830.json'), '{"neu":1}');   // Ordner schon da mit neuer Sicherung
  assert(umzug.moveBackups(SA, SN) === true && fs.existsSync(path.join(SN, 'EVE-Omni-Sicherung-2026-09-20_1200.json')) && !fs.existsSync(path.join(SN, 'notiz.txt')) && fs.existsSync(path.join(SA, 'EVECore-Sicherung-2026-09-20_1200.json')) && fs.readFileSync(path.join(SN, 'EVE-Omni-Sicherung-2026-09-27_1830.json'), 'utf8') === '{"neu":1}', 'BB0: alte Sicherungen mit neuem Namen übernommen, Original bleibt');
  assert(umzug.moveBackups(SA, SN) === false, 'BB0: Sicherungen nur einmal übernehmen');
  fs.rmSync(T, { recursive: true, force: true });
  // Programm (main.js)
  assert(/APP_ID = 'de\.eveomni\.app'/.test(main) && /ud = path\.join\(app\.getPath\('appData'\), 'EVE Omni'\), old = path\.join\(app\.getPath\('appData'\), 'EVECore'\)/.test(main) && /if \(!oldRunning\) try\{ umzug\.moveOnce\(old, ud\); \}catch\(e\)\{\}/.test(main) && /app\.setPath\('userData', oldRunning \? path\.join\(app\.getPath\('temp'\), 'EVE Omni Hinweis'\) : ud\)/.test(main) && /!fs\.existsSync\(path\.join\(ud, umzug\.MARK\)\)/.test(main), 'BB0: Programm nutzt %APPDATA%\\EVE Omni und holt vorher EVECore');
  assert(/IMAGENAME eq EVECore\.exe/.test(main) && /if \(oldRunning\)\{ dialog\.showMessageBoxSync\([^]*?app\.quit\(\); return; \}/.test(main), 'BB0: läuft EVECore noch, kein Umzug – Hinweis und Beenden');
  assert(/'EVE-Omni-Sicherungen'/.test(main) && /'EVE-Omni-Sicherung-'/.test(main) && /\(EVE-Omni\|EVECore\)-Sicherung-/.test(main) && /o\.format !== 'evecore-daten'/.test(main), 'BB0: Sicherungen neu benannt, alte zählen beim Aufräumen mit, Dateiformat gleich');
  assert(/'EVE Omni\.lnk'/.test(main) && /'EVECore\.lnk'/.test(main) && /name: OLD_APP_ID/.test(main), 'BB0: alte Startmenü-Verknüpfung + Autostart werden weggeräumt');
  // Seite
  assert(/^(<meta charset="utf-8">\s*)?<title>EVE Omni Beta<\/title>/.test(html) && /<h1>EVE Omni<\/h1>/.test(html) && /class="ov-brand">EVE Omni</.test(html), 'BB0: Titel, Kopfzeile, Overlay-Leiste heißen EVE Omni');
  const fav = /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([^"]+)"/.exec(html);
  assert(fav && /stroke="#e0b45d"/.test(Buffer.from(fav[1], 'base64').toString()), 'BB0: Favicon = neues Symbol (goldener Ring)');
  assert(/Fan-Tool – nicht von CCP/.test(html) && /window\.EVECore = \{/.test(html), 'BB0: Fan-Tool-Hinweis, Schnittstelle window.EVECore bleibt');
  const keys = (html.match(/["']eve-[a-z]+-[a-z0-9-]+-v\d+["']/g) || []).filter(k => !/eve-omni-sync-v1/.test(k));   // 13.10.: Salz der Handy-Sync-Verschlüsselung, kein Speicher-Schlüssel
  assert(keys.length > 20 && keys.every(k => /^.eve-zentrale-/.test(k)), 'BB0: alle Speicher-Schlüssel heißen weiter eve-zentrale-…');
  console.log('\nALL BB0 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e); process.exit(1); }
