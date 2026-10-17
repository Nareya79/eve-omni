// MB Block A (10.10.2026): Marktbrowser – 5-%-Preis ohne Ausreißer, Suche, Warengruppen-Baum, 5 Hubs nebeneinander, Orderbuch (nur Hubs)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const HUBST = [60003760, 60008494, 60011866, 60004588, 60005686], REG = [10000002, 10000043, 10000032, 10000030, 10000042];
const order = (id, buy, price, vol, loc, extra) => Object.assign({ order_id: id, is_buy_order: buy, price, volume_remain: vol, min_volume: 1, location_id: loc, system_id: 30000142, issued: new Date(Date.now() - 86400000).toISOString(), duration: 90, range: 'station', type_id: 34 }, extra || {});
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.fetch = (url) => {
      url = String(url); const m = /markets\/(\d+)\/(orders|history)/.exec(url), json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(x) });
      if (m && m[2] === 'orders'){ const i = REG.indexOf(+m[1]), st = HUBST[i]; return json([order(1 + i * 10, false, 4 + i, 1000, st), order(2 + i * 10, true, 3 + i * 0.5, 500, st), order(3 + i * 10, true, 9999, 5, st, { min_volume: 5 })]); }
      if (m) return json([{ date: '2026-10-09', volume: 700, average: 4 }, { date: '2026-10-10', volume: 1400, average: 4 }]);
      return Promise.reject(new Error('offline'));
    };
  } }).window;
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const d = w.document, T = w.__test;
  // 5-%-Preis: Lockvogel weit weg + Mindestmengen-Kauforder raus
  const st = T.mbStat([order(1, false, 10, 50), order(2, false, 11, 50), order(3, false, 12, 900), order(4, false, 500, 1)], false);
  assert(st.best === 10 && st.vol === 1000 && Math.abs(st.p5 - 10) < 0.01 && st.out === 1 && st.n === 3, 'MB: Verkauf – bestes Angebot, Menge, 5-%-Preis, Ausreißer (' + JSON.stringify(st) + ')');
  const sb = T.mbStat([order(1, true, 100, 10, 0, { min_volume: 10 }), order(2, true, 9, 900), order(3, true, 8, 100)], true);
  assert(sb.best === 9 && Math.abs(sb.p5 - 9) < 0.01, 'MB: Kauf – Mindestmengen-Lockvogel zählt nicht als bestes Gebot');
  const sj = T.mbStat([order(1, true, 4.8e6, 20), order(2, true, 4.7e6, 30), order(3, true, 0.49, 9e9), order(4, true, 1, 5e8)], true);   // PLEX: Ramsch-Gebote mit Riesenmenge
  assert(sj.best === 4.8e6 && sj.p5 > 4.7e6 && sj.out === 2, 'MB: Ramsch-Gebote kippen das beste Gebot und den 5-%-Preis nicht (' + JSON.stringify(sj) + ')');
  // Suche
  T.mbIdxSet({ t: Date.now(), lang: 'de', g: { 1: ['Mineralien', 0, [34, 35]], 2: ['Erze', 1, [1230]] }, n: { 34: 'Tritanium', 35: 'Pyerite', 1230: 'Veldspar', 40: 'Megacyte Tritanium-Mix' } });
  assert(T.mbFind('trit').join() === '34,40' && T.mbFind('ani').length === 2 && T.mbFind('').length === 0, 'MB: Suche – Anfang zuerst, dann enthalten');
  // Seite öffnen, Ware laden
  d.getElementById('neo-btn-market').click();
  await T.mbOpen(34);
  await new Promise(r => setTimeout(r, 300));
  const c = T.mbCur();
  assert(c && c.hubs.jita && c.hubs.hek && c.hubs.jita.s.best === 4 && c.hubs.hek.s.best === 8 && c.hubs.jita.b.best === 3 && c.hubs.jita.day === 1050, 'MB: 5 Hubs geladen (Angebot, Gebot ohne Lockvogel, Umsatz/Tag Ø)');
  const rows = [...d.querySelectorAll('#mb-page .mb-hubs tbody tr')];
  assert(rows.length === 13 && d.querySelectorAll('#mb-page .mb-hubs thead th').length === 6, 'MB: Tabelle 8 Kennzahlen + 5 Margen-Zeilen × 5 Hubs');
  // MB5: Margen-Rechner – Kauforder 1 Schritt über Gebot 3, Verkauf 1 Schritt unter Angebot 4, Gebühren mit Skills
  const m = T.mbMargin(c.hubs.jita);
  assert(m && m.buy === 3.01 && m.sell === 3.99 && m.p > 0.5 && m.p < 0.98 && m.ok === 'ja', 'MB5: Kauf-/Verkaufspreis, Gewinn nach Gebühren, lohnt (' + JSON.stringify(m) + ')');
  assert(rows[12].textContent.indexOf('✓ lohnt') > 0 && d.querySelector('#mb-page [data-ova="mbWatch"]') && d.querySelector('#mb-page .mb-act .st-dest'), 'MB5: Urteil, Merkliste-Knopf, Ziel-Knopf beste Marge');
  // MB4: Kurve fest offen, Verlauf aus dem Hub-Abruf (kein zweiter Abruf), kein Kurven-Knopf im Kopf
  assert(d.querySelector('#mb-page .mb-chart svg .hc-avg') && !d.querySelector('#mb-page .mb-item .hc-btn'), 'MB4: Preiskurve auf der Seite');
  T.mbCur().tid = 35; T.mbCur().name = 'Pyerite'; T.mbAction({ type: 'mbWatch' }); T.mbCur().tid = 34; T.mbCur().name = 'Tritanium';   // Tritanium steht schon in der Standard-Liste
  assert(JSON.parse(w.localStorage.getItem('eve-st-watch')).some(x => x.id === 35), 'MB5: Ware landet in der Preis-Merkliste');
  // MB6: Overlay
  const ob = d.createElement('div'); T.ovRenderMarket(ob);
  assert(ob.querySelectorAll('.mb-ovt tbody tr').length === 5 && ob.querySelector('.mb-chart svg') && ob.querySelector('[data-ova="mbGo"]') && ob.querySelector('[data-mk="34"]'), 'MB6: Overlay – Suche, 5 Hubs mit Marge, Kurve, Markt-Knopf');
  assert(/markt: "Markt"/.test(html) && /market: "markt"/.test(html) && /\/\^mb\[A-Z\]\/\.test\(a\.type\)\)\{ mbAction/.test(html), 'MB6: Overlay registriert (Ansicht, OmniCom-Symbol, Aktionen)');
  assert(rows[0].querySelector('.mb-best') && rows[0].children[1].querySelector('.mb-best'), 'MB: günstigstes Angebot (Jita) hervorgehoben');
  const v = T.mbBookView();
  assert(v.ns === 5 && v.nb === 10 && v.sell[0].price === 4 && v.buy[0].price === 9999, 'MB: Orderbuch „nur Hubs“ – alle Orders der 5 Stationen, sortiert');
  assert(d.querySelectorAll('#mb-page .mb-book').length === 2, 'MB: Verkauf | Kauf nebeneinander');
  // Baum
  T.mbAction({ type: 'mbGrp', arg: '1' }); await new Promise(r => setTimeout(r, 50));
  const tree = [...d.querySelectorAll('#mb-page .mb-g button, #mb-page .mb-t button')].map(b => b.textContent.trim());
  assert(tree.join('|') === '▾ Mineralien|▸ Erze|Pyerite|Tritanium', 'MB: Baum – Untergruppe vor Waren, alphabetisch (' + tree.join('|') + ')');
  assert(html.indexOf('"eve-zentrale-mbidx-v1"') > 0 && /"jbdur-v1", "mbidx-v1"\]/.test(html), 'MB: Index ist Zwischenspeicher (S1 darf ihn löschen)');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})();
