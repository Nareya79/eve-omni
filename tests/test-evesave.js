// EVE-Client-Einstellungen sichern / Profile / Wiederherstellen (04.10.2026) – echtes evesave.js mit Test-Ordnern, dazu die Einstellungsseite.
const fs = require('fs'), path = require('path'), os = require('os');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const ES = require('/home/claude/evesave.js');
(async () => {
  try{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esv-')), base = path.join(tmp, 'eve'), dest = path.join(tmp, 'save');
    const put = (p, f, t) => { fs.mkdirSync(path.join(base, p), { recursive: true }); fs.writeFileSync(path.join(base, p, f), t); };
    put('settings_Default', 'core_char_111.dat', 'A1'); put('settings_Default', 'core_char_222.dat', 'B1'); put('settings_Default', 'core_user_9.dat', 'U1');
    put('settings_Default', 'prefs.ini', 'P'); put('settings_Alt', 'core_char_111.dat', 'A1alt');
    fs.mkdirSync(path.join(base, 'settings_Default', 'Browser'), { recursive: true }); fs.writeFileSync(path.join(base, 'settings_Default', 'cache.bin'), 'X');
    let L = ES.list(base, dest);
    assert(L.ok && L.profiles.length === 2 && L.chars.find(c => c.id === '111').profiles.length === 2 && L.saves.length === 0, 'Profile und Charaktere erkannt');
    const s1 = ES.save(base, dest, 'auto');
    assert(s1.files === 5 && fs.existsSync(path.join(dest, s1.folder, 'settings_Alt', 'core_char_111.dat')) && !fs.existsSync(path.join(dest, s1.folder, 'settings_Default', 'cache.bin')) && !fs.existsSync(path.join(dest, s1.folder, 'settings_Default', 'Browser')), 'Sicherung: nur Einstellungsdateien, alle Profile, ohne Cache/Browser');
    ES.save(base, dest, 'profil', 'Mining: Layout');
    assert(fs.existsSync(path.join(dest, 'profil-Mining Layout', 'settings_Default', 'core_user_9.dat')), 'Profil mit Namen (unerlaubte Zeichen entfernt)');
    // Wiederherstellen nur für einen Charakter
    fs.writeFileSync(path.join(base, 'settings_Default', 'core_char_111.dat'), 'A2'); fs.writeFileSync(path.join(base, 'settings_Default', 'core_char_222.dat'), 'B2'); fs.writeFileSync(path.join(base, 'settings_Default', 'core_user_9.dat'), 'U2');
    const r1 = ES.restore(base, dest, 'profil-Mining Layout', ['111']);
    const rd = f => fs.readFileSync(path.join(base, 'settings_Default', f), 'utf8');
    assert(rd('core_char_111.dat') === 'A1' && rd('core_char_222.dat') === 'B2' && rd('core_user_9.dat') === 'U2' && fs.readFileSync(path.join(base, 'settings_Alt', 'core_char_111.dat'), 'utf8') === 'A1alt', 'Laden für einen Charakter: nur dessen Datei, in allen Profilen');
    assert(/^vor-laden-/.test(r1.before) && fs.readFileSync(path.join(dest, r1.before, 'settings_Default', 'core_char_111.dat'), 'utf8') === 'A2', 'Vor dem Laden wird der jetzige Stand gesichert');
    ES.restore(base, dest, 'profil-Mining Layout', null);
    assert(rd('core_char_222.dat') === 'B1' && rd('core_user_9.dat') === 'U1', 'Laden „alles“: alle Dateien wie gesichert');
    // Aufräumen: höchstens 10 automatische, Profile bleiben
    for (let i = 0; i < 14; i++){ const f = path.join(dest, 'auto-2026010' + String(i).padStart(2, '0')); fs.mkdirSync(f, { recursive: true }); const t = new Date(2026, 0, 1 + i); fs.utimesSync(f, t, t); }
    ES.save(base, dest, 'auto');
    L = ES.list(base, dest);
    assert(L.saves.filter(s => s.kind !== 'profil').length === 10 && L.saves.some(s => s.kind === 'profil'), 'Nur die letzten 10 automatischen bleiben, Profile nie gelöscht');
    let bad = ''; try{ ES.restore(base, dest, '../eve', null); }catch(e){ bad = e.message; }
    assert(/nicht gefunden/.test(bad), 'Fremde Ordnernamen werden abgelehnt');
    fs.rmSync(tmp, { recursive: true, force: true });

    // Einstellungsseite
    const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8'), calls = [];
    const LIST = { base: 'X', dest: 'Y', ok: true, profiles: ['settings_Default'], chars: [{ id: '111', profiles: ['settings_Default'] }],
      saves: [{ name: 'profil-Mining', kind: 'profil', label: 'Mining', t: Date.now() }, { name: 'auto-20261004_120000', kind: 'auto', label: 'auto', t: Date.now() - 1e6 }] };
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){
        w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Taron Velkar' }]));
        w.fetch = () => Promise.reject(new Error('offline'));
        w.confirm = () => true;
        w.evecoreHost = { isHost: true, getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {}, eveSaveAuto: true }), setSettings: p => { calls.push(['set', p]); return Promise.resolve({}); },
          onCommand(){}, ready(){}, publishView(){}, eveSave: o => { calls.push(o); return Promise.resolve(Object.assign({}, LIST, o.op === 'restore' ? { done: { files: 3, before: 'vor-laden-1' } } : o.op === 'save' ? { done: { files: 5, folder: 'auto-x' } } : {})); } };
      } }).window;
    await tick(800);
    const d = w.document, $ = id => d.getElementById(id);
    assert($('esv-box') && $('esv-pick').options.length === 1 && /^Mining – /.test($('esv-pick').options[0].textContent) && $('esv-auto').checked, 'Seite: Profil-Auswahl nur mit Profilen, Automatik an');
    assert($('esv-bpick').options.length === 1 && /^Sicherung – /.test($('esv-bpick').options[0].textContent), '17.10.: Sicherungen in eigener Auswahl');
    assert(/Taron Velkar/.test($('esv-chars').textContent) && $('esv-all').checked, 'Charaktere mit Namen, „Alles“ vorgewählt');
    $('esv-now').onclick(); await tick(50);
    assert(calls.some(c => c.op === 'save') && /Gesichert: 5 Dateien/.test($('esv-st').textContent), '„Jetzt sichern“');
    d.querySelector('#esv-chars input[data-esv]').checked = true; d.querySelector('#esv-chars input[data-esv]').onchange();
    $('esv-load').onclick(); await tick(50);
    const rc = calls.filter(c => c.op === 'restore')[0];
    assert(rc && rc.name === 'profil-Mining' && rc.chars.join() === '111' && !$('esv-all').checked && /vor-laden-1/.test($('esv-st').textContent), 'Laden für den gewählten Charakter, Meldung mit Sicherung vorher');
    $('esv-bload').onclick(); await tick(50);
    assert(calls.filter(c => c.op === 'restore')[1].name === 'auto-20261004_120000', 'Sicherung wiederherstellen nimmt die Sicherungs-Auswahl');
    $('esv-bdel').onclick(); await tick(50);
    assert(calls.some(c => c.op === 'remove' && c.name === 'auto-20261004_120000'), 'Sicherung löschen');
    $('esv-auto').checked = false; $('esv-auto').onchange();
    assert(calls.some(c => c[0] === 'set' && c[1].eveSaveAuto === false), 'Automatik abschaltbar');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
