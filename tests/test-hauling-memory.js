// A3: Hauling merkt sich die letzte Auswahl (eve-zentrale-hauling-v1).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k])); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
}
const KEY = 'eve-zentrale-hauling-v1';
(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let $ = id => w.document.getElementById(id);
    assert($('hl-hub').value === 'jita' && $('hl-cargo').value === '5.000', 'ohne Speicher: Standardwerte');
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
    set('hl-hub', ''); set('hl-start', 'Hek'); set('hl-radius', '7'); set('hl-cargo', '435.000'); set('hl-budget', '2.500.000.000'); set('hl-depth', '300');
    $('hl-max-ship').value = 'Charon (Caldari)'; $('panel-haul').dispatchEvent(new w.Event('change'));
    const saved = JSON.parse(w.localStorage.getItem(KEY));
    assert(saved['hl-max-ship'] === 'Charon (Caldari)' && saved['hl-budget'] === '2.500.000.000' && saved['hl-hub'] === '', 'Auswahl gespeichert');
    assert(!('hl-tax' in saved), 'Verkaufssteuer nicht gespeichert (kommt aus Skills)');
    w.close();

    w = makeWindow({ [KEY]: JSON.stringify(saved) }); await tick(500);
    $ = id => w.document.getElementById(id);
    assert($('hl-hub').value === '' && $('hl-start').value === 'Hek' && !$('hl-start').disabled, 'Neustart: eigenes System Hek, Feld frei');
    assert($('hl-radius').value === '7' && $('hl-depth').value === '300', 'Neustart: Jumps und Suchtiefe');
    assert($('hl-cargo').value === '435.000' && $('hl-budget').value === '2.500.000.000', 'Neustart: Laderaum und Budget');
    assert($('hl-max-ship').value === 'Charon (Caldari)', 'Neustart: Maximalschiff Charon');
    w.close();

    w = makeWindow({ [KEY]: JSON.stringify({ 'hl-hub': 'gibtsnicht', 'hl-max-ship': 'Titanic', 'hl-cargo': 5 }) }); await tick(500);
    $ = id => w.document.getElementById(id);
    assert($('hl-hub').value === 'jita' && $('hl-max-ship').value === '' && $('hl-cargo').value === '5.000', 'kaputte Werte werden ignoriert');
    w.close();
    w = makeWindow({ [KEY]: '{kaputt' }); await tick(500);
    assert(w.document.getElementById('hl-hub').value === 'jita', 'kaputter Speicher: Standardwerte');
    w.close();
    console.log('\nALL HAULING-MEMORY TESTS PASSED');
  }catch(e){ console.log(e.message); console.log('HAULING-MEMORY TESTS FAILED'); process.exit(1); }
})();
