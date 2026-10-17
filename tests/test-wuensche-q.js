// Abschnitt Q (Wuensche vom 25.09.2026, 10. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CH = [{ character_id: 111, character_name: 'Eins', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 },
            { character_id: 222, character_name: 'Zwei', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 }];
const iso = t => new Date(t).toISOString();
const TX = { 111: [{ transaction_id: 1, date: iso(Date.now() - 86400e3), type_id: 34, quantity: 1000, unit_price: 5, is_buy: true },
                   { transaction_id: 2, date: iso(Date.now() - 3600e3), type_id: 34, quantity: 1000, unit_price: 8, is_buy: false },
                   { transaction_id: 3, date: iso(Date.now() - 7200e3), type_id: 35, quantity: 100, unit_price: 20, is_buy: false }],
             222: [{ transaction_id: 4, date: iso(Date.now() - 3600e3), type_id: 36, quantity: 10, unit_price: 1000, is_buy: true }] };
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: Date.now() - 3600e3, status: 'active' },
            { id: 't2', tid: 35, name: 'Pyerite', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: Date.now() - 1800e3, status: 'active' }];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    const RES = d => Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(d) });
    w.fetch = (url) => { const u = String(url); let m;
      if ((m = u.match(/characters\/(\d+)\/wallet\/transactions\//))) return RES(TX[m[1]] || []);
      if (/wallet\/journal\//.test(u)) return RES([]);
      if ((m = u.match(/characters\/(\d+)\/wallet\//))) return RES(1000000);
      return Promise.reject(new Error('offline')); };
    w.localStorage.setItem('eve-zentrale-ovwallet-v1', JSON.stringify({ t: Date.now(), list: [{ id: '111', name: 'Eins', bal: 1e6, sell: null, escrow: null, d24: null }, { id: '222', name: 'Zwei', bal: 5e5, sell: null, escrow: null, d24: null }] }));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH));
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR)); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, T = w.__test;
    // S8/S9: Klick auf einen verfolgten Trade klappt die Details (wie Trades-Overlay) auf, Rechtsklick oeffnet EVECore
    let tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    const cards = tb.querySelectorAll('.trk-sm[data-ova="trkDet"][data-ovrc="trkPage"]');
    assert(cards.length === 2, 'S8: aktive Trades in „Verfolgt“ klein und anklickbar');
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(/\.ov-card\.blk\{[^}]*infinite/.test(css) && [...cards].every(c => /\bst-(buy|way|sell|done|bad)\b/.test(c.className)) && [...cards].every(c => c.classList.contains('blk') === /\b(trk-ob|st-bad)\b/.test(c.className)), 'U12/Z4: zugeklappt immer Statusrahmen, Standard blinkt nur überboten / Problem');
    assert(/#ov-body img\{-webkit-user-drag:none\}/.test(css) && cards[0].querySelector('img'), 'V2: Bilder in der Karte nicht ziehbar (Klick klappt auf)');
    T.ovSatAction('track', { type: 'trkDet', arg: 't1' }); await tick(50);
    tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.trk-sm').length === 1 && /Mindestpreis|Kauf:|Verkauf:|Gewinn/.test(tb.textContent), 'S8: Details des angeklickten Trades aufgeklappt');
    T.ovSatAction('track', { type: 'trkDet', arg: 't2' }); await tick(50);   // T15: zweite Karte dazu
    tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.trk-sm').length === 0, 'T15: zwei Karten gleichzeitig aufgeklappt');
    T.ovSatAction('track', { type: 'trkDet', arg: 't2' });
    T.ovSatAction('track', { type: 'trkDet', arg: 't1' });
    assert(!T.ovLoad().trkDet, 'S8: zweiter Klick klappt wieder zu');
    T.ovSatAction('track', { type: 'trkPage', arg: 't1' }); await tick(50);
    assert(d.getElementById('tsc-view-trades').getAttribute('aria-selected') === 'true', 'S9: Rechtsklick öffnet „Meine Trades“');
    // Q11: Overlay-Wallet - Klick auf einen Charakter klappt Kurve + Kreisdiagramm auf
    let wb = d.createElement('div'); T.ovRenderViewInto('wallet', wb);
    assert(wb.querySelectorAll('.ow-c[data-ova="owSel"]').length === 2 && !wb.querySelector('.ow-d'), 'Q11: Charakterkarten anklickbar, Details zu');
    // R7: Einheit hinter Zahlen im Overlay hellblau (eigener Span), Text bleibt gleich
    assert([...wb.querySelectorAll('.ov-u')].some(u => u.textContent === 'Mio.') && /1(,0+)?\s?Mio\./.test(wb.textContent), 'R7: „Mio.“ im Overlay als hellblaue Einheit');
    const hb = d.createElement('div'); T.ovRenderViewInto('handel', hb);
    assert(!hb.querySelector('.ov-u .ov-u'), 'R7: Handel (verschachtelt) wird nicht doppelt eingefärbt');
    T.ovSatAction('wallet', { type: 'owSel', arg: '111' }); await tick(150);
    wb = d.createElement('div'); T.ovRenderViewInto('wallet', wb);
    const det = wb.querySelector('.ow-d');
    assert(det && det.querySelectorAll('.ow-curve polyline').length === 3, 'Q11: Kurve mit Verkäufe/Käufe/Gewinn');
    assert(det.querySelectorAll('.ow-pie circle').length === 2 && /Gewinn/.test(det.textContent) && /\+/.test(det.textContent), 'Q11: Kreisdiagramm je Ware + Gewinn');
    T.ovSatAction('wallet', { type: 'owSel', arg: '111' }); wb = d.createElement('div'); T.ovRenderViewInto('wallet', wb);
    assert(!wb.querySelector('.ow-d'), 'Q11: zweiter Klick klappt wieder zu');
    // Q11: grosse Ansicht - Charakter-Auswahl filtert Kennzahlen, Transaktionen
    d.getElementById('wv-refresh').click(); await tick(400);
    const sel = d.getElementById('wv-char');
    assert(sel.options.length === 3, 'Q11: Auswahl „Alle“ + 2 Charaktere');
    sel.value = '222'; sel.onchange(); await tick(50);
    assert((d.getElementById('wv-view-list').click(), d.querySelectorAll('#wtx-page .wtx').length === 1), 'Q11: nur Zwei gefiltert (Transaktionen)');
    // R4: Gewinn folgt den echten Preisen (eigene Verkaufsorder / Kauforder), ohne echte Daten bleibt der Plan
    const fees = T.tscFees(T.tscReadCfg()), t1 = TR[0];
    assert(T.trEvaluate(t1, null, fees).unit === 0.5, 'R4: ohne echte Daten bleibt der geplante Gewinn');
    const ev4 = T.trEvaluate(t1, { own: { buy: { order_id: 1, price: 4, volume_total: 100, volume_remain: 100 }, sell: { order_id: 2, price: 7 } } }, fees);
    assert(Math.abs(ev4.unit - T.tscUnitProfit(4, 7, fees, 0)) < 1e-9 && ev4.unit > 0.5, 'R4: neuer Kauf-/Verkaufspreis ändert Gewinn netto/gesamt');
    console.log('\nALL WUENSCHE-Q TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
