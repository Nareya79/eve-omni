// WA (09.10.2026): Wallet › Auswertung – Netto je Quelle, Broker Einstellen/Preisänderung, Buchungen je Tag, Top-Waren mit Marktanteil,
// Orders (Füllquote), Zeiträume + Vorzeitraum, Wärmefeld, Overlay-Karte. Alte Teile (Einnahmen/Ausgaben pro Tag, Aufteilung) sind weg.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), D = 864e5, JITA = 60003760;
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:NOW+3600000, character_id:'111', character_name:'Taron Velkar' }];
// Speicher wie pnlMerge: tx [t, type, q, preis, kauf, ort, kunde], fee [t, b|t, betrag, ctxTyp, ctxId], ord [type, issued, ort, kauf, [ältere issued]]
const T0 = NOW - 3 * D, T1 = NOW - 2.5 * D;
const STORE = { upd: NOW,
  tx: { 1: [NOW - 5 * D, 34, 10, 100, 1, JITA, 0], 3: [NOW - 2 * D, 34, 6, 150, 0, JITA, 0], 4: [NOW - 1 * D, 34, 4, 90, 0, JITA, 0], 5: [NOW - 1 * D, 1230, 100, 10, 0, JITA, 0],
        9: [NOW - 12 * D, 35, 5, 100, 1, JITA, 0], 10: [NOW - 11 * D, 35, 5, 140, 0, JITA, 0] },
  fee: { 50: [NOW - 2 * D, 't', 9, 'market_transaction_id', 3], 51: [T0, 'b', 20, 'market_order_id', 900], 52: [T1, 'b', 7, 'market_order_id', 900] },
  ord: { 900: [34, T1, JITA, 0, [T0]] },
  om: { 900: [10, 0, 'expired', 150] } };
const HIST = Array.from({ length: 10 }, (_, i) => ({ date: new Date(NOW - (9 - i) * D).toISOString().slice(0, 10), average: 140, highest: 150 + i, lowest: 130 - i, volume: 100, order_count: 5 }));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(STORE));
    w.fetch = function(url){
      const u = String(url);
      if (/\/markets\/10000002\/history\/.*type_id=34/.test(u)) return Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(HIST) });
      return Promise.reject(new Error('offline ' + u));
    };
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Buchungen: Kategorien + Tagessummen (ältester Tag angeschnitten, Überweisungen zählen nicht)
    assert(T.waJrCat('bounty_prizes') === 'bounty' && T.waJrCat('agent_mission_reward') === 'bounty' && T.waJrCat('contract_reward') === 'courier' && T.waJrCat('planetary_export_tax') === 'pi' &&
      T.waJrCat('market_transaction') === '' && T.waJrCat('player_donation') === '' && T.waJrCat('brokers_fee') === '' && T.waJrCat('insurance') === 'misc', 'Buchungsarten → Quellen (Markt/Überweisungen raus)');
    const iso = t => new Date(t).toISOString();
    T.waJrMerge('111', [{ date: iso(NOW - 1000), ref_type: 'contract_reward', amount: 500 }, { date: iso(NOW - D), ref_type: 'bounty_prizes', amount: 1000 },
      { date: iso(NOW - D), ref_type: 'player_donation', amount: 999 }, { date: iso(NOW - 3 * D), ref_type: 'planetary_export_tax', amount: -40 }, { date: iso(NOW - 20 * D), ref_type: 'bounty_prizes', amount: 77 }]);
    T.waJrMerge('111', [{ date: iso(NOW - 1000), ref_type: 'contract_reward', amount: 500 }, { date: iso(NOW - D), ref_type: 'bounty_prizes', amount: 1000 }]);   // zweiter Abruf: nicht doppelt
    const s7 = T.waSpan(7, NOW), cur = T.waSum(['111'], s7.from, s7.to);
    assert(cur.bounty === 1000 && cur.courier === 500 && cur.misc === 0, 'Buchungen: Kopfgeld + Kurier, zweiter Abruf zählt nicht doppelt, Spende kein Gewinn');
    assert(cur.pi === -40, 'Tage vor dem neuen Abruf bleiben erhalten (PI-Steuer)');
    // Markt: Trading-Gewinn nach Steuer, Mining-Verkauf ohne Einkauf, Broker getrennt Einstellen/Preisänderung
    const r = (1000 - cur.mine) / 1000;   // geschätzter Steuersatz (aus dem Mining-Verkauf ohne Steuerbuchung)
    assert(r > 0 && r < 0.1, 'Mining-Verkauf (Veldspar ohne Einkauf) = Umsatz nach Steuer');
    assert(Math.abs(cur.trade - (6 * 50 - 9 + 4 * 90 - 400 - 360 * r)) < 0.01, 'Trading: 6×(150−100) − 9 Steuer + 4×(90−100) − Steuer = ' + cur.trade.toFixed(1));
    assert(cur.brkNew === 20 && cur.brkRel === 7 && cur.broker === -27, 'Broker: 20 Einstellen + 7 Preisänderung');
    assert(cur.tax === 9 && Math.abs(cur.cost - (9 + 27 + 40)) < 0.01, 'Kosten = Steuer + Broker + PI');
    assert(Math.abs(cur.tot - (cur.trade + cur.mine + 1000 + 500 - 40 - 27)) < 0.01 && cur.rev === 900 + 360 + 1000 && cur.n === 3, 'Netto = alle Quellen, Umsatz und Anzahl Verkäufe');
    const pv = T.waSum(['111'], s7.pfrom, s7.pto);
    assert(Math.abs(pv.trade - (5 * 40 - 700 * r)) < 0.01 && pv.n === 1, 'Vorzeitraum (8–14 Tage) eigener Trade: 5×(140−100) − Steuer');
    // Balken: Tage bei 7 Tagen, Stunden bei Heute, Monate bei Alles
    const bk = T.waBuckets(s7);
    assert(bk.step === 'd' && bk.keys.length >= 7 && bk.keys.length <= 8, 'Balken: 7 Tage = Tagesbalken');
    assert(T.waBuckets(T.waSpan(1, NOW)).step === 'h' && T.waBuckets(T.waSpan(90, NOW)).step === 'w' && T.waBuckets(T.waSpan(365, NOW)).step === 'm', 'Heute = Stunden, 90 Tage = Wochen, 1 Jahr = Monate');
    const by = T.waSeries(['111'], s7, bk), day = k => new Date(NOW - k * D).toISOString().slice(0, 10);
    assert(Math.abs(by[day(2)].trade - 291) < 0.01 && by[day(1)].bounty === 1000 && by[day(0)].courier === 500, 'Tagesbalken: Trading am Verkaufstag, Buchungen am Buchungstag');
    // Waren
    const ty = T.waTypes(['111'], s7.from, s7.to);
    assert(ty.length === 1 && ty[0].type === 34 && ty[0].q === 10 && ty[0].hq === 10 && ty[0].hold / ty[0].hq > 3 * D, 'Waren: nur mit Einkauf, Haltezeit aus Kauf → Verkauf');
    // Seite
    $('neo-btn-wallet').click(); await tick(50);
    $('wv-range').value = '7'; $('wv-view-wa').click(); await tick(300); T.waPageRender(); await tick(50);
    const pg = $('wa-page'), txt = pg.textContent;
    assert(!$('wv-wa-wrap').hidden && /Netto-Gewinn/.test(txt) && pg.querySelectorAll('.wa-bars rect').length > 7, 'Wallet › Auswertung: Kacheln + Balken');
    assert(!$('wv-pie-svg') && !$('wv-stats') && ![...d.querySelectorAll('.card-title')].some(e => /Einnahmen \/ Ausgaben|Aufteilung/.test(e.textContent)), 'Alte Teile raus: Einnahmen/Ausgaben pro Tag, Aufteilung, Kennzahl-Kacheln');
    assert(/Kopfgeld & Missionen/.test(txt) && /Kurier/.test(txt) && /Broker \(Preisänderungen\)/.test(txt) && /Füllquote/.test(txt), 'Legende mit Quellen, Kosten mit Preisänderungen, Orders');
    const it = pg.querySelector('.wa-it:not(.wa-ith)');
    assert(it && it.querySelector('.hc-btn') && /1,3 %/.test(it.textContent) && /25,0 % ↗/.test(it.textContent), 'Top-Ware mit Preisverlauf-Knopf, Marktanteil (10 von 800 Stk am Hub in 8 Tagen) und breiter werdender Spanne');
    assert(pg.querySelectorAll('.wa-heat i').length === 168, 'Wärmefeld 7 × 24');
    assert(/100,0 %/.test(pg.textContent) && /1 \/ 1/.test(pg.textContent), 'Orders: Füllquote 100 %, komplett gefüllt 1/1');
    // Zeiträume: Alles und Heute ohne Fehler
    $('wv-range').value = '0'; $('wv-range').onchange(); await tick(50);
    assert(/Alles Gespeicherte/.test($('wa-page').textContent) && !/▲▼/.test($('wa-page').textContent), 'Alles: ohne Vorzeitraum');
    $('wv-range').value = '1'; $('wv-range').onchange(); await tick(50);
    assert(/Heute/.test($('wa-page').textContent), 'Heute: Stundenbalken');
    // Overlay
    const ob = d.createElement('div'); T.waOvView(ob);
    assert(/Gewinn heute/.test(ob.textContent) && /Gewinn 7 Tage/.test(ob.textContent) && ob.querySelector('.wa-bars'), 'Wallet-Overlay › Auswertung: heute, 7 Tage, Mini-Balken');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
