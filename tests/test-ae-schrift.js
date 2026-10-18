// AE + AF1 (18.10.2026): EVE-Schrift aus der eigenen EVE-Installation (main.js eveFontsRead, nur lokal gelesen), Seite bindet sie per FontFace ein
// (html.eve-font), Stil EVE nimmt sie über --sans/--cond (sonst Saira), Schrift-Hierarchie ohne Großbuchstaben, Zahlen fett.
const fs = require('fs'), path = require('path'), os = require('os');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    // main.js: eveFontsRead mit nachgebauter EVE-Installation (Launcher-Daten → resfileindex → ResFiles)
    const i = main.indexOf('const EVE_FONTS'), j = main.indexOf('function isEveRunningNow');
    assert(i > 0 && j > i, 'main.js: EVE_FONTS + eveFontsRead vorhanden');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-')), appData = path.join(tmp, 'appdata'), root = path.join(tmp, 'EVE Online');
    fs.mkdirSync(path.join(appData, 'EVE Online'), { recursive: true }); fs.mkdirSync(path.join(root, 'tq'), { recursive: true }); fs.mkdirSync(path.join(root, 'ResFiles', 'aa'), { recursive: true });
    fs.writeFileSync(path.join(appData, 'EVE Online', 'launcher-data.json'), JSON.stringify({ x: { 'shared-cache': { 'eve-online': { location: { path: root, isConfirmed: true } } } } }, null, '\t'));
    fs.writeFileSync(path.join(root, 'tq', 'resfileindex.txt'), 'res:/a.txt,aa/x,1,2\r\nres:/ui/fonts/evesansneue-regular.otf,aa/reg_1,1,8\r\nres:/ui/fonts/evesansneue-bold.otf,aa/bold_1,1,8\r\nres:/ui/fonts/evesansneue-bolditalic.otf,aa/bi_1,1,8\r\n');
    fs.writeFileSync(path.join(root, 'ResFiles', 'aa', 'reg_1'), 'OTTOregular'); fs.writeFileSync(path.join(root, 'ResFiles', 'aa', 'bold_1'), 'nichtOTF');
    const read = new Function('fs', 'path', 'app', main.slice(i, j) + '\nreturn eveFontsRead;')(fs, path, { getPath: () => appData });
    const f = read();
    assert(f && f.regular && f.regular.toString() === 'OTTOregular', 'Regular aus ResFiles über den Index gelesen');
    assert(!f.bold && !f.condensed && !('bolditalic' in f), 'Datei ohne OTF-Kopf / fehlender Eintrag / Kursiv: nicht genommen');
    assert(read() === f, 'nur einmal je Programmstart gelesen');
    const none = new Function('fs', 'path', 'app', main.slice(i, j) + '\nreturn eveFontsRead;')(fs, path, { getPath: () => path.join(tmp, 'leer') })();
    assert(none === null, 'ohne EVE-Installation: null (Seite nimmt Ersatzschrift)');
    fs.rmSync(tmp, { recursive: true, force: true });
    assert(/ipcMain\.handle\('evecore:eveFonts', \(\) => eveFontsRead\(\)\)/.test(main), 'main.js: IPC evecore:eveFonts');
    assert(/eveFonts: \(\) => ipcRenderer\.invoke\('evecore:eveFonts'\)/.test(fs.readFileSync('/home/claude/preload.js', 'utf-8')), 'preload: eveFonts()');

    // Seite: FontFace für alle gelieferten Schnitte, html.eve-font
    const added = [];
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){
        w.fetch = () => Promise.reject(new Error('offline'));
        w.FontFace = function(fam, buf, d){ this.family = fam; this.weight = d.weight; this.size = buf.length; };
        Object.defineProperty(w.document, 'fonts', { value: { add: x => added.push(x), check: () => true, ready: Promise.resolve() } });
        w.evecoreHost = { eveFonts: () => Promise.resolve({ regular: new Uint8Array(4), bold: new Uint8Array(5), condensed: new Uint8Array(6) }),
          getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(){}, ready(){}, publishView(){} };
      } }).window;
    await tick(600);
    assert(w.document.documentElement.classList.contains('eve-font'), 'EVE-Schrift gefunden → html.eve-font');
    assert(added.map(x => x.family + ' ' + x.weight).join(',') === 'EVE Sans Neue 400,EVE Sans Neue 700,EVE Sans Neue Condensed 400', 'FontFace je Schnitt (Regular, Bold, Condensed)');
    w.close();

    // CSS: Stil EVE = EVE-Schrift, sonst Saira; Hierarchie
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve\{--sans:'EVE Sans Neue','Saira Semi Condensed'/.test(css) && /--cond:'EVE Sans Neue Condensed','Saira Semi Condensed'/.test(css), 'Stil EVE: EVE Sans Neue, sonst Saira Semi Condensed');
    assert(/html\.ov-eve:not\(\.eve-font\) body\{letter-spacing:\.012em\}/.test(css), 'Saira mit angeglichenem Buchstabenabstand');
    assert(/family=Saira\+Semi\+Condensed:wght@400;600;700/.test(html), 'Saira wird wie Barlow über Google Fonts geladen');
    assert(/html\.ov-eve :is\(\.acc-h,[^)]*\)\{text-transform:none;letter-spacing:0;font-family:var\(--sans\);font-weight:400/.test(css), 'Abschnitte normal statt GROSS');
    assert(/html\.ov-eve :is\(thead th,[^)]*\)\{text-transform:none;[^}]*color:var\(--text-muted\)\}/.test(css), 'Spaltenköpfe klein, grau, ohne Großbuchstaben');
    assert(/html\.ov-eve \.mono\{font-weight:700\}/.test(css), 'Zahlen fett');
    assert(/html\.ov-eve #ov-root\{[^}]*font-family:var\(--sans\)/.test(css), 'Overlay-Rahmen nimmt --sans (statt fest Barlow)');
    console.log('\nALL AE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
