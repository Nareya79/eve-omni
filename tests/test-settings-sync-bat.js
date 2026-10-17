// Sync-Tab: UI-Verhalten im Browser (jsdom) + erzeugt echte .bat-Dateien fuer den Wine-Lauf (run-bat-tests.sh).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'96643448', character_name:'Taron Velkar' },
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'2112569214', character_name:'Akiria Velkar' },
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'95003647', character_name:"Nareya O'Velkar" }
];

const dom = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(window){
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '96643448');
    window.URL.createObjectURL = () => 'blob:x'; window.URL.revokeObjectURL = () => {};
  }
});
const { window } = dom;
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }

setTimeout(() => {
  try{
    const doc = window.document, T = window.__test;
    assert(T.buildSettingsSyncBat, 'buildSettingsSyncBat erreichbar');
    doc.getElementById('neo-btn-settings').onclick(); doc.querySelector('#panel-settings [data-set="data"]').onclick();   // UU8: Sync steht unter Daten
    assert(!doc.getElementById('neo-btn-settingssync') && !doc.getElementById('set-pane-data').hidden && doc.getElementById('set-pane-data').contains(doc.getElementById('wsync-source')) && doc.getElementById('panel-settings').classList.contains('active'), 'I7/P5: Sync steht unter Einstellungen › EVE-Clients, kein eigener OmniCom-Knopf');

    const src = doc.getElementById('wsync-source'), mode = doc.getElementById('wsync-mode');
    assert(src.options.length === 3 && src.options[0].textContent === 'Akiria Velkar', 'Quellen alphabetisch aus eingeloggten Charakteren');
    src.value = '96643448'; src.onchange();
    assert(doc.getElementById('wsync-target-wrap').hidden, 'Im Modus "Alle" ist die Zielauswahl ausgeblendet');
    assert(!doc.getElementById('wsync-download').disabled, 'Download im Modus "Alle" sofort moeglich');
    const prev = doc.getElementById('wsync-preview').textContent;
    assert(prev.indexOf('set "SRC=96643448"') !== -1 && prev.indexOf('set "MODE=ALL"') !== -1, 'Vorschau zeigt Quelle und Modus');
    assert(!/[^\x00-\x7F]/.test(prev), 'Batchdatei ist reines ASCII');

    mode.value = 'LIST'; mode.onchange();
    const cbs = doc.querySelectorAll('.wsync-target-cb');
    assert(cbs.length === 2 && !Array.from(cbs).some(c => c.value === '96643448'), 'Quelle erscheint nicht als Ziel');
    cbs.forEach(c => c.checked = false);
    doc.getElementById('wsync-target-list').dispatchEvent(new window.Event('change'));
    assert(doc.getElementById('wsync-download').disabled, 'Ohne Ziel im Listenmodus kein Download');
    cbs[0].checked = true; doc.getElementById('wsync-target-list').dispatchEvent(new window.Event('change'));
    assert(!doc.getElementById('wsync-download').disabled, 'Mit einem Ziel Download wieder moeglich');

    let threw = false; try{ T.buildSettingsSyncBat({sourceId:'12 & del', mode:'ALL'}); }catch(e){ threw = true; }
    assert(threw, 'Nicht-numerische Quell-ID wird abgelehnt (keine Befehlsinjektion)');
    const inj = T.buildSettingsSyncBat({sourceId:'1', sourceName:'Evil & del C:\\ "x" %PATH% !a!', mode:'LIST', targetIds:['2','3 & x','1']});
    assert(inj.indexOf('&') === inj.indexOf('& pause') || inj.indexOf('Evil &') === -1, 'Sonderzeichen aus dem Namen entfernt');
    assert(inj.indexOf('set "TARGETS=2"') !== -1, 'Ungueltige und Quell-IDs aus den Zielen gefiltert');
    assert(inj.split('\r\n').length > 50 && inj.indexOf('\n') === inj.indexOf('\r\n') + 1, 'CRLF-Zeilenenden');

    fs.writeFileSync('/tmp/wsync_all.bat', T.buildSettingsSyncBat({sourceId:'96643448', sourceName:'Taron Velkar', mode:'ALL', createdAt:'test'}));
    fs.writeFileSync('/tmp/wsync_list.bat', T.buildSettingsSyncBat({sourceId:'96643448', sourceName:'Taron Velkar', mode:'LIST', targetIds:['95003647','777'], createdAt:'test'}));
    console.log('\nALL SETTINGS-SYNC UI TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
}, 500);
