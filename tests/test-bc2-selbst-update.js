// BC2 (23.10.2026): Update direkt aus EVE Omni – prüft selfUpdate() aus der echten main.js gegen einen nachgebauten GitHub-Server:
// Download mit Fortschritt, SHA256 aus SHA256SUMS.txt, falscher Hash → Datei weg + kein Setup, fehlendes Update-Asset, Abbrechen in der Rückfrage,
// Setup-Aufruf still mit /EOUPDATE und /DIR. Dazu BC1: openExternal lässt eigene Seiten durch, fremde nicht.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bc2-')), exeDir = path.join(tmp, 'EVE Omni');
fs.mkdirSync(exeDir); fs.writeFileSync(path.join(exeDir, 'unins000.exe'), '');
const payload = crypto.randomBytes(300000), good = crypto.createHash('sha256').update(payload).digest('hex');
let sums = good + '  EVE-Omni-Update-5.2.1.exe\n', withUpd = true;
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/rel/')) return r.end(JSON.stringify({ assets: [
    withUpd && { name: 'EVE-Omni-Update-5.2.1.exe', size: payload.length, browser_download_url: 'https://github.com/Nareya79/eve-omni/releases/download/v5.2.1/EVE-Omni-Update-5.2.1.exe' },
    { name: 'SHA256SUMS.txt', browser_download_url: 'https://github.com/Nareya79/eve-omni/releases/download/v5.2.1/SHA256SUMS.txt' }].filter(Boolean) }));
  if (q.url.endsWith('SHA256SUMS.txt')) return r.end(sums);
  r.setHeader('content-length', payload.length); r.end(payload);
});
(async () => {
  await new Promise(res => srv.listen(0, res));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const net = { fetch: (u, o) => fetch(u.replace('https://api.github.com/repos/Nareya79/eve-omni/releases/tags/', base + '/rel/').replace('https://github.com', base), o) };
  let spawned = null, answer = 0, quit = 0;
  const fakeRequire = m => m === 'electron' ? { net } : m === 'child_process' ? { spawn: (f, a) => { spawned = { f, a }; return { unref(){} }; } } : require(m);
  const i = main.indexOf('const UPD_REL'), j = main.indexOf('\n}\n', main.indexOf('async function selfUpdate')) + 3;
  const code = main.slice(i, j) + ';return { selfUpdate, updCan };';
  const env = { require: fakeRequire, fs, path, IS_WIN: true, TEST: false, process: { execPath: path.join(exeDir, 'EVE-Omni.exe') },
    app: { getPath: () => tmp, quit: () => quit++ }, win: null, eoAskAny: () => Promise.resolve({ response: answer }), dialog: {}, saveSettings(){}, quitting: false };
  const { selfUpdate, updCan } = new Function(...Object.keys(env), code)(...Object.values(env));
  const prog = []; const wc = { isDestroyed: () => false, send: (ch, m) => prog.push(m.p) };
  const file = path.join(tmp, 'EVE-Omni-Update-5.2.1.exe');
  try{
    assert(updCan() === true, 'installierte Version (unins000.exe neben der exe) kann sich aktualisieren');
    let r = await selfUpdate('v5.2.1', wc);
    await new Promise(res => setTimeout(res, 400));
    assert(r.ok === true, 'Update geladen + Prüfsumme stimmt');
    assert(fs.readFileSync(file).equals(payload), 'Datei vollständig in %TEMP%');
    assert(prog[0] === 0 && prog[prog.length - 1] === 100, 'Fortschritt 0 … 100 % ans Fenster');
    assert(spawned && spawned.f === file && spawned.a.includes('/EOUPDATE') && spawned.a.includes('/SILENT') && spawned.a.includes('/DIR=' + exeDir), 'Setup still mit /EOUPDATE und /DIR gestartet');
    assert(quit === 1, 'EVE Omni beendet sich');
    spawned = null; sums = '0'.repeat(64) + '  EVE-Omni-Update-5.2.1.exe\n';
    r = await selfUpdate('v5.2.1', wc);
    assert(r.why === 'hash' && !fs.existsSync(file) && !spawned, 'falsche Prüfsumme: Datei gelöscht, kein Setup');
    sums = good + '  EVE-Omni-Update-5.2.1.exe\n'; answer = 1;
    r = await selfUpdate('v5.2.1', wc);
    assert(r.why === 'cancel' && !spawned, 'Abbrechen in der Rückfrage: kein Setup');
    withUpd = false;
    r = await selfUpdate('v5.2.1', wc);
    assert(r.why === 'noasset', 'Release ohne Update-Datei (z. B. 5.2.0): Hinweis + Download-Seite');
    assert((await selfUpdate('5.2.1; calc', wc)).why === 'tag', 'nur echte Versionsnummern');
    fs.unlinkSync(path.join(exeDir, 'unins000.exe'));
    assert(updCan() === false && (await selfUpdate('v5.2.1', wc)).why === 'portable', 'portable (ohne unins000.exe): kein Selbst-Update');
    // BC1
    const oe = main.slice(main.indexOf("ipcMain.on('evecore:openExternal'"), main.indexOf('\n', main.indexOf("ipcMain.on('evecore:openExternal'")));
    const OWN_SITES = eval(main.match(/const OWN_SITES = (\/.+\/i);/)[1]); let opened = [];
    let h2; new Function('ipcMain', 'shell', 'OWN_SITES', oe.replace(/;\s*\/\/[^\n]*$/, ';'))({ on: (n, f) => { h2 = f; } }, { openExternal: u => opened.push(u) }, OWN_SITES);
    ['https://github.com/Nareya79/eve-omni/releases/tag/v5.2.1', 'https://login.eveonline.com/x', 'https://evil.example/', 'http://github.com/Nareya79/eve-omni', 'https://github.com/Nareya79evil/x'].forEach(u => h2({}, u));
    assert(opened.join(' ') === 'https://github.com/Nareya79/eve-omni/releases/tag/v5.2.1 https://login.eveonline.com/x', 'BC1: Download-Seite + Login öffnen, fremde/unsichere Adressen nicht');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exitCode = 1; }
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
})();
