// HO (12.10.2026): Handel-Overlay – Charakterwechsel lädt Wallet + Hangar neu (HO1), Handelscharakter im Overlay (HO2),
// „Schiffe neu erkennen“ (HO3), „■ Abbrechen“ für laufende Suchen (HO4), Markt-Scan-Ergebnisse im Trades-Overlay mit „＋ Merken“ (HO5)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const now = Date.now(), wallets = { 111: 5e9, 222: 7e8 }, calls = [];
let hold = null;   // HO4: hängende Abfrage, bis abgebrochen wird
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
      { access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' },
      { access_token: 'b', refresh_token: 'r', expires_at: now + 36e5, character_id: '222', character_name: 'Zwei' }]));
    w.localStorage.setItem('eve-zentrale-active-char', '111');
    w.fetch = (u) => { u = String(u); calls.push(u); let m;
      if ((m = /characters\/(\d+)\/wallet/.exec(u))) return json(wallets[m[1]]);
      if (/characters\/\d+\/assets/.test(u)) return json([]);
      if (/markets\/.*\/orders/.test(u) && hold) return new Promise((res, rej) => { hold.push(rej); });
      return Promise.reject(new Error('offline')); };
  } }).window;
(async () => {
  try{
    await tick(1200);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const box = () => { const b = d.createElement('div'); d.body.appendChild(b); return b; };
    // HO1: Wechsel des Handelscharakters lädt Wallet + Hangar des neuen Charakters
    calls.length = 0;
    $('tsc-char').value = '222'; $('tsc-char').onchange(); await tick(300);
    assert(calls.some(u => /characters\/222\/wallet/.test(u)) && calls.some(u => /characters\/222\/assets/.test(u)), 'HO1: Charakterwechsel liest Wallet und Hangar des neuen Charakters');
    const b1 = box(); T.ovRenderViewInto('hubhandel', b1);
    assert(/Wallet 700/.test(b1.textContent.replace(/\s+/g, ' ')), 'HO1/HO2: Overlay zeigt die Wallet des neuen Charakters (' + (b1.querySelector('.ov-tchar') || {}).textContent + ')');
    // HO2: Klappmenü im Overlay, Wechsel per Aktion
    const sel = b1.querySelector('.ov-tchar select');
    assert(sel && sel.options.length === 2 && sel.value === '222' && sel.getAttribute('data-ova-change') === 'tradeChar', 'HO2: Handelscharakter-Auswahl im Hub-Handel-Overlay');
    T.ovSatAction('hubhandel', { type: 'tradeChar', arg: '111' }); await tick(300);
    assert(w.localStorage.getItem('eve-zentrale-active-char') === '111' && $('sso-active-char').value === '111', 'HO2: Auswahl im Overlay setzt den Handelscharakter überall');
    ['hauling', 'trades'].forEach(v => { const b = box(); T.ovRenderViewInto(v, b); assert(b.querySelector('.ov-tchar select'), 'HO2: Auswahl auch im Overlay ' + v); });
    // HO3: Knopf im Overlay und auf der großen Seite
    assert(b1.querySelector('[data-ova="sbReload"]') && $('is-sb-reload') && $('hl-sb-reload'), 'HO3: „Schiffe neu erkennen“ im Overlay und auf beiden Seiten');
    calls.length = 0; T.ovSatAction('hubhandel', { type: 'sbReload' }); await tick(300);
    assert(calls.some(u => /characters\/111\/assets/.test(u)), 'HO3: Knopf liest den Hangar sofort neu (ohne 10-Min.-Speicher)');
    // HO4: Markt-Scan läuft, hängt an der Orderbuch-Abfrage → Abbrechen beendet ihn
    hold = [];
    $('tsc-start').onclick(); await tick(200);
    assert($('tsc-start').disabled && !$('tsc-start-stop').hidden, 'HO4: während der Suche erscheint „■ Abbrechen“');
    const b4 = box(); T.ovRenderViewInto('trades', b4);
    assert(b4.querySelector('[data-ova="srAbort"]'), 'HO4: Abbrechen auch im Overlay');
    T.ovSatAction('trades', { type: 'srAbort' }); hold.forEach(r => r(new Error('Netz'))); hold = null; await tick(400);
    assert(!$('tsc-start').disabled && $('tsc-start-stop').hidden && /Abgebrochen/.test($('tsc-status').textContent), 'HO4: Suche endet, Status „Abgebrochen“ (' + $('tsc-status').textContent + ')');
    calls.length = 0; await T.ovSatAction('trades', { type: 'sbReload' }); await tick(200);
    assert(calls.some(u => /wallet/.test(u)), 'HO4: danach laufen Abfragen wieder normal');
    // HO5: Scan-Ergebnisse im Trades-Overlay
    T.setScanRows([{ tid: 34, name: 'Tritanium', inPlan: true, myBuy: 4, mySell: 5, qty: 1000, capital: 4000, profit: 900, margin: 20, vol7: 100, comp: null },
                   { tid: 35, name: 'Pyerite', inPlan: false, myBuy: 9, mySell: 11, qty: 500, capital: 4500, profit: 800, margin: 18, vol7: 50, comp: null }]);
    let b5 = box(); T.ovRenderViewInto('trades', b5);
    assert(/Markt-Scan:\s*2\s*Vorschläge · ★\s*1\s*im Plan/.test(b5.textContent) && !b5.textContent.includes('Pyerite'), 'HO5: zugeklappte Zeile mit Anzahl');
    T.ovSatAction('trades', { type: 'scanOpen' }); b5 = box(); T.ovRenderViewInto('trades', b5);
    const names = [...b5.querySelectorAll('.ov-card .ov-name')].map(e => e.textContent);
    assert(names.length >= 2 && /★/.test(names[0]) && /Tritanium/.test(names[0]) && /Pyerite/.test(names[1]), 'HO5: aufgeklappt, ★ Plan-Waren zuerst');
    T.ovSatAction('trades', { type: 'scanTrack', arg: '35' }); b5 = box(); T.ovRenderViewInto('trades', b5);
    assert(b5.textContent.includes('✓ Gemerkt') && T.trFind(35, 'jita', '111'), 'HO5: „＋ Merken“ legt den Trade an');
    console.log('\nALL HO TESTS PASSED'); process.exit(0);
  }catch(e){ console.log(e.message); process.exit(1); }
})();
