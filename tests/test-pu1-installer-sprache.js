// PU1 (Discord, 5.0): Im Installer gewählte Sprache gilt beim ersten Start – auch wenn alte Daten Deutsch hatten; danach zählt die Wahl in EVE Omni.
// Installer schreibt resources/app/install-lang, main.js liest + löscht sie, preload reicht sie als evecoreHost.installLang an die Seite.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const root = process.env.EVEOMNI_ROOT;
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra, host, q){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test' + (q || ''), pretendToBeVisual:true,
    beforeParse(w){ Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k])); w.fetch = () => Promise.reject(new Error('offline')); if (host) w.evecoreHost = host; } }).window;
}
(async () => {
  try{
    if (root){
      const iss = fs.readFileSync(path.join(root, 'tools', 'installer.iss'), 'utf-8'), pre = fs.readFileSync(path.join(root, 'Programm-Quellcode', 'src', 'preload.js'), 'utf-8');
      assert(/SaveStringToFile\(ExpandConstant\('\{app\}\\resources\\app\\install-lang'\), ActiveLanguage/.test(iss) && /Name: "en"; MessagesFile/.test(iss), 'Installer schreibt die gewählte Sprache (de/en) nach resources\\app\\install-lang');
      assert(/installLang: initial\.installLang/.test(pre), 'preload reicht installLang an die Seite');
    }
    assert(/path\.join\(__dirname, 'install-lang'\)/.test(main) && /fs\.unlinkSync\(f\)/.test(main) && /installLang: installLang/.test(main) && /if \('lang' in patch\) installLang = ''/.test(main), 'main.js: liest + löscht install-lang, gibt sie einmal weiter, vergisst sie nach der ersten Meldung der Seite');
    // alte Daten mit Deutsch, Installer sagt Englisch → Englisch
    let sent = [];
    const host = (il) => ({ installLang: il, setSettings: p => { sent.push(p); return Promise.resolve(); }, getSettings: () => Promise.resolve({}) });
    let w = makeWindow({ 'eve-zentrale-lang-v1': 'de', 'eve-zentrale-hauling-v1': '{}' }, host('en')); await tick(500);
    assert(w.localStorage.getItem('eve-zentrale-lang-v1') === 'en' && w.document.documentElement.lang === 'en', 'Installer Englisch: Programm startet Englisch, obwohl alte Daten Deutsch hatten');
    assert(sent.some(p => p.lang === 'en'), 'Seite meldet en ans Programm (Tray/Menüs)');
    w.close();
    // Installer Deutsch bei Windows Englisch → Deutsch
    w = makeWindow({}, host('de')); await tick(500);
    assert(w.localStorage.getItem('eve-zentrale-lang-v1') === 'de', 'Installer Deutsch: Programm startet Deutsch');
    w.close();
    // nächster Start ohne Installer-Wahl: eigene Wahl in EVE Omni bleibt
    w = makeWindow({ 'eve-zentrale-lang-v1': 'de' }, host('')); await tick(500);
    assert(w.localStorage.getItem('eve-zentrale-lang-v1') === 'de', 'ohne Installer-Wahl bleibt die Sprache aus EVE Omni');
    w.close();
    // Einzelfenster übernehmen die Installer-Sprache nicht selbst (nur das Hauptfenster)
    w = makeWindow({ 'eve-zentrale-lang-v1': 'de' }, host('en'), '?fenster=dscan'); await tick(500);
    assert(w.localStorage.getItem('eve-zentrale-lang-v1') === 'de', 'Einzelfenster überschreibt die Sprache nicht');
    w.close();
    console.log('\nALL PU1 TESTS PASSED');
  }catch(e){ console.log(e.message); console.log('PU1 TESTS FAILED'); process.exit(1); }
})();
