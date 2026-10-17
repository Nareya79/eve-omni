// Gewinne-Ansicht (FIFO, Steuer, Broker-Zuordnung, Speicher), Charakterauswahl im Trading-Tab, Kontostand als Kapital, Groessen-Hinweise.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 0.01);
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760, AMARR = 60008494;
const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' },
  { access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Selia' }
];
const now = Date.now(), DAY = 86400000;
const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const T3 = Math.floor((now - 2*DAY)/1000)*1000, T4 = Math.floor((now - DAY)/1000)*1000, TF = Math.floor((now - 3*DAY)/1000)*1000;
let TX = [
  { transaction_id:1, date:iso(now-5*DAY), type_id:1001, quantity:100, unit_price:100000, is_buy:true,  location_id:JITA },
  { transaction_id:2, date:iso(now-4*DAY), type_id:1001, quantity:50,  unit_price:110000, is_buy:true,  location_id:JITA },
  { transaction_id:3, date:iso(T3),        type_id:1001, quantity:120, unit_price:130000, is_buy:false, location_id:JITA },
  { transaction_id:4, date:iso(T4),        type_id:1002, quantity:10,  unit_price:5000,   is_buy:false, location_id:JITA },
  { transaction_id:5, date:iso(now-DAY),   type_id:1003, quantity:5,   unit_price:1000000,is_buy:true,  location_id:JITA },
  { transaction_id:6, date:iso(now-50*DAY),type_id:1004, quantity:1,   unit_price:1000,   is_buy:true,  location_id:AMARR },
  { transaction_id:7, date:iso(now-45*DAY),type_id:1004, quantity:1,   unit_price:2000,   is_buy:false, location_id:AMARR }
];
const JOURNAL = [
  { id:501, date:iso(T3), ref_type:'transaction_tax', amount:-526500, context_id:3, context_id_type:'market_transaction_id' },
  { id:502, date:iso(T4), ref_type:'transaction_tax', amount:-1687.5 },
  { id:503, date:iso(now-5*DAY), ref_type:'brokers_fee', amount:-150000, context_id:900, context_id_type:'market_order_id' },
  { id:504, date:iso(TF), ref_type:'brokers_fee', amount:-15000 },
  { id:505, date:iso(now-2*DAY+777000), ref_type:'brokers_fee', amount:-5000 },
  { id:506, date:iso(T3), ref_type:'market_transaction', amount:15600000, context_id:3, context_id_type:'market_transaction_id' }
];
const ORDERS = [ { order_id:901, type_id:1003, is_buy_order:true, price:1000000, issued:iso(TF), location_id:JITA, volume_remain:0, volume_total:5 } ];
const ORDER_HIST = [ { order_id:900, type_id:1001, is_buy_order:true, price:100000, issued:iso(now-5*DAY), location_id:JITA, state:'expired' } ];
const NAMES = {1001:'Damage Control II', 1002:'Tritanium', 1003:'Rare Thing', 1004:'Old Thing'};

function makeWindow(extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      w.localStorage.setItem('eve-zentrale-active-char', '111');
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.__calls = [];
      w.fetch = function(url, opts){
        const u = String(url); let m; w.__calls.push(u);
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:k => (k === 'x-pages' ? '1' : null) }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/transactions\//))) return ok(m[1] === '111' ? TX : []);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/journal\//))) return ok(m[1] === '111' ? JOURNAL : []);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\//))) return ok(m[1] === '111' ? 2345678901.55 : 87654321);
        if ((m = u.match(/\/characters\/(\d+)\/orders\/history\//))) return ok(m[1] === '111' ? ORDER_HIST : []);
        if ((m = u.match(/\/characters\/(\d+)\/orders\//))) return ok(m[1] === '111' ? ORDERS : []);
        if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok({ skills: [{skill_id:16622, trained_skill_level:m[1]==='111'?5:1},{skill_id:3446, trained_skill_level:5}] });
        if (u.indexOf('/universe/names/') !== -1) return ok(JSON.parse(opts.body).map(id => ({ id, name: NAMES[id] || ('T' + id) })));
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name: NAMES[m[1]] || '#' + m[1], volume: 1 });
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
}

(async () => {
  try{
    let w = makeWindow(); await tick(800);
    let T = w.__test, d = w.document, $ = id => d.getElementById(id);

    // --- Kurzform ---
    assert(T.shortNum(2345678901) === '2,35 Mrd.' && T.shortNum(73032498) === '73 Mio.' && T.shortNum(12500) === '12,5 Tsd.' &&
           T.shortNum(999) === '999' && T.shortNum(-1500000) === '-1,5 Mio.' && T.shortNum(1.2e12) === '1,2 Bio.', 'Kurzform Tsd./Mio./Mrd./Bio.');

    // --- Charakterauswahl + Kontostand als Kapital ---
    assert($('tsc-char').options.length === 2 && $('tsc-char').value === '111', 'Handelscharakter im Trading-Tab auswählbar, aktiver vorgewählt');
    assert($('tsc-capital').value === '2.345.678.901', 'Kontostand als Kapital eingetragen');
    const hint = $('tsc-capital').parentNode.querySelector('.num-hint');
    assert(hint && hint.textContent === '2,35 Mrd.', 'Größenhinweis im Kapitalfeld: ' + (hint && hint.textContent));
    assert(/Kontostand/.test($('tsc-balance').textContent) && /2,35 Mrd\. ISK/.test($('tsc-balance').textContent), 'Kontostand neben der Auswahl');
    $('tsc-capital').value = '500000000';
    assert(hint.textContent === '500 Mio.', 'Hinweis folgt auch gesetzten Werten');
    $('tsc-capital').value = '1.234'; $('tsc-capital').dispatchEvent(new w.Event('input'));
    assert(hint.textContent === '1,23 Tsd.', 'Hinweis beim Tippen');
    const hb = $('hl-budget').parentNode.querySelector('.num-hint');
    assert(hb && hb.textContent.length > 0, 'Hinweis auch im Hauling-Budget: ' + hb.textContent);

    // Wechsel des Charakters im Trading-Tab
    $('tsc-char').value = '222'; $('tsc-char').onchange(); await tick(300);
    assert(w.localStorage.getItem('eve-zentrale-active-char') === '222' && $('sso-active-char').value === '222', 'Wechsel setzt den Handelscharakter überall');
    assert($('tsc-capital').value === '87.654.321' && /87,7 Mio\./.test($('tsc-balance').textContent), 'Kapital = Kontostand des neuen Charakters');
    assert(/Steuer 6,6/.test($('sk-auto-info').textContent) || /6,67/.test($('sk-auto-info').textContent), 'Skills des neuen Charakters geladen: ' + $('sk-auto-info').textContent);
    // Wechsel oben im Charakterbereich spiegelt sich im Trading-Tab
    $('sso-active-char').value = '111'; $('sso-active-char').onchange(); await tick(300);
    assert($('tsc-char').value === '111' && $('tsc-capital').value === '2.345.678.901', 'Wechsel oben wirkt auch im Trading-Tab');

    // --- FIFO-Rechnung ---
    const store = { tx:{}, fee:{}, ord:{}, upd:0 };
    const added = T.pnlMerge(store, TX, JOURNAL, ORDERS.concat(ORDER_HIST));
    assert(added === 7 && Object.keys(store.fee).length === 5, 'Speicher übernimmt Transaktionen, nur Steuer/Broker aus dem Journal');
    let r = T.pnlCompute(store, { from: now - 30*DAY, taxRate: 0.03375 });
    const row = id => r.rows.find(x => +x.type === id);
    const dc = row(1001);
    assert(dc.sold === 120 && dc.matched === 120 && near(dc.cost, 100*100000 + 20*110000), 'FIFO: 100 zu 100k + 20 zu 110k');
    assert(near(dc.tax, 526500) && !dc.taxEst, 'Steuer über Transaktions-ID aus dem Journal');
    assert(near(dc.broker, 150000), 'Broker-Gebühr über Order-ID zugeordnet');
    assert(near(dc.profit, 15600000 - 12200000 - 526500 - 150000), 'Gewinn Damage Control II: ' + dc.profit);
    assert(dc.stockQty === 30 && near(dc.stockVal, 30*110000), 'Rest auf Lager zum Einkaufspreis');
    const tri = row(1002);
    assert(tri.unmatched === 10 && tri.matched === 0 && near(tri.profit, 0) && near(tri.unmatchedRev, 50000), 'Verkauf ohne Einkauf zählt nicht als Gewinn');
    const rare = row(1003);
    assert(near(rare.broker, 15000) && rare.sales.length === 0 && rare.stockQty === 5, 'Broker-Gebühr über Zeitstempel der Order zugeordnet');
    assert(near(r.tot.unassigned, 5000), 'nicht zuordenbare Broker-Gebühr separat');
    assert(near(r.tot.profit, 2723500 - 15000 - 5000) && near(r.tot.stockVal, 3300000 + 5000000 + 0), 'Summen: Gewinn ' + r.tot.profit);
    assert(!row(1004), '30 Tage: alter Trade außerhalb des Zeitraums');
    r = T.pnlCompute(store, { from: 0, taxRate: 0.03375 });
    assert(row(1004) && near(row(1004).profit, 1000 - 2000*0.03375) && row(1004).taxEst, 'Alles: alter Trade mit geschätzter Steuer');
    r = T.pnlCompute(store, { from: 0, loc: AMARR, taxRate: 0.03375 });
    assert(r.rows.length === 1 && +r.rows[0].type === 1004, 'Ort-Filter');
    // Steuer ohne ID, per Zeitstempel: 1002 hat Steuer 1687.5, aber keine gematchte Menge -> nicht in Gewinn
    const store2 = { tx:{}, fee:{}, ord:{}, upd:0 };
    T.pnlMerge(store2, [TX[0], Object.assign({}, TX[2], { quantity: 100 }), Object.assign({}, TX[3], { type_id:1001, date: iso(T4) })], [JOURNAL[1]], []);
    r = T.pnlCompute(store2, { from: 0, taxRate: 0.03375 });
    const sale2 = r.rows[0].sales.find(s => s.t === T4);
    assert(sale2 && sale2.matched === 0, 'zweiter Verkauf ohne Restbestand');
    const s1 = r.rows[0].sales.find(s => s.t === T3);
    assert(s1.matched === 100 && s1.taxEst === undefined, 'erster Verkauf voll gedeckt');

    // --- Ansicht ---
    $('tsc-view-pnl').click(); await tick(500);
    assert(!$('pnl-view').hidden && $('tsc-scan-view').hidden && $('tsc-view-pnl').getAttribute('aria-selected') === 'true', 'Gewinne-Ansicht offen');
    assert(w.__calls.some(u => /wallet\/transactions/.test(u)) && w.__calls.some(u => /orders\/history/.test(u)), 'lädt Transaktionen, Journal und Order-Historie automatisch');
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-pnl-v1-111'));
    assert(saved && Object.keys(saved.tx).length === 7, 'Daten dauerhaft im Browser gespeichert');
    const rowsDom = [...$('pnl-body').querySelectorAll('tr.pnl-row')];
    assert(rowsDom.length === 2 && /Damage Control II/.test(rowsDom[0].textContent), 'Tabelle: Items mit Verkäufen, bestes oben');
    assert(/\+2,72 Mio\. ISK/.test(rowsDom[0].textContent), 'Gewinn in Kurzform: ' + rowsDom[0].children[8].textContent);
    assert(rowsDom[0].children[8].title === '2.723.500 ISK', 'genauer Wert als Tooltip');
    assert(/10 ohne Einkauf/.test(rowsDom[1].textContent), 'Hinweis ohne Einkauf');
    assert(/\+2,7 Mio\. ISK/.test($('pnl-stats').textContent) && /8,3 Mio\. ISK/.test($('pnl-stats').textContent), 'Kacheln: Gewinn und Lager: ' + $('pnl-stats').textContent);
    assert($('pnl-body').querySelector('tr.pnl-unassigned'), 'Zeile für nicht zuordenbare Broker-Gebühren');
    rowsDom[0].onclick(); await tick(200);
    assert($('pnl-body').querySelectorAll('tr.pnl-sale').length === 1, 'Klick zeigt Einzelverkäufe');
    $('pnl-soldonly').checked = false; $('pnl-soldonly').dispatchEvent(new w.Event('change')); await tick(200);
    assert($('pnl-body').querySelectorAll('tr.pnl-row').length === 3, 'auch Items nur mit Einkauf zeigbar');
    $('pnl-range').value = '0'; $('pnl-range').dispatchEvent(new w.Event('change')); await tick(200);
    assert([...$('pnl-body').querySelectorAll('tr.pnl-row')].some(t => /Old Thing/.test(t.textContent)), 'Zeitraum „Alles“');
    $('pnl-loc').value = String(AMARR); $('pnl-loc').dispatchEvent(new w.Event('change')); await tick(200);
    assert($('pnl-body').querySelectorAll('tr.pnl-row').length === 1, 'Ort Amarr');
    $('pnl-loc').value = '0'; $('pnl-loc').dispatchEvent(new w.Event('change')); await tick(100);

    // Zweites Laden: neue Transaktion wird ergänzt, alte bleiben (auch wenn ESI sie nicht mehr liefert)
    TX = TX.slice(2).concat([{ transaction_id:8, date:iso(now-3600000), type_id:1003, quantity:5, unit_price:1300000, is_buy:false, location_id:JITA }]);
    await T.pnlRefresh('111', false); await tick(200);
    assert(/1 neue Transaktionen/.test($('pnl-status').textContent), 'nur neue Transaktionen gezählt: ' + $('pnl-status').textContent);
    const st2 = JSON.parse(w.localStorage.getItem('eve-zentrale-pnl-v1-111'));
    assert(Object.keys(st2.tx).length === 8, 'ältere Transaktionen bleiben gespeichert');
    assert([...$('pnl-body').querySelectorAll('tr.pnl-row')].some(t => /Rare Thing/.test(t.textContent) && /\+/.test(t.children[8].textContent)), 'Rare Thing jetzt mit Gewinn');

    // Charakterwechsel in der Gewinne-Ansicht
    $('tsc-char').value = '222'; $('tsc-char').onchange(); await tick(400);
    assert(/Keine Verkäufe|Noch keine Daten/.test($('pnl-body').textContent), 'Gewinne des anderen Charakters (leer)');
    w.close();

    // Neustart: Ansicht und Optionen bleiben
    w = makeWindow({ 'eve-zentrale-trading-view': 'pnl', 'eve-zentrale-pnl-opts-v1': JSON.stringify({ range:'0', loc:'0', soldOnly:true }) }); await tick(900);
    assert(!w.document.getElementById('pnl-view').hidden && w.document.getElementById('pnl-range').value === '0', 'Ansicht und Zeitraum gemerkt');
    w.close();
    console.log('\nALL PNL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
