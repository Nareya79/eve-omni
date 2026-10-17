// V6 (17.10.2026): automatischer Build per GitHub Actions – Release-Ordner (Dateiliste, Prüfsummen, neu nach dem Signieren)
// über tools/release-build.py --pruefen/--summen, dazu Sicherheitsregeln im Workflow .github/workflows/release.yml.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = process.env.EVEOMNI_ROOT || path.resolve(__dirname, '..');   // run-local-windows.sh setzt EVEOMNI_ROOT
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v6-'));
const py = args => { const r = cp.spawnSync('python', [path.join(ROOT, 'tools/release-build.py')].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) }); return { code: r.status, out: r.stdout + r.stderr }; };
try{
  const out = path.join(dir, '9.9.9'); fs.mkdirSync(out);
  const files = ['EVE-Omni-Setup-9.9.9.exe', 'EVE-Omni-9.9.9-portable.zip', 'EVE-Omni-Soundtrack.zip'];
  files.forEach((f, i) => fs.writeFileSync(path.join(out, f), 'inhalt ' + i));
  let r = py(['--summen', out]);
  assert(r.code === 0 && /OK +Dateiliste/.test(r.out) && /OK +Prüfsummen/.test(r.out), 'V6: --summen schreibt SHA256SUMS.txt, Ordner vollständig');
  const sums = fs.readFileSync(path.join(out, 'SHA256SUMS.txt'), 'utf8');
  assert(sums.split('\n').filter(Boolean).length === 3 && files.every(f => new RegExp('^[0-9a-f]{64}  ' + f.replace(/\./g, '\\.') + '$', 'm').test(sums)), 'V6: SHA256SUMS.txt hat je Datei eine Zeile „<sha256>  <Name>“');
  assert(py(['--pruefen', out]).code === 0, 'V6: --pruefen auf vollständigem Ordner ist grün');
  fs.writeFileSync(path.join(out, files[0]), 'signiert');   // wie nach dem Signieren: Installer getauscht
  r = py(['--pruefen', out]);
  assert(r.code === 1 && /FEHLER Prüfsummen/.test(r.out), 'V6: geänderte Datei → Prüfsumme passt nicht');
  assert(py(['--summen', out]).code === 0 && py(['--pruefen', out]).code === 0, 'V6: nach dem Signieren --summen → wieder grün');
  fs.writeFileSync(path.join(out, 'extra.txt'), 'x');
  r = py(['--pruefen', out]);
  assert(r.code === 1 && /FEHLER Dateiliste/.test(r.out), 'V6: zusätzliche Datei im Release-Ordner wird gemeldet');
  fs.unlinkSync(path.join(out, 'extra.txt')); fs.unlinkSync(path.join(out, files[2]));
  r = py(['--pruefen', out]);
  assert(r.code === 1 && /FEHLER Dateiliste/.test(r.out), 'V6: fehlende Soundtrack-ZIP wird gemeldet');

  // Workflow
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/release.yml'), 'utf8');
  assert(/tags: \['v\*'\]/.test(wf) && /workflow_dispatch:/.test(wf) && /runs-on: windows-latest/.test(wf), 'V6: Auslöser Tag v* + Knopf, Läufer windows-latest');
  const uses = wf.match(/uses: \S+/g) || [];
  assert(uses.length >= 6 && uses.every(u => /@[0-9a-f]{40}$/.test(u)), 'V6: alle fremden Actions auf Commit-SHA festgenagelt (' + uses.length + ')');
  assert(/^permissions:\n  contents: read/m.test(wf) && (wf.match(/contents: write/g) || []).length === 1 && wf.indexOf('contents: write') > wf.indexOf('\n  release:'), 'V6: oben nur Lesen, contents: write nur im Release-Job');
  assert(/gh release create[^\n]*--draft/.test(wf) && !/--draft=false|gh release edit/.test(wf), 'V6: nur Release-Entwurf, nie veröffentlichen');
  assert(/npm ci --ignore-scripts\n/.test(wf) && !/npm install/.test(wf), 'V6: Abhängigkeiten nur aus Sperrdateien (npm ci)');
  assert(/SHASUMS256\.txt/.test(wf) && /\$want -ne \$have/.test(wf) && /SOUNDTRACK_SHA256: [0-9a-f]{64}\n/.test(wf), 'V6: Electron gegen SHASUMS256.txt, Soundtrack gegen festen SHA256 geprüft');
  const sign = wf.split(/\n      - /).filter(s => /signpath\/|signiert-/.test(s));
  assert(sign.length === 6 && sign.every(s => /if: env\.SIGNPATH == 'true'/.test(s)) && /SIGNPATH: \$\{\{ secrets\.SIGNPATH_API_TOKEN != '' \}\}/.test(wf), 'V6: alle 6 Signatur-Schritte laufen nur mit Secret SIGNPATH_API_TOKEN');
  assert(['ORGANIZATION_ID', 'PROJECT_SLUG', 'SIGNING_POLICY_SLUG', 'ARTIFACT_CONFIGURATION_SLUG'].every(k => wf.indexOf('vars.SIGNPATH_' + k) > 0), 'V6: SignPath-Angaben als Repo-Variablen');
  assert(wf.indexOf('EVE-Omni.exe signieren') < wf.indexOf('release-build.py --src') && wf.indexOf('release-build.py --src') < wf.indexOf('Installer signieren') && wf.indexOf('Installer signieren') < wf.indexOf('--summen'), 'V6: Reihenfolge exe signieren → Installer bauen → Installer signieren → Prüfsummen neu');
  assert(!/echo[^\n]*secrets\.|Write-Output[^\n]*secrets\./.test(wf) && /::add-mask::/.test(wf), 'V6: keine Secrets ausgeben, private Namen im Log verdeckt');
  console.log('ALL TESTS PASSED');
}catch(e){ console.error(e.message); process.exit(1); }
finally{ try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){} }
