// AG7 (18.10.2026): Farbthema des aktiven EVE-Clients übernehmen – main.js liest „ColorThemes/<Name>“ aus core_char_<id>.dat (neueste Datei je Charakter),
// meldet den Wechsel des vorderen Clients (eveFront); die Seite stellt das passende „(EVE)“-Schema ein (abschaltbar, nur Stil EVE).
const fs = require('fs'), path = require('path'), os = require('os');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    // main.js: Dateien lesen (nachgebaut)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ag7-')), base = path.join(tmp, 'CCP', 'EVE', 'g_tq');
    const put = (st, id, theme, age) => { const d = path.join(base, st); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, 'core_char_' + id + '.dat'); fs.writeFileSync(f, Buffer.from('xx\u0013ColorThemes/' + theme + '\u0013\u000fwnd', 'latin1')); const t = new Date(Date.now() - age * 1000); fs.utimesSync(f, t, t); };
    put('settings_Default', 111, 'Caldari', 500); put('settings_Alt', 111, 'Amarr', 10); put('settings_Default', 222, 'Gallente', 5);
    fs.writeFileSync(path.join(base, 'settings_Default', 'core_char__.dat'), 'ohne'); fs.writeFileSync(path.join(base, 'settings_Default', 'core_user_9.dat'), 'ColorThemes/Minmatar');
    const i = main.indexOf('let eveThemeMem'), j = main.indexOf('function isEveRunningNow');
    const old = process.env.LOCALAPPDATA; process.env.LOCALAPPDATA = tmp;
    const m = new Function('fs', 'path', main.slice(i, j) + '\nreturn eveThemes;')(fs, path)();
    process.env.LOCALAPPDATA = old; fs.rmSync(tmp, { recursive: true, force: true });
    assert(m['111'] === 'Amarr' && m['222'] === 'Gallente' && Object.keys(m).length === 2, 'je Charakter die neueste Datei aus allen Profilordnern (111 Amarr statt Caldari), core_user/leere ignoriert');
    assert(/if \(eve && fg\.lastEve !== fg\.hwnd\)\{ fg\.lastEve = fg\.hwnd; const fc = fg\.clients\.find\(c => c\.hwnd === fg\.hwnd\); if \(fc && fc\.name\) send\(\{ type: 'eveFront', name: fc\.name \}\); \}/.test(main), 'main.js meldet den Wechsel des vorderen Clients');
    assert(/ipcMain\.handle\('evecore:eveThemes', \(\) => eveThemes\(\)\)/.test(main) && /eveThemes: \(\) => ipcRenderer\.invoke\('evecore:eveThemes'\)/.test(fs.readFileSync('/home/claude/preload.js', 'utf-8')), 'IPC + preload');

    // Seite
    const H = {};
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
        w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600000, character_id: 111, character_name: 'Pilot Alpha' }, { access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600000, character_id: 222, character_name: 'Pilot Beta' }]));
        w.evecoreHost = { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: p => Promise.resolve(p), publishView(){}, onCommand(cb){ H.cmd = cb; }, ready(){},
          eveThemes: () => Promise.resolve({ 111: 'Amarr', 222: 'Gallente' }), frontClient: () => Promise.resolve('Pilot Alpha') }; } }).window;
    await tick(2200);
    const d = w.document, sch = () => d.documentElement.getAttribute('data-scheme');
    assert(d.getElementById('ui-evetheme') && d.getElementById('ui-evetheme').checked, 'Haken „Farbthema aus EVE übernehmen“, Standard an');
    assert(sch() === 'amarr-eve', 'beim Start: vorderer Client Alpha → Amarr (' + sch() + ')');
    H.cmd({ type: 'eveFront', name: 'Pilot Beta' }); await tick(80);
    assert(sch() === 'gallente-eve', 'Client gewechselt → sofort Gallente');
    H.cmd({ type: 'eveFront', name: 'Unbekannt' }); await tick(80);
    assert(sch() === 'gallente-eve', 'unbekannter Charakter: bleibt');
    const c = d.getElementById('ui-evetheme'); c.checked = false; c.onchange();
    H.cmd({ type: 'eveFront', name: 'Pilot Alpha' }); await tick(80);
    assert(sch() === 'gallente-eve', 'Haken aus: kein Wechsel');
    c.checked = true; c.onchange(); await tick(80);
    assert(sch() === 'amarr-eve', 'Haken wieder an: übernimmt sofort den vorderen Client');
    const st = d.getElementById('ovs-style'); st.value = 'omni'; st.onchange(); await tick(30);
    const before = sch(); H.cmd({ type: 'eveFront', name: 'Pilot Beta' }); await tick(80);
    assert(sch() === before, 'Stil EVE Omni: kein Wechsel');
    w.close();
    console.log('\nALL AG7 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
