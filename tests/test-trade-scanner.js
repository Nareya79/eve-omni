// Station-Trading-Scanner: Preisschritte, Gebuehren, Historie, Auswertung, Plan, Order-Check, kompletter Scan mit Mock-ESI.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const STATION = 60003760;
const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Anna Handel' },
  { access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Bert Frachter' }
];
const now = Date.now();
const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
let oid = 1;
function ord(type, buy, price, vol, ageMin, loc){
  return { order_id: oid++, type_id: type, is_buy_order: buy, price, volume_remain: vol, volume_total: vol, location_id: loc || STATION,
           issued: iso(now - (ageMin === undefined ? 600 : ageMin) * 60000), duration: 90, min_volume: 1, range: 'station', system_id: 30000142 };
}
// Typen: 1001 lohnend+liquide, 1002 ohne Marge, 1003 lohnend aber kaum gehandelt, 1004 lohnend aber manipulierter Spread,
// 1005 lohnend, teuer, viel Konkurrenz; 1006 Order nicht an der Station
const BOOK = [
  ord(1001, true, 99500, 50), ord(1001, true, 99000, 80), ord(1001, false, 120300, 30), ord(1001, false, 121000, 10),
  ord(1002, true, 1000, 500), ord(1002, false, 1010, 500),
  ord(1003, true, 50000, 5), ord(1003, false, 90000, 5),
  ord(1004, true, 10000, 100), ord(1004, false, 40000, 100),
  ord(1005, true, 5000000, 3, 10), ord(1005, true, 4990000, 3, 20), ord(1005, true, 4980000, 3, 30), ord(1005, false, 6000000, 2, 5),
  ord(1005, false, 6010000, 2, 15), ord(1005, false, 6020000, 2, 25), ord(1005, false, 6030000, 2, 35),
  ord(1006, true, 100, 1, 600, 60008494), ord(1006, false, 200, 1, 600, 60008494)
];
// eigene Orders: 1001 Kauforder (ueberboten) und 1005 Verkaufsorder (vorne)
const MY_BUY = ord(1001, true, 99000.5, 20, 60);
const MY_SELL = ord(1005, false, 5990000, 1, 2);
BOOK.push(MY_BUY, MY_SELL);
function hist(avg, hi, lo, vol, days){
  const out = [];
  for (let i = 40; i >= 1; i--){
    const d = new Date(now - i*86400000).toISOString().slice(0,10);
    if (i <= (days || 40)) out.push({ date: d, average: avg, highest: hi, lowest: lo, volume: vol, order_count: 10 });
  }
  return out;
}
const HIST = {
  1001: hist(110000, 121000, 99000, 400),
  1002: hist(1005, 1010, 1000, 100000),
  1003: hist(70000, 90000, 50000, 30, 10),
  1004: hist(12000, 13000, 11000, 500),
  1005: hist(5500000, 6000000, 5000000, 40)
};
const NAMES = {1001:'Damage Control II', 1002:'Tritanium', 1003:'Rare Thing', 1004:'Pump Item', 1005:'Expensive Module'};

function makeWindow(extra){
  let clip = null;
  const w = new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      w.localStorage.setItem('eve-zentrale-active-char', '111');
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { clip = t; return Promise.resolve(); } } });
      w.__clip = () => clip;
      w.__calls = [];
      w.fetch = function(url, opts){
        const u = String(url); let m; w.__calls.push(u);
        const ok = (d, pages) => Promise.resolve({ ok:true, status:200, headers:{ get:k => (k === 'x-pages' ? String(pages || 1) : null) }, json:() => Promise.resolve(d) });
        if ((m = u.match(/\/markets\/10000002\/orders\/.*page=(\d+)/))){
          const p = +m[1]; const half = Math.ceil(BOOK.length / 2);
          return ok(p === 1 ? BOOK.slice(0, half) : BOOK.slice(half), 2);
        }
        if ((m = u.match(/\/markets\/10000002\/history\/.*type_id=(\d+)/))) return ok(HIST[m[1]] || []);
        if (u.indexOf('/universe/names/') !== -1) return ok(JSON.parse(opts.body).map(id => ({ id, name: NAMES[id] || ('T' + id), category:'inventory_type' })));
        if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok({ skills: [{skill_id:16622, trained_skill_level:5},{skill_id:3446, trained_skill_level:5},{skill_id:16597, trained_skill_level:3},{skill_id:3443, trained_skill_level:4},{skill_id:3444, trained_skill_level:5}] });
        if ((m = u.match(/\/characters\/(\d+)\/wallet\//))) return ok(m[1] === '111' ? 2345678901.55 : 5);
        if ((m = u.match(/\/characters\/(\d+)\/orders\//))) return ok(m[1] === '111' ? [MY_BUY, MY_SELL] : []);
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name: NAMES[m[1]] || '#' + m[1], volume: 1 });
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
  return w;
}

(async () => {
  try{
    let w = makeWindow(); await tick(700);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);

    // --- Preisschritte (4 gueltige Stellen) ---
    assert(near(T.tscTick(4.01), 0.01) && near(T.tscTick(123.4), 0.1) && T.tscTick(99500) === 10 && T.tscTick(1234567) === 1000, 'Preisschritt je Groessenordnung');
    assert(T.tscAbove(99500) === 99510 && T.tscBelow(120300) === 120200, 'eine Stufe drueber / drunter');
    assert(T.tscAbove(9999) === 10000 && T.tscBelow(1000000) === 999900 && T.tscBelow(1000) === 999.9, 'Wechsel der Groessenordnung');
    assert(T.tscAbove(4.01) === 4.02 && T.tscBelow(4.01) === 4 && T.tscAbove(99000.5) === 99010, 'kleine Preise und Preise neben dem Raster');
    assert(T.tscAbove(0.5) === 0.51, 'Mindestschritt 0,01 ISK');

    // --- Gebuehren ---
    let f = T.tscFees({brokerLevel:5, accountingLevel:5, abrLevel:3});
    assert(near(f.brk, 0.015) && near(f.tax, 0.03375) && near(f.relistDiscount, 0.68) && near(f.relist, 0.32*0.015), 'Broker 1,5 %, Steuer 3,375 %, Relist-Rabatt 68 %');
    f = T.tscFees({brokerLevel:5, accountingLevel:5, abrLevel:5, factionStanding:10, corpStanding:10});
    assert(near(f.brk, 0.01) && near(f.relistDiscount, 0.8), 'Standings senken Broker bis zur Untergrenze 1 %');
    assert(near(T.tscFees({brokerLevel:0, accountingLevel:0, abrLevel:0}).brk, 0.03), 'ohne Skills 3 %');

    // --- Historie ---
    const ref = T.tscHistRef(now);
    const s = T.tscHistStats(HIST[1001], ref);
    assert(near(s[0], 400) && near(s[1], 400) && s[2] === 30 && near(s[3], 110000) && near(s[4], 121000), 'Historie: Umsatz 7/30 Tage, Handelstage, Schnitt');
    const s3 = T.tscHistStats(HIST[1003], ref);
    assert(s3[2] < 20, 'kaum gehandeltes Item hat wenige Handelstage');
    const r1 = T.tscHistRef(Date.UTC(2026, 8, 23, 9, 0)), r2 = T.tscHistRef(Date.UTC(2026, 8, 23, 12, 0));
    assert(r1 === '2026-09-21' && r2 === '2026-09-22', 'Referenztag vor/nach dem taeglichen Update');

    // --- Buch und Vorauswahl ---
    const types = T.tscGroupBook(BOOK, STATION);
    assert(!types[1006] && types[1001].buys[0].price === 99500 && types[1001].sells[0].price === 120300, 'Buch nur fuer die Station, sortiert');
    const cfg = { depth:400, minPrice:1000, minVol:20, capital:1e9, maxItemPct:15, sharePct:10, days:3, minMargin:6, relists:2,
                  brokerLevel:5, accountingLevel:5, abrLevel:3 };
    const fees = T.tscFees(cfg);
    const pre = T.tscPreselect(types, cfg, fees).map(c => c.tid);
    assert(pre.includes(1001) && !pre.includes(1002) && pre.includes(1005), 'Vorauswahl: Marge-Filter');

    // --- Auswertung ---
    const a = T.tscAnalyzeType(1001, types[1001], s, fees, cfg, now);
    assert(a.myBuy === 99510 && a.mySell === 120200, 'Vorschlag: Preise einen Schritt besser');
    const unitExp = 120200*(1-0.015-0.03375) - 99510*1.015 - 2*0.32*0.015*(99510+120200);
    assert(near(a.unit, unitExp, 0.01), 'Gewinn/Stueck nach Broker, Steuer und 2 Preisanpassungen: ' + a.unit.toFixed(2));
    assert(a.qty === 120 && near(a.capital, 120*99510*1.015, 0.01), 'Menge = 10 % von 400/Tag x 3 Tage');
    assert(a.flags.length === 0, 'keine Warnung bei normalem Spread');
    assert(T.tscAnalyzeType(1003, types[1003], s3, fees, cfg, now) === null, 'selten gehandelt -> raus');
    const a4 = T.tscAnalyzeType(1004, types[1004], T.tscHistStats(HIST[1004], ref), fees, cfg, now);
    assert(a4 && a4.flags.length > 0 && a4.unit < a4.unitNow, 'aufgeblasener Spread wird markiert und vorsichtig gerechnet');
    const a5 = T.tscAnalyzeType(1005, types[1005], T.tscHistStats(HIST[1005], ref), fees, cfg, now);
    assert(a5 && T.tscCompetition(types[1005], now).level === 'heiß', 'viele frische Orders -> Konkurrenz heiß');
    assert(a5.qty === Math.floor(Math.min(4*3, 1.5e8/(a5.myBuy*1.015))), 'Menge durch Max. je Item begrenzt: ' + a5.qty);
    assert(T.tscNiceQty(12347) === 12000 && T.tscNiceQty(87) === 87 && T.tscNiceQty(999) === 990, 'Mengen gut eintippbar gerundet');

    // --- Plan ---
    const rows = [ {capital:600, perDay:10, profit:30}, {capital:500, perDay:50, profit:100}, {capital:300, perDay:20, profit:40} ];
    let sum = T.tscPlan(rows, 1000, null);
    assert(rows[1].inPlan && rows[2].inPlan && !rows[0].inPlan && sum.capital === 800 && sum.count === 2, 'Plan nach Gewinn/Tag bis Kapital voll');
    sum = T.tscPlan(rows, 1e9, 3);
    assert(sum.count === 1 && rows[1].inPlan, 'Plan beachtet freie Slots (2 je Item)');

    // --- Order-Check ---
    let c = T.tscCheckOrder(MY_BUY, types[1001], fees, now);
    assert(c.status === 'überboten' && c.best === 99500 && c.newPrice === 99510, 'eigene Kauforder ueberboten, neuer Preis');
    const feeExp = 0.015*(99510-99000.5)*20 + fees.relist*99510*20;
    assert(near(c.fee, feeExp, 0.01), 'Gebuehr fuer die Preisaenderung');
    c = T.tscCheckOrder(MY_SELL, types[1005], fees, now);
    assert(c.status === 'top' && c.best === 6000000, 'eigene Verkaufsorder vorne');
    const fresh = Object.assign({}, MY_BUY, { issued: iso(now - 60000) });
    c = T.tscCheckOrder(fresh, types[1001], fees, now);
    assert(/änderbar ab/.test(c.note), '5-Minuten-Sperre nach Aenderung');

    // --- Kopierformat ---
    assert(T.tscCopyPrice(99510) === '99510' && T.tscCopyPrice(4.5) === '4.5' && T.tscCopyPrice(999.9) === '999.9', 'Preis ohne Tausenderpunkte');
    $('tsc-sep').value = ','; assert(T.tscCopyPrice(4.02) === '4,02', 'Komma-Format');
    $('tsc-sep').value = '.';

    // --- UI-Grundzustand ---
    assert(!$('tsc-scan-view').hidden && $('st-watch-view').hidden, 'Scanner ist Standardansicht');
    $('tsc-view-watch').click();
    assert($('tsc-scan-view').hidden && !$('st-watch-view').hidden && $('st-table'), 'Watchlist erreichbar');
    $('tsc-view-scan').click();
    assert($('tsc-hub').options.length === 5 && $('tsc-hub').value === 'jita', 'Hub-Auswahl, Jita vorgewaehlt');
    await tick(300);
    assert($('tsc-capital').value === '2.345.678.901', 'Kapital automatisch aus dem Wallet: ' + $('tsc-capital').value);
    assert(/Broker 1,5 %/.test($('tsc-fees').textContent) && /Steuer 3,375 %/.test($('tsc-fees').textContent), 'Gebuehren-Anzeige: ' + $('tsc-fees').textContent);

    // --- kompletter Scan ---
    $('tsc-minmargin').value = '6';
    await T.runTradeScan();
    const scanRows = T.getTscRows();
    const ids = scanRows.map(r => r.tid);
    assert(ids.includes(1001) && !ids.includes(1002) && !ids.includes(1003) && !ids.includes(1004), 'Scan: nur lohnende, liquide, unauffaellige Items: ' + ids.join(','));
    assert(scanRows[0].name && $('tsc-body').querySelectorAll('tr').length === scanRows.length, 'Tabelle gefuellt');
    const dc = scanRows.find(r => r.tid === 1001);
    assert(dc.mine.length === 1 && dc.inPlan, 'eigene Order erkannt, Item im Plan');
    const tr = [...$('tsc-body').querySelectorAll('tr')].find(t => /Damage Control II/.test(t.textContent));
    const btns = tr.querySelectorAll('.tsc-cp-b[data-copy]');
    assert(btns.length === 3, 'PQ1: drei Kopier-Knoepfe (Kaufpreis, Menge, Verkaufspreis), keiner hinter dem Namen');
    assert(tr.querySelector('.mk-btn'), 'H10: Markt-in-EVE-Knopf in der Zeile');
    btns[0].click(); await tick(20); assert(w.__clip() === '99510', 'Kaufpreis kopiert');
    btns[1].click(); await tick(20); assert(w.__clip() === String(dc.qty), 'Menge kopiert');
    btns[2].click(); await tick(20); assert(w.__clip() === '120200', 'Verkaufspreis kopiert');
    assert(!$('tsc-summary').hidden && /frei/.test($('tsc-summary').textContent), 'Zusammenfassung mit freien Slots');
    // Slots: Trade 4, Retail 5 -> 5+16+40 = 61, 2 offen -> 59 frei
    assert(/59 frei/.test($('tsc-summary').textContent), 'Slots aus Skills minus offene Orders');
    // eigene Orders
    assert(!$('tsc-orders-wrap').hidden, 'Order-Check sichtbar');
    const orows = $('tsc-orders-body').querySelectorAll('tr');
    assert(orows.length === 1 && /überboten/.test(orows[0].textContent) && orows[0].querySelector('.tsc-cp-b'), 'nur ueberbotene Order mit Kopier-Knopf');
    $('tsc-orders-outbid').checked = false; $('tsc-orders-outbid').onchange();
    assert($('tsc-orders-body').querySelectorAll('tr').length === 2, 'alle eigenen Orders zeigbar');
    // Plan als Text
    const txt = T.tscPlanText();
    assert(/Jita IV - Moon 4/.test(txt) && /Kauforder:\s+99510 ISK x \d+/.test(txt), 'Plan-Text: ' + txt.split('\n')[2]);
    $('tsc-copy-plan').click(); await tick(20); assert(w.__clip() === txt, 'Plan kopiert');
    // Nur Plan
    $('tsc-planonly').checked = true; $('tsc-planonly').onchange();
    assert([...$('tsc-body').querySelectorAll('tr')].every(t => t.className === 'tsc-inplan'), 'Nur-Plan-Filter');
    // Hohe Konkurrenz ausblenden
    $('tsc-hidehot').checked = true;
    await T.runTradeScan();
    assert(!T.getTscRows().some(r => r.tid === 1005), 'hohe Konkurrenz ausgeblendet');
    // Historie kommt beim zweiten Scan aus dem Tages-Cache
    const histCalls = w.__calls.filter(u => /history/.test(u)).length;
    await T.runTradeScan();
    assert(w.__calls.filter(u => /history/.test(u)).length === histCalls, 'Historie aus dem Tages-Cache, keine neuen Abfragen');
    // Einstellungen gespeichert
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-tsc-v1'));
    assert(saved['tsc-minmargin'] === '6' && saved.hidehot === true && saved.stand.jita, 'Einstellungen gespeichert');
    w.close();

    // Neustart: Einstellungen wieder da, Kapital nicht vom Wallet ueberschrieben
    w = makeWindow({ 'eve-zentrale-tsc-v1': JSON.stringify(Object.assign(saved, { 'tsc-capital': '500.000.000', stand: { jita: { f: '5', c: '4' } } })) });
    await tick(900);
    assert(w.document.getElementById('tsc-capital').value === '2.345.678.901', 'beim Start wird der Kontostand als Kapital eingetragen');
    assert(w.document.getElementById('tsc-fstand').value === '5' && /Broker 1,27 %/.test(w.document.getElementById('tsc-fees').textContent),
      'Standings fliessen in die Broker-Gebuehr ein: ' + w.document.getElementById('tsc-fees').textContent);
    w.close();
    console.log('\nALL TRADE SCANNER TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
