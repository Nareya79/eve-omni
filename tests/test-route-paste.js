// Exakte Route aus DOTLAN per Zwischenablage (Strg+A, Strg+C im DOTLAN-Fenster) - Texte 1:1 aus dem echten DOTLAN kopiert.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const JUMP_TEXT = "Navigation Tools\nJump Planner\tRoute Planner\n#\tRegion\tSolarSystem\tSec\tHolder\tKills\tJumps\n" +
  "1.\tHeimatar\t Amamake\t0.4\tMinmatar Republic\t28\t721\n \tJump to\tDistance: 9.23 ly (13 jumps)\t\nFuel needed: 31,234 Oxygen Isotopes\n" +
  "2.\tDomain\t  Sahda\t0.4\tAmarr Empire\t0\t112\n \tJump to\tDistance: 9.407 ly (12 jumps)\t\nFuel needed: 31,834 Oxygen Isotopes\n" +
  "3.\tKor-Azor\t  Enal\t0.4\tAmarr Empire\t0\t10\n \tJump to\tDistance: 9.883 ly (13 jumps)\t\nFuel needed: 33,445 Oxygen Isotopes\n" +
  "4.\tKhanid\t Amafi\t0.3\tKhanid Kingdom\t0\t116\n \tJump to\tDistance: 9.885 ly (15 jumps)\t\nFuel needed: 33,452 Oxygen Isotopes\n" +
  "5.\tDelve\t  KFIE-Z\t0.00\tBlood Raider Covenant\t0\t15\n \tJump to\tDistance: 6.978 ly (9 jumps)\t\nFuel needed: 23,612 Oxygen Isotopes\n" +
  "6.\t \t 1DQ1-A\t-0.39\tThe Initiative.\t0\t39\nKills/Jumps in the last 3 hours\nTotal travel distance:\t45.384 lightyears\n" +
  "Total fuel consumption:\t153,577 Oxygen Isotopes (4,608 m³)\nMax Jump Range:\t10 lightyears (Ship: Anshar and JumpDriveCalibration: Level 5)\n" +
  "Most violent systems (3 hours)\nShips / Pods0.0 System\n\t75FA-Z (Fountain)\t18 / 17\n\tTama (The Citadel)\t28 / 41\n";
const GATE_TEXT = "\n1.\tThe Forge\tJita\t0.9\tCaldari State\t347\t3173\n2.\t \tPerimeter\t0.9\tCaldari State\t17\t2591\n3.\t \tUrlen\t0.9\tCaldari State\t0\t1841\n" +
  "4.\tThe Citadel\tKusomonmon\t0.8\tCaldari State\t0\t624\n5.\t \tUedama\t0.5\tCaldari State\t8\t1444\n6.\t \tAmarr\t0.9\tAmarr Empire\t0\t1459\n" +
  "Kills/Jumps in the last 3 hours\nRoute Planner\nWaypoints\nThe Forge (0.9)Jita\n";
const NAMES = ['Amamake','Sahda','Enal','Amafi','KFIE-Z','1DQ1-A','Tama','75FA-Z','Jita','Perimeter','Urlen','Kusomonmon','Uedama','Amarr','Old Man Star','Heimatar'];
// (Heimatar ist eine Region, kein System - steht absichtlich NICHT in der Namensliste ausser hier zum Pruefen unten)
const SYS = NAMES.filter(n => n !== 'Heimatar');

const dom = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-systemnames-v1', JSON.stringify({ ts: Date.now(), names: SYS.concat(Array.from({length:1200}, (_, i) => 'Sys' + i)) }));
    w.fetch = () => Promise.reject(new Error('offline'));
    w.open = () => null;
  }
});
const w = dom.window;
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 60));
function paste(el, text){
  const ev = new w.Event('paste', {bubbles:true, cancelable:true});
  ev.clipboardData = { getData: () => text };
  el.dispatchEvent(ev);
}

setTimeout(async () => {
  try{
    const d = w.document, T = w.__test, $ = id => d.getElementById(id);
    await T.loadSystemNames();
    // --- Parser ---
    const r = T.parseDotlanRoute(JUMP_TEXT);
    assert(r && r.hops.map(h => h.name).join(',') === 'Amamake,Sahda,Enal,Amafi,KFIE-Z,1DQ1-A', 'Jump: alle 6 Stationen in Reihenfolge, Seitenleiste ignoriert');
    assert(r.hops[0].ly === 9.23 && r.hops[0].fuel === 31234 && r.hops[5].ly === null, 'Distanz und Treibstoff je Sprung');
    assert(r.totalLy === 45.384 && r.totalFuel === 153577, 'Summen: 45,384 LJ und 153.577 Isotope');
    assert(r.hops[5].sec === -0.39 && r.hops[0].sec === 0.4, 'Sicherheitsstatus je System');
    const g = T.parseDotlanRoute(GATE_TEXT);
    assert(g && g.hops.length === 6 && g.hops[4].name === 'Uedama' && g.totalLy === null, 'Routenplaner-Text genauso auswertbar');
    assert(T.parseDotlanRoute(JUMP_TEXT + JUMP_TEXT).hops.length === 6, 'Zweimal eingefuegt: nur die erste Liste');
    assert(T.parseDotlanRoute('irgendwas\nohne Route') === null && T.parseDotlanRoute('') === null, 'Kein Route-Text: nichts');

    // --- Jump Planner: Einfuegen ---
    $('neo-btn-jump').onclick(); await tick(150);
    $('nav-sub-jump').onclick(); await tick(100);
    $('jp-ship').value = 'Anshar'; $('jp-jdc').value = '5'; $('jp-jfc').value = '4'; $('jp-jf').value = '4';
    $('jp-from').value = 'Amamake'; $('jp-via').value = ''; $('jp-to').value = '1DQ1-A';
    $('jp-go').onclick();
    let row = d.querySelector('#jp-history-body tr');
    assert(row.querySelector('.jp-route').textContent === 'Amamake → 1DQ1-A' && /noch nicht/.test(row.textContent), 'Vor dem Einfuegen: nur eingegebene Wegpunkte');
    paste($('jp-paste'), JUMP_TEXT); await tick(100);
    row = d.querySelector('#jp-history-body tr');
    assert(row.querySelector('.jp-route').textContent === 'Amamake → Sahda → Enal → Amafi → KFIE-Z → 1DQ1-A', 'Nach dem Einfuegen: exakte Sprungfolge in Blau');
    assert(/exakte Sprungfolge · 5 Sprünge · 45,4 LJ · 153\.577 Isotope/.test(row.textContent), 'Sprünge, Lichtjahre, Treibstoff');
    assert(d.querySelectorAll('#jp-history-body tr').length === 1, 'Kein zusaetzlicher Eintrag');
    const pinBtn = Array.from($('jp-paste-msg').querySelectorAll('button')).find(b => /Favorit/.test(b.textContent));
    assert(/Exakte Sprungfolge gespeichert/.test($('jp-paste-msg').textContent) && pinBtn, 'Bestaetigung mit Favoriten-Knopf');
    pinBtn.onclick();
    assert(d.querySelector('#jp-history-body tr').classList.contains('jp-pinned'), 'Als Favorit angeheftet');

    // Route neu berechnen mit gleichen Einstellungen -> Folge bleibt; andere Skills -> Folge verworfen
    $('jp-go').onclick();
    assert(/Sahda/.test(d.querySelector('#jp-history-body tr .jp-route').textContent), 'Erneut berechnet, gleiche Einstellungen: exakte Folge bleibt');
    // Oeffnen laedt die exakte Folge als Wegpunkte
    $('jp-from').value = 'Tama'; $('jp-to').value = 'Jita';
    await d.querySelector('#jp-history-body tr .jp-route').onclick(); await tick();
    assert($('jp-from').value === 'Amamake' && $('jp-to').value === '1DQ1-A' && $('jp-via').value === '', 'Oeffnen: eingegebene Felder zurueck');
    assert($('jp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/jump/Anshar,544/Amamake:Sahda:Enal:Amafi:KFIE-Z:1DQ1-A', 'DOTLAN bekommt die exakte Folge als Wegpunkte');
    $('jp-jdc').value = '4'; $('jp-go').onclick();
    const rows = Array.from(d.querySelectorAll('#jp-history-body tr'));
    assert(rows.length === 1 && /noch nicht/.test(rows[0].textContent), 'Andere Skills: gespeicherte Folge wird verworfen (DOTLAN koennte anders rechnen)');

    // Falsche Route eingefuegt
    $('jp-from').value = 'Tama'; $('jp-to').value = 'Amamake';
    paste($('jp-paste'), JUMP_TEXT); await tick(100);
    assert(/passt nicht zu Start und Ziel/.test($('jp-paste-msg').textContent), 'Unpassende Route wird abgelehnt');
    paste($('jp-paste'), 'nur Text'); await tick(100);
    assert(/keine Sprungfolge gefunden/.test($('jp-paste-msg').textContent), 'Text ohne Route: Hinweis');
    // Fallback: Einfuegen ueber Kontextmenue ohne clipboardData -> input-Ereignis
    $('jp-from').value = 'Amamake'; $('jp-to').value = '1DQ1-A'; $('jp-jdc').value = '5';
    $('jp-paste').value = JUMP_TEXT; $('jp-paste').dispatchEvent(new w.Event('input')); await tick(100);
    assert($('jp-paste').value === '' && /Sahda/.test(d.querySelector('#jp-history-body tr .jp-route').textContent), 'Einfuegen auch ohne Tastenkuerzel');

    // --- Routenplaner ---
    $('nav-sub-route').onclick(); await tick(100);
    $('rp-type').value = '2'; $('rp-from').value = 'Jita'; $('rp-to').value = 'Amarr'; $('rp-avoid').value = '';
    $('rp-go').onclick();
    paste($('rp-paste'), GATE_TEXT); await tick(100);
    const rrow = d.querySelector('#rp-history-body tr');
    assert(rrow.querySelector('.jp-route').textContent === 'Jita → Perimeter → Urlen → Kusomonmon → Uedama → Amarr', 'Routenplaner: exakte Route gespeichert');
    assert(/5 Gate-Sprünge/.test(rrow.textContent), 'Anzahl Gate-Spruenge');
    await rrow.querySelector('.jp-route').onclick();
    assert($('rp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/route/2:Jita:Perimeter:Urlen:Kusomonmon:Uedama:Amarr', 'Oeffnen laedt die exakte Route');

    console.log('\nALL ROUTE-PASTE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
}, 500);
