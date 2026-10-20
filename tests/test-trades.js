// Meine Trades: Merken aus dem Scanner, dauerhaft gespeichert, Fortschritt aus Transaktionen, Live-Preise, Mindestpreis, Abschluss.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760;
const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' },
  { access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Selia' }
];
const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
let oid = 1;
function ord(type, buy, price, vol, ageMin){
  return { order_id: oid++, type_id: type, is_buy_order: buy, price, volume_remain: vol, volume_total: vol, location_id: JITA,
           issued: iso(Date.now() - (ageMin === undefined ? 600 : ageMin) * 60000), duration: 90, min_volume: 1, range: 'station', system_id: 30000142 };
}
let BOOK = [ ord(1001, true, 99500, 50), ord(1001, false, 120300, 30), ord(1001, false, 121000, 10) ];
function hist(avg, hi, lo, vol){ const o = []; for (let i = 40; i >= 1; i--) o.push({ date: new Date(Date.now() - i*86400000).toISOString().slice(0,10), average: avg, highest: hi, lowest: lo, volume: vol, order_count: 10 }); return o; }
const HIST = { 1001: hist(110000, 121000, 99000, 400) };
let TXS = [], MYORDERS = [];

function makeWindow(extra){
  let clip = null;
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      w.localStorage.setItem('eve-zentrale-active-char', '111');
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { clip = t; return Promise.resolve(); } } });
      w.__clip = () => clip;
      w.fetch = function(url, opts){
        const u = String(url); let m;
        const ok = (d, pages) => Promise.resolve({ ok:true, status:200, headers:{ get:k => (k === 'x-pages' ? String(pages || 1) : null) }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if ((m = u.match(/\/markets\/10000002\/orders\/.*type_id=(\d+)/))) return ok(BOOK.filter(o => o.type_id === +m[1]).concat(MYORDERS.filter(o => o.type_id === +m[1])));
        if (/\/markets\/10000002\/orders\//.test(u)) return ok(BOOK.concat(MYORDERS));
        if ((m = u.match(/\/markets\/10000002\/history\/.*type_id=(\d+)/))) return ok(HIST[m[1]] || []);
        if (u.indexOf('/universe/names/') !== -1) return ok(JSON.parse(opts.body).map(id => ({ id, name: id === 1001 ? 'Neurotoxin Recovery' : 'T' + id })));
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/transactions\//))) return ok(m[1] === '111' ? TXS : []);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/journal\//))) return ok([]);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\//))) return ok(2345678901);
        if ((m = u.match(/\/characters\/(\d+)\/orders\/history\//))) return ok([]);
        if ((m = u.match(/\/characters\/(\d+)\/orders\//))) return ok(m[1] === '111' ? MYORDERS : []);
        if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok({ skills: [{skill_id:16622, trained_skill_level:5},{skill_id:3446, trained_skill_level:5},{skill_id:3443, trained_skill_level:4}] });
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name: 'Neurotoxin Recovery', volume: 1 });
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
}

(async () => {
  try{
    let w = makeWindow(); await tick(800);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert($('tsc-view-trades').textContent === 'Meine Trades', 'Reiter „Meine Trades“ vorhanden, noch leer');

    await T.runTradeScan();
    let row = [...$('tsc-body').querySelectorAll('tr')].find(t => /Neurotoxin Recovery/.test(t.textContent));
    let btn = row.querySelector('.tsc-track .btn');
    assert(btn && /Merken/.test(btn.textContent), 'Merken-Knopf im Vorschlag');
    btn.click(); await tick(50);
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1'));
    assert(saved.length === 1 && saved[0].tid === 1001 && saved[0].buy === 99510 && saved[0].sell === 120200 && saved[0].charId === '111' && saved[0].qty === 120,
      'Trade mit Plan gespeichert (Preis, Menge, Charakter)');
    row = [...$('tsc-body').querySelectorAll('tr')].find(t => /Neurotoxin Recovery/.test(t.textContent));
    assert(/Gemerkt/.test(row.querySelector('.tsc-track .btn').textContent), 'Vorschlag zeigt „Gemerkt“');
    assert($('tsc-view-trades').textContent === 'Meine Trades (1)', 'Zähler am Reiter');
    row.querySelector('.tsc-track .btn').click(); await tick(300);
    assert(!$('trades-view').hidden, 'Klick auf „Gemerkt“ öffnet Meine Trades');
    const stored = w.localStorage.getItem('eve-zentrale-trades-v1');
    w.close();

    // --- Neuer Tag: Markt hat sich geändert, Trade ist noch da ---
    const created = JSON.parse(stored)[0].created;
    BOOK = [ ord(1001, true, 99520, 40, 5), ord(1001, false, 118000, 20, 5) ];
    MYORDERS = [ Object.assign(ord(1001, true, 99510, 70, 30), { volume_total: 120 }) ];
    TXS = [ { transaction_id: 1, date: iso(created + 60000), type_id: 1001, quantity: 50, unit_price: 99510, is_buy: true, location_id: JITA } ];
    w = makeWindow({ 'eve-zentrale-trades-v1': stored, 'eve-zentrale-trading-view': 'trades' });
    d = w.document; T = w.__test;
    const $$ = id => d.getElementById(id);
    await tick(1200);
    assert(!$$('trades-view').hidden, 'Ansicht bleibt nach Neustart');
    let card = $$('trades-list').querySelector('.tr-card');
    assert(card && /Neurotoxin Recovery/.test(card.textContent), 'Trade nach Neustart noch da');
    assert(/Gekauft\s*50 \/ 120/.test(card.textContent) && /auf Lager\s*50/.test(card.textContent), 'Fortschritt aus Transaktionen: ' + card.querySelector('.tr-prog-txt').textContent);
    assert(/kaufen \+ verkaufen/.test(card.textContent), 'Phase: kaufen und verkaufen gleichzeitig');
    assert(/Geplanter Preis\s*99\.510/.test(card.textContent) && /Geplanter Preis\s*120\.200/.test(card.textContent), 'geplante Preise bleiben sichtbar');
    assert(/Überboten – neuer Preis\s*99\.530/.test(card.textContent), 'eigene Kauforder überboten, neuer Preis: ' + card.textContent.match(/Überboten[^N]*/));
    assert(/Noch zu kaufen\s*70/.test(card.textContent), 'Restmenge');
    assert(card.classList.contains('tr-ob') && w.document.querySelector('#tro-body .trk-sm.trk-ob'), 'U8: überbotene Kachel blinkt gelb (Meine Trades + Laufend-Box)');
    // U4: Preise je Karte und für alle
    assert(/Stand \d\d:\d\d/.test(card.querySelector('.tr-upd').textContent) && ![...card.querySelectorAll('button')].some(b => b.textContent === 'Preise aktualisieren'), 'U4/BB31: Stand je Karte, kein eigener Knopf (oben „alle“)');
    const ovb = w.document.createElement('div'); T.ovRenderViewInto('trades', ovb);
    assert(ovb.querySelector('[data-ova="trUpd"][data-arg="all"]') && !ovb.querySelector('.ov-card [data-ova="trUpd"]:not([data-arg="all"])') && /Stand \d\d:\d\d/.test(ovb.textContent), 'U4/BB31: Trades-Overlay: nur „alle“, je Karte der Stand');
    await w.__test.trRefreshOne(w.__test.trLoad()[0].id); await tick(10);   // BB31: Einzel-Knopf weg, Funktion bleibt (nach „alle“)
    await tick(400);
    card = $$('trades-list').querySelector('.tr-card');
    assert(/Stand \d\d:\d\d/.test(card.querySelector('.tr-upd').textContent) && /Überboten – neuer Preis\s*99\.530/.test(card.textContent), 'U4: danach neu gerechnet, eigene Order bleibt bekannt');
    assert(w.document.getElementById('trk-prices') && w.document.querySelector('#tro-body .trk-sm'), 'U4/BB11: Watchlist: Preise aktualisieren für alle, Laufend als Schnellübersicht');
    assert(/Jetzt einstellen zu\s*117\.900/.test(card.textContent), 'aktueller Verkaufspreis einen Schritt unter dem Markt');
    assert(/Verkaufsorder\s*noch keine Verkaufsorder/.test(card.textContent), 'N3: Karte sagt klar, dass noch keine Verkaufsorder steht');
    // Mindestpreis: 99510*1.015/(1-0.015-0.03375) = 106.179,6 -> 106.200
    assert(/Nicht unter\s*106\.200/.test(card.textContent), 'Mindestverkaufspreis nach Gebühren');
    // Kopieren
    const lines = [...card.querySelectorAll('.tr-line')];
    const newBuy = lines.find(l => /Überboten/.test(l.textContent)).querySelector('.tsc-cp-b');
    newBuy.click(); await tick(20);
    assert(w.__clip() === '99530', 'neuer Kaufpreis kopierbar');
    lines.find(l => /Geplanter Preis/.test(l.textContent) && /120\.200/.test(l.textContent)).querySelector('.tsc-cp-b').click(); await tick(20);
    assert(w.__clip() === '120200', 'geplanter Verkaufspreis kopierbar');

    // Einkauf beenden
    [...card.querySelectorAll('button')].find(b => /Einkauf beenden/.test(b.textContent)).click(); await tick(50);
    card = $$('trades-list').querySelector('.tr-card');
    assert(!/1 · Kauforder/.test(card.textContent) && /Verkauf läuft/.test(card.textContent), 'nach „Einkauf beenden“ nur noch Verkauf');

    // Markt fällt unter Mindestpreis -> Warnung statt Preisvorschlag
    BOOK = [ ord(1001, true, 99000, 40, 5), ord(1001, false, 104000, 20, 5) ];
    await T.tscShowView('scan'); await tick(10);
    $$('tsc-view-trades').click(); await tick(50);
    $$('trades-refresh').click(); await tick(800);
    card = $$('trades-list').querySelector('.tr-card');
    assert(/unter deinem Mindestpreis/.test(card.textContent) && !/Jetzt einstellen zu/.test(card.textContent), 'Warnung bei Preis unter Mindestpreis');

    // Alles verkauft -> Abschließen
    BOOK = [ ord(1001, true, 99000, 40, 5), ord(1001, false, 120300, 20, 5) ];
    TXS.push({ transaction_id: 2, date: iso(Date.now()), type_id: 1001, quantity: 50, unit_price: 120200, is_buy: false, location_id: JITA });
    MYORDERS = [];
    $$('trades-refresh').click(); await tick(800);
    // alles verkauft -> automatisch erledigt (vorher Knopf „Abschließen“)
    assert(/omplett verkauft → erledigt/.test($$('trades-status').textContent) && JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1'))[0].finalResult > 0, 'alles verkauft -> automatisch erledigt, Ergebnis gespeichert');
    assert(!$$('trades-list').querySelector('.tr-card') && $$('tsc-view-trades').textContent === 'Meine Trades', 'erledigter Trade ausgeblendet, Zähler 0');
    $$('trades-tabs').querySelector('[data-trv="done"]').click(); await tick(20);
    card = $$('trades-list').querySelector('.tr-card');
    assert(card && card.classList.contains('done') && /erledigt/.test(card.textContent), 'Erledigte zeigbar');
    assert(card.classList.contains('tr-ok') && !card.classList.contains('tr-ob'), 'U8: erledigte Kachel grün umrandet');
    // I6: erledigten Trade wieder öffnen
    [...card.querySelectorAll('button')].find(b => /Wieder öffnen/.test(b.textContent)).click(); await tick(20);
    assert($$('tsc-view-trades').textContent === 'Meine Trades (1)', 'I6: erledigter Trade wieder aktiv');
    $$('trades-tabs').querySelector('[data-trv="active"]').click(); await tick(20);
    [...$$('trades-list').querySelector('.tr-card').querySelectorAll('button')].find(b => /Erledigt|Abschließen/.test(b.textContent)).click(); await tick(20);
    // BB10: Löschen (nur im Verlauf) → Papierkorb, ohne Nachfrage
    const del = () => [...$$('trades-list').querySelector('.tr-card').querySelectorAll('button')].find(b => /Löschen/.test(b.textContent));
    $$('trades-tabs').querySelector('[data-trv="done"]').click(); await tick(20);
    del().click(); await tick(20);
    assert(!$$('trades-list').querySelector('.tr-card') && JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).length === 0 && JSON.parse(w.localStorage.getItem('eve-zentrale-trash-v1')).length === 1, 'BB10: Löschen → Papierkorb');

    // --- Automatisch erkannte Kaufaufträge ---
    $$('trades-tabs').querySelector('[data-trv="active"]').click(); await tick(20);
    BOOK = [ ord(1002, true, 30340000, 3, 50), ord(1002, false, 39000000, 2, 50) ];
    const AUTO = Object.assign(ord(1002, true, 30350000, 4, 3), { volume_total: 4, volume_remain: 3 });
    MYORDERS = [ AUTO ];
    $$('trades-refresh').click(); await tick(900);
    let list = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1'));
    const at = list.find(t => t.tid === 1002);
    assert(at && at.auto && at.buyOrderId === AUTO.order_id && at.qty === 4 && at.buy === 30350000 && at.charId === '111', 'eingestellter Kaufauftrag automatisch als Trade aufgenommen');
    assert(at.sell === 38990000 && at.unit > 0, 'Zielpreis aus dem aktuellen Markt: ' + at.sell);
    assert(/neuer Kaufauftrag erkannt/.test($$('trades-status').textContent), 'Hinweis auf erkannten Auftrag: ' + $$('trades-status').textContent);
    card = $$('trades-list').querySelector('.tr-card');
    assert(/automatisch erkannt/.test(card.textContent) && /Gekauft\s*1 \/ 4/.test(card.textContent), 'Fortschritt aus der Order (1 von 4 gefüllt)');
    assert(/Deine Order/.test(card.textContent) && /vorne/.test(card.textContent), 'eigene Order vorne');
    assert($$('tsc-view-trades').textContent === 'Meine Trades (1)', 'Zähler zählt automatische Trades');
    // Zweites Aktualisieren legt ihn nicht doppelt an
    $$('trades-refresh').click(); await tick(900);
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).filter(t => t.tid === 1002).length === 1, 'kein Doppelter');
    // Auftrag vollständig ausgeführt -> verschwindet -> Einkauf vorbei, Verkauf läuft
    MYORDERS = [];
    TXS.push({ transaction_id: 3, date: iso(Date.now()), type_id: 1002, quantity: 4, unit_price: 30350000, is_buy: true, location_id: JITA });
    $$('trades-refresh').click(); await tick(900);
    card = $$('trades-list').querySelector('.tr-card');
    assert(/Verkauf läuft/.test(card.textContent) && /Menge im Hangar\s*4/.test(card.textContent), 'Order ausgeführt -> Verkaufsphase');
    // I6: Abbrechen schiebt den Trade in den Verlauf, die Order kommt nicht als neuer Trade wieder
    MYORDERS = [ AUTO ];
    const cancel = () => [...$$('trades-list').querySelector('.tr-card').querySelectorAll('button')].find(b => /Abbrechen/.test(b.textContent));
    cancel().click(); await tick(20);
    $$('trades-refresh').click(); await tick(900);
    list = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).filter(t => t.tid === 1002);
    assert(list.length === 1 && list[0].status === 'done' && list[0].cancelled, 'I6: abgebrochener Auftrag im Verlauf, nicht erneut aufgenommen');
    $$('trades-tabs').querySelector('[data-trv="done"]').click(); await tick(20);
    assert(!$$('trades-list').querySelector('.tr-card'), 'AL3: abgebrochener nicht unter Erledigt');
    $$('trades-tabs').querySelector('[data-trv="cancelled"]').click(); await tick(20);
    card = $$('trades-list').querySelector('.tr-card');
    assert(/abgebrochen/.test(card.textContent), 'I6: als abgebrochen markiert');
    [...card.querySelectorAll('button')].find(b => /Wieder öffnen/.test(b.textContent)).click(); await tick(20);
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).find(t => t.tid === 1002).status === 'active', 'I6: abgebrochener Trade wieder aktivierbar');
    $$('trades-tabs').querySelector('[data-trv="active"]').click(); await tick(20);
    cancel().click(); await tick(20);
    // Scanner-Vorschlag + Kaufauftrag in EVE ohne Merken -> Plan wird übernommen
    BOOK = [ ord(1001, true, 99500, 50), ord(1001, false, 120300, 30), ord(1001, false, 121000, 10) ];
    MYORDERS = [];
    await T.runTradeScan(); await tick(300);
    const PLANORDER = Object.assign(ord(1001, true, 99510, 120, 1), { volume_total: 120 });
    MYORDERS = [ PLANORDER ];
    await T.runTradeScan(); await tick(600);
    list = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1'));
    const pt = list.find(t => t.tid === 1001 && t.status === 'active');
    assert(pt && pt.auto && pt.fromPlan && pt.sell === 120200, 'Kaufauftrag zu einem Vorschlag übernimmt dessen Plan (Zielpreis 120.200)');
    assert(/Kaufauftrag erkannt/.test($$('tsc-status').textContent), 'Hinweis auch im Scanner: ' + $$('tsc-status').textContent);
    w.close();
    console.log('\nALL TRADES TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
