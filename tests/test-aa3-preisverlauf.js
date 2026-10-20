// AA3 (27.09.2026): Preisverlauf je Ware – Kurven-Knopf neben Warennamen, SVG mit Ø, Hoch/Tief-Band, Umsatz, 30/90/365 Tage, eigene Käufe/Verkäufe, Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), day = i => new Date(now - i * 864e5).toISOString().slice(0, 10);
const HIST = []; for (let i = 399; i >= 1; i--) HIST.push({ date: day(i), average: 5 + Math.sin(i / 9), highest: 7, lowest: 4, volume: 1000 + i, order_count: 50 });
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active' }];
const urls = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.fetch = u => { urls.push(String(u)); return /\/history\//.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(HIST) }) : Promise.reject(new Error('offline')); };
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }])); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const table = () => { const t = d.createElement('table'); t.id = 'x-tab'; const tr = t.insertRow(), td = tr.insertCell(); td.appendChild(T.mkBtn(34)); tr.insertCell().textContent = 'x'; d.body.appendChild(t); return t; };
    let tab = table();
    const btn = tab.querySelector('.hc-btn');
    assert(btn && btn.previousElementSibling.matches('[data-mk]'), 'Kurven-Knopf direkt neben dem Markt-Knopf');
    btn.click(); await tick(150);
    assert(urls.some(u => /markets\/10000002\/history\/.*type_id=34/.test(u)), 'Verlauf aus ESI geladen (Jita)');
    let box = tab.querySelector('tr.hc-box');
    assert(box && box.previousElementSibling === tab.rows[0] && box.querySelector('svg .hc-band') && box.querySelector('svg .hc-avg'), 'Diagramm unter der Zeile: Hoch/Tief-Band + Ø-Linie');
    assert(box.querySelectorAll('.hc-vol').length === 89 || box.querySelectorAll('.hc-vol').length === 90, 'Standard 90 Tage: ein Umsatz-Balken je Tag');
    // eigene Käufe/Verkäufe als Punkte
    T.hcTxSet([{ transaction_id: 1, type_id: 34, date: new Date(now - 5 * 864e5).toISOString(), unit_price: 4.8, quantity: 500, is_buy: true },
      { transaction_id: 2, type_id: 34, date: new Date(now - 2 * 864e5).toISOString(), unit_price: 5.9, quantity: 200, is_buy: false },
      { transaction_id: 3, type_id: 35, date: new Date(now - 2 * 864e5).toISOString(), unit_price: 9, quantity: 1, is_buy: false }]);
    box.querySelector('.hc-d[data-arg="30"]').click(); await tick();
    box = tab.querySelector('tr.hc-box');
    assert(box.querySelectorAll('.hc-vol').length <= 30 && box.querySelectorAll('.hc-vol').length >= 29, '30 Tage umgeschaltet');
    assert(box.querySelectorAll('circle.hc-buy').length === 1 && box.querySelectorAll('circle.hc-sell').length === 1, 'eigene Käufe/Verkäufe dieser Ware als Punkte');
    box.querySelector('.hc-d[data-arg="365"]').click(); await tick();
    assert(tab.querySelectorAll('tr.hc-box .hc-vol').length >= 364, '365 Tage');
    // neu gezeichnet: Diagramm hängt wieder dran
    tab.remove(); tab = table(); await tick();
    assert(tab.querySelector('tr.hc-box svg'), 'nach Neuzeichnen der Liste wieder aufgeklappt');
    // Overlays: Trades + Watchlist (AN1 20.10.: per CSS #ov-root ausgeblendet, nur Hauptfenster zeigt ihn)
    assert(/#ov-root :is\(\.hc-btn, \.hc-box\)\{display:none !important\}/.test(html), 'AN1: Preisverlauf in Overlays ausgeblendet');
    const view = id => { const b = d.createElement('div'); T.ovRenderViewInto(id, b); return b; };
    const tv = view('trades');
    assert(tv.querySelector('.ov-card .hc-btn.on') && tv.querySelector('.ov-card .hc-box svg'), 'Trades-Overlay: Diagramm klappt in der Karte auf');
    assert(view('track').querySelector('.trk-trade .hc-btn'), 'Watchlist-Overlay: Kurven-Knopf im Aufbau (gleicher Code)');
    T.trRender(); await tick();
    assert(d.querySelector('#trades-list .tr-card .hc-btn'), 'Meine Trades: Kurven-Knopf');
    // Overlay-Fenster schickt die Aktion ans Programm
    T.ovAction({ type: 'hcHub', arg: 'amarr' }); await tick(150);
    assert(urls.some(u => /markets\/10000043\/history\//.test(u)), 'Handelsplatz umschaltbar (Amarr)');
    // zu
    tab.querySelector('.hc-btn').click(); await tick();
    assert(!tab.querySelector('tr.hc-box') && !view('trades').querySelector('.hc-box'), 'zweiter Klick klappt wieder zu');
    assert(!Object.keys(w.localStorage).some(k => /"average"/.test(w.localStorage.getItem(k))), 'Verlauf nicht gespeichert (nicht im Export)');
    console.log('\nALL AA3 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
