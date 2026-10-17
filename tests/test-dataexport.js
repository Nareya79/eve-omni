// Daten sichern & uebertragen: Export (mit/ohne Logins, ohne Zwischenspeicher), Pruefung beim Import, Uebernahme.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'GEHEIM', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];

function makeWindow(extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = () => Promise.reject(new Error('offline'));
      w.__downloads = [];
      w.URL.createObjectURL = b => { w.__lastBlob = b; return 'blob:x'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function(){ w.__downloads.push({ name: this.download, blob: w.__lastBlob }); };
    }
  }).window;
}

(async () => {
  try{
    const base = {
      'eve-zentrale-characters': JSON.stringify(CHARS), 'eve-zentrale-active-char':'111',
      'eve-zentrale-trades-v1': JSON.stringify([{ id:'t1', tid:34, name:'Tritanium', status:'active' }, { id:'t2', tid:35, name:'Pyerite', status:'done' }]),
      'eve-zentrale-pnl-v1-111': JSON.stringify({ tx:{ 1:[1,34,10,4,true,60003760] }, jr:{} }),
      'eve-st-watch': JSON.stringify([34]), 'eve-wallet-lastseen-111': '12345',
      'eve-zentrale-tsc-hist-v1': JSON.stringify({ big:'cache' }), 'eve-zentrale-systemnames-v1': JSON.stringify({ names:['Jita'] }),
      'fremder-schluessel': 'bleibt draussen'
    };
    let w = makeWindow(base); await tick(500);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;

    let o = T.dxBuild(false);
    assert(o.format === 'evecore-daten' && o.version === 1 && !o.includesLogins, 'Exportformat mit Kennung');
    assert(o.data['eve-zentrale-trades-v1'] && o.data['eve-zentrale-pnl-v1-111'] && o.data['eve-st-watch'] && o.data['eve-wallet-lastseen-111'] === '12345', 'Trades, Gewinn-Historie, Watchlist, Wallet-Stand dabei');
    assert(!o.data['eve-zentrale-characters'], 'Ohne Haken keine Logins');
    assert(!o.data['eve-zentrale-tsc-hist-v1'] && !o.data['eve-zentrale-systemnames-v1'], 'Zwischenspeicher nicht exportiert');
    assert(!o.data['fremder-schluessel'], 'Fremde Schluessel nicht exportiert');
    o = T.dxBuild(true);
    assert(o.includesLogins && /GEHEIM/.test(o.data['eve-zentrale-characters']), 'Mit Haken sind die Logins dabei');

    // Export-Knopf
    $('dx-logins').checked = true; $('dx-logins').onchange();
    assert(!$('dx-logins-warn').hidden, 'Warnung bei Export mit Logins');
    $('dx-export').onclick();
    assert(w.__downloads.length === 1 && /^EVE-Omni-Daten-\d{4}-\d\d-\d\d-mit-Logins\.json$/.test(w.__downloads[0].name), 'Datei heruntergeladen: ' + w.__downloads[0].name);
    const txt = await w.__downloads[0].blob.text();
    assert(JSON.parse(txt).data['eve-zentrale-trades-v1'], 'Dateiinhalt ist der Export');
    const noLogin = JSON.stringify(T.dxBuild(false));
    w.close();

    // --- Import in ein "neues" Programm (leer, anderer Login) ---
    w = makeWindow({ 'eve-zentrale-characters': JSON.stringify([{ access_token:'n', refresh_token:'neu', expires_at:Date.now()+3600000, character_id:'222', character_name:'Selia' }]) });
    await tick(500);
    d = w.document; $ = id => d.getElementById(id); T = w.__test;
    let bad = null; try{ T.dxParse('{"foo":1}'); }catch(e){ bad = e.message; }
    assert(/keine EVE-Omni-Datendatei/.test(bad), 'Fremde Datei wird abgelehnt');
    bad = null; try{ T.dxParse('kein json'); }catch(e){ bad = e.message; }
    assert(/kein JSON/.test(bad), 'Kaputte Datei wird abgelehnt');
    const evil = JSON.parse(noLogin); evil.data['boeser-schluessel'] = 'x'; evil.data['eve-zentrale-zahl'] = 5;
    const p = T.dxParse(JSON.stringify(evil));
    assert(p.keys.indexOf('boeser-schluessel') < 0 && p.keys.indexOf('eve-zentrale-zahl') < 0, 'Nur EVECore-Schluessel mit Text-Werten werden uebernommen');
    const sum = T.dxSummary(p).join(', ');
    assert(/2 Trades/.test(sum) && /Gewinn-Historie von 1 Charakter/.test(sum) && /Preis-Merkliste/.test(sum), 'Vorschau fasst Inhalt zusammen: ' + sum);

    // UI-Ablauf mit Datei-Auswahl
    const file = new w.File([noLogin], 'EVECore-Daten.json', { type:'application/json' });
    Object.defineProperty($('dx-file'), 'files', { value: [file] });
    $('dx-file').onchange(); await tick(200);
    assert(/Ohne Logins/.test($('dx-preview').textContent) && !$('dx-import').hidden, 'Vorschau + Uebernehmen-Knopf');
    let reloaded = false;
    try{ Object.defineProperty(w, 'location', { value: { reload(){ reloaded = true; } } }); }catch(e){}
    const n = T.dxApply(p);
    assert(n === p.keys.length && JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).length === 2, 'Daten uebernommen');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-characters'))[0].character_name === 'Selia', 'Vorhandener Login bleibt bei Import ohne Logins');

    console.log('\nALL DATA-EXPORT TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
