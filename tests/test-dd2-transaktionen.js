// DD2 (02.10.2026): Wallet › Transaktionen wie in EVE – Icon, Kunde, Ort, Filter Kauf/Verkauf, Suche, Summe (Overlay-Reiter + Hauptfenster)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), DAY = 864e5;
const CHARS = [
  { access_token: 'a', refresh_token: 'r', expires_at: NOW + 3600000, character_id: '111', character_name: 'Taron Velkar' },
  { access_token: 'b', refresh_token: 'r', expires_at: NOW + 3600000, character_id: '222', character_name: 'Alt Char' }
];
const pnl = id => ({ tx: id === 111 ? {
    1: [NOW - 2 * DAY, 34, 1000, 5, 1, 60003760, 90000001], 2: [NOW - 1 * DAY, 34, 1000, 7, 0, 60003760, 90000002],
    3: [NOW - 40 * DAY, 35, 10, 100, 0, 60003760, 0] } : { 4: [NOW - 3 * DAY, 36, 2, 1000, 0, 1035466617946, 98000001] }, fee: {}, ord: {}, upd: NOW });
const NAMES = { 34: 'Tritanium', 35: 'Pyerite', 36: 'Mexallon', 60003760: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', 90000001: 'Verkäufer Eins', 90000002: 'Käuferin Zwei', 98000001: 'Corp Drei' };
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(pnl(111)));
    w.localStorage.setItem('eve-zentrale-pnl-v1-222', JSON.stringify(pnl(222)));
    w.fetch = (u, o) => /universe\/names/.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(o.body).filter(i => NAMES[i]).map(i => ({ id: i, name: NAMES[i] }))) })
      : /universe\/structures/.test(u) ? Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ name: 'Perimeter - Tranquility Trading Tower', solar_system_id: 30000144 }) })
      : Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const view = () => { const b = d.createElement('div'); T.ovRenderViewInto('wallet', b); return b; };
    T.ovSatAction('wallet', { type: 'owTab', arg: 't' }); await tick(400);
    view(); await tick(400);   // Namen kommen im Hintergrund
    let b = view();
    assert([...b.querySelectorAll('.ow-tabs button')].some(x => x.textContent === 'Transaktionen' && x.getAttribute('aria-pressed') === 'true'), 'DD2: Reiter „Transaktionen“ im Wallet-Overlay');
    let rows = b.querySelectorAll('.wtx');
    assert(rows.length === 3, 'DD2: Woche = 3 Transaktionen beider Charaktere (40 Tage alte nicht)');
    assert(rows[0].querySelector('img.wtx-i').src.includes('/types/34/icon'), 'DD2: Ware mit Icon');
    assert(/Tritanium/.test(rows[0].textContent) && /Käuferin Zwei/.test(rows[0].textContent) && /Jita IV/.test(rows[0].textContent), 'DD2: Ware, Kunde und Ort aufgelöst');
    assert(/Tranquility Trading Tower/.test(b.textContent) && /Corp Drei/.test(b.textContent), 'DD2: Struktur und Corp als Kunde');
    assert(rows[0].querySelector('b.ok') && /\+7\.000/.test(rows[0].textContent) && rows[1].querySelector('b.bad'), 'DD2: Verkauf grün +, Kauf rot −');
    assert(/Verkauf \(2\)/.test(b.querySelector('.wtx-sum').textContent) && /Kauf \(1\)/.test(b.querySelector('.wtx-sum').textContent), 'DD2: Summe mit Anzahl');
    T.ovSatAction('wallet', { type: 'wtxDir', arg: 'b' }); b = view();
    assert(b.querySelectorAll('.wtx').length === 1 && /Verkäufer Eins/.test(b.textContent), 'DD2: Filter Kauf');
    T.ovSatAction('wallet', { type: 'wtxDir', arg: '' }); T.ovSatAction('wallet', { type: 'wtxFind', form: { tq: 'mexal' } }); b = view();
    assert(b.querySelectorAll('.wtx').length === 1 && /Alt Char/.test(b.textContent), 'DD2: Suche nach Ware');
    T.ovSatAction('wallet', { type: 'wtxFind', form: { tq: '' } }); T.ovSatAction('wallet', { type: 'wtxDays', arg: 0 }); b = view();
    assert(b.querySelectorAll('.wtx').length === 4, 'DD2: „Alle“ zeigt auch ältere Transaktionen');
    // Hauptfenster › Wallet › Transaktionen: gleiche Ansicht, Charakter-Auswahl oben filtert
    d.getElementById('wv-view-list').click(); await tick(50);
    assert(d.querySelectorAll('#wtx-page .wtx').length === 3, 'DD2: Hauptfenster zeigt die Transaktionen (Zeitraum oben: 14 Tage)');
    console.log('\nALL DD2 TESTS PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
