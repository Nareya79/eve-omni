// AA5 (27.09.2026): Konkurrenz-Check – 1/6/24 Std., eigene Beobachtung, ruhig/mittel/heiß, Grenzen, Abwerten, Symbol an Trades/Watchlist/Overlays
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), ago = min => new Date(now - min * 60000).toISOString();
const o = (buy, price, min) => ({ order_id: Math.random(), is_buy_order: buy, price, issued: ago(min), location_id: 60003760, volume_remain: 5 });
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active' }];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }])); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Zählen in 1/6/24 Std., nur nah am besten Preis
    const book = { buys: [o(true, 100, 30), o(true, 99.5, 200), o(true, 90, 5)], sells: [o(false, 110, 10), o(false, 110.5, 1000), o(false, 200, 1)] };
    let c = T.tscCompetition(book, now);
    assert(c.n1 === 2 && c.n6 === 3 && c.n24 === 4, '1/6/24 Std.: 2/3/4 Orders nah am besten Preis (weit weg zählt nicht)');
    assert(c.level === 'mittel', 'Standard: mittel ab 3');
    $('tsc-hotmid').value = '5'; assert(T.tscCompetition(book, now).level === 'ruhig', 'Grenze einstellbar');
    $('tsc-hotmid').value = '2'; $('tsc-hothi').value = '3'; assert(T.tscCompetition(book, now).level === 'heiß', 'heiß-Grenze einstellbar (mindestens mittel + 1)');
    $('tsc-hotmid').value = '3'; $('tsc-hothi').value = '6';
    // 22.10.: eigene Orders (alle Charaktere) zählen nicht als Konkurrenz – Suche „mittel“, angenommener Trade blieb sonst „heiß“
    const own1 = o(true, 100.5, 2), own2 = o(false, 109.5, 3), own3 = o(true, 100.6, 1), own4 = o(false, 109.4, 1), withOwn = { buys: book.buys.concat([own1, own3]), sells: book.sells.concat([own2, own4]) };
    assert(T.tscCompetition(withOwn, now).level === 'heiß', 'ohne Kenntnis: frische eigene Orders treiben auf heiß');
    T.compOwnIds()[own1.order_id] = true; T.compOwnIds()[own2.order_id] = true; T.compOwnIds()[own3.order_id] = true; T.compOwnIds()[own4.order_id] = true;
    c = T.tscCompetition(withOwn, now);
    assert(c.level === 'mittel' && c.n1 === 2 && c.n6 === 3, 'eigene Orders herausgerechnet → gleiche Stufe wie in der Suche (mittel)');
    for (let i = 0; i < 4; i++){ T.compOwnIds()['own' + i] = true; T.compObserve([['jita:35', { buys: [o(true, 100, 3000), Object.assign(o(true, 101 + i, 5), { order_id: 'own' + i })], sells: [o(false, 110, 3000)] }]], now - (4 - i) * 20 * 60000); }
    assert(T.tscCompetition({ buys: [o(true, 100, 3000)], sells: [o(false, 110, 3000)] }, now, 'jita:35').obs === 0, 'eigenes Überbieten zählt nicht als Preiswechsel (Beobachtung)');
    // Eigene Beobachtung: bester Preis wechselt zwischen Aktualisierungen
    const quiet = { buys: [o(true, 100, 3000)], sells: [o(false, 110, 3000)] };
    for (let i = 0; i < 7; i++){ const b = { buys: [o(true, 100 + i, 3000)], sells: quiet.sells }; T.compObserve([['jita:34', b]], now - (7 - i) * 20 * 60000); }
    c = T.tscCompetition(quiet, now, 'jita:34');
    assert(c.n6 === 0 && c.obs === 6 && c.level === 'heiß', 'bester Preis 6× gewechselt → heiß, obwohl alle Orders alt sind');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-compete-v1'))['jita:34'].length === 7, 'Beobachtung gespeichert in eve-zentrale-compete-v1');
    for (let i = 0; i < 60; i++) T.compObserve([['jita:34', quiet]], now + i * 120000);
    const st = JSON.parse(w.localStorage.getItem('eve-zentrale-compete-v1'))['jita:34'];
    assert(st.length === 48, 'höchstens 48 Beobachtungen je Ware');
    T.compObserve([['jita:35', quiet]], now + 4 * 864e5);
    assert(!JSON.parse(w.localStorage.getItem('eve-zentrale-compete-v1'))['jita:34'], 'älter als 3 Tage wird gelöscht');
    // Symbol an Trades, Watchlist, Overlays
    T.trLiveSet('t1', { types: { buys: book.buys.concat([o(true, 100, 2), o(true, 100, 3), o(true, 100, 4)]), sells: book.sells }, own: {}, time: now });
    assert(T.compTrade('t1').level === 'heiß', 'Trade: Konkurrenz aus dem geladenen Buch');
    T.trRender();
    const pill = x => x && x.querySelector('.comp-p, .trk-ic[title^="Konkurrenz"]');   // CA/CB: im Overlay als ⚔-Symbol
    assert(/heiß/.test(pill(d.querySelector('#trades-list .tr-card')).textContent), 'Meine Trades: ⚔ heiß');
    const view = id => { const b = d.createElement('div'); T.ovRenderViewInto(id, b); return b; };
    assert(pill(view('trades').querySelector('.ov-card')) && pill(view('track').querySelector('.trk-trade')), 'Trades- und Watchlist-Overlay: Symbol');
    assert(/Orders nah am besten Preis in 1 \/ 6 \/ 24 Std/.test(pill(view('trades').querySelector('.ov-card')).title), 'Tooltip erklärt die Zahlen');
    // Suchoptionen auch im Overlay
    assert(['tsc-hotdown', 'tsc-hotmid', 'tsc-hothi'].every(id => $(id)) && /Heiße Waren abwerten/.test($('tsc-hotdown').parentNode.textContent), 'Suchoption „Heiße Waren abwerten“ + Grenzen');
    console.log('\nALL AA5 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
