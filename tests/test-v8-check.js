// V8 (03.10.2026): tools/release-check.py – je Regel ein Beispiel, das anschlagen muss, plus eine saubere Datei, die durchgeht.
// Namen/Pfade werden hier ROT13-kodiert erzeugt, damit diese Testdatei selbst sauber bleibt.
// V6: Die privaten Namen kommen aus RELEASE_CHECK_NAMES (GitHub-Secret) – hier nur erfundene Beispielnamen.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = process.env.EVEOMNI_ROOT || path.resolve(__dirname, '..');   // run-local-windows.sh setzt EVEOMNI_ROOT
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const rot13 = t => t.replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v8-'));
const NAMES = 'Testpilot Zulu,Beispielnyx,settings_Beispiel';
function run(files, names){
  const d = fs.mkdtempSync(path.join(dir, 'f-'));
  Object.keys(files).forEach(f => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), files[f]); });
  const r = cp.spawnSync('python', [path.join(ROOT, 'tools/release-check.py'), d], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', RELEASE_CHECK_NAMES: names === undefined ? NAMES : names }) });
  return { code: r.status, out: r.stdout + r.stderr };
}
try{
  const clean = run({ 'readme.md': 'EVE Omni von ' + rot13('Anerln79') + '. Spenden an ' + rot13('Anerln Zlgurp') + '. Client-ID aa3a93ff84e84013967e34b5e35b5267, Kontakt contact@nareya79.com.\nBild: data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAA'.repeat(8) });
  assert(clean.code === 0 && /ALLES OK/.test(clean.out), 'V8: saubere Datei geht durch (erlaubt: Nareya79, Spenden-Charakter, Client-ID, Kontakt, eingebettetes Bild)');
  const cases = [
    ['Charaktername', { 'a.txt': 'Hauler: Testpilot Zulu' }],
    ['Charaktername', { 'a.md': 'mit BEISPIELNYX geflogen' }],
    ['Charaktername', { 'a.txt': 'settings_Beispiel.dat' }],
    ['Benutzername/Pfad', { 'a.js': '// ' + 'C:' + '\\Users\\' + 'jemand' + '\\Documents' }],
    ['alte Rücksprung-Adresse', { 'a.html': 'https://claude.ai/artifact/' + 'SCXYB3dGYr' + 'Vf9XaTZcQW7U' }],
    ['Token (JWT)', { 'a.json': '"eyJ' + 'hbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9' + '.eyJzdWIiOiJDSEFSQUNURVI6RVZFOjEyMyJ9abcdefgh.sig"' }],
    ['Token (refresh_token)', { 'a.json': '{"refresh_token"' + ': "AbCdEf0123456789AbCdEf0123456789"}' }],
    ['Client-Secret', { 'a.js': 'const client' + '_secret = "Xk92jdkLqpWe8"' }],
    ['lange Hex-Kette', { 'a.txt': 'key=' + '9f86d081884c7d65' + '9a2feaa0c55ad015' + 'a3bf4f1b' }],
    ['E-Mail', { 'a.md': 'schreib an jemand' + '@example.org' }],
    ['verbotene Datei', { 'UEBERGABE.md': 'intern' }],
    ['verbotene Datei', { 'sub/einstellungen.json': '{}' }],
    ['verbotener Ordner', { 'backups/x.txt': 'alt' }],
    ['entfernter Titel', { 'soundtrack.json': '{ "title": "' + rot13('Fhaoernx') + '" }' }],   // 04.10.2026: Titel ist überall raus
    ['entfernter Titel im Dateinamen', { ['Nareya79 - ' + rot13('Fhaoernx') + '.jpg']: 'x' }]
  ];
  cases.forEach(([rule, files]) => { const r = run(files); assert(r.code === 1 && r.out.indexOf(rule) >= 0 && /– (\d+|-) –/.test(r.out), 'V8: Regel „' + rule + '“ schlägt an (' + Object.keys(files)[0] + ')'); });
  // V6: ohne Namensliste (kein Secret, keine Datei) läuft der Check mit den übrigen Regeln weiter und sagt das
  const nn = run({ 'a.txt': 'Hauler: Testpilot Zulu' }, ''), nm = run({ 'a.md': 'schreib an jemand' + '@example.org' }, '');
  assert(nn.code === 0 && /HINWEIS: keine privaten Namen/.test(nn.out) && nm.code === 1 && /E-Mail/.test(nm.out), 'V6: ohne RELEASE_CHECK_NAMES Hinweis, übrige Regeln schlagen weiter an');
  // ZIP-Inhalt wird mitgeprüft (Python baut das ZIP)
  const zd = fs.mkdtempSync(path.join(dir, 'z-')), zf = path.join(zd, 'paket.zip');
  cp.spawnSync('python', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("app/readme.txt", sys.argv[2]); z.close()', zf, 'Pilot Beispielnyx']);
  const zr = run({}); const r2 = cp.spawnSync('python', [path.join(ROOT, 'tools/release-check.py'), zf], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', RELEASE_CHECK_NAMES: NAMES }) });
  assert(r2.status === 1 && /paket\.zip!app\/readme\.txt – 1 – Charaktername/.test(r2.stdout), 'V8: Funde in ZIP-Dateien mit Pfad im ZIP');
  // das echte Projekt (Standardziele) ist sauber
  const real = cp.spawnSync('python', [path.join(ROOT, 'tools/release-check.py')], { encoding: 'utf8', cwd: ROOT, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) });
  assert(real.status === 0, 'V8: EVE-Omni.html, Programm, README, tools ohne Funde' + (real.status ? '\n' + real.stdout.slice(-800) : ''));
  console.log('ALL TESTS PASSED');
}catch(e){ console.error(e.message); process.exit(1); }
finally{ try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){} }
