// AA6 (27.09.2026): Vermögensverlauf je Tag + Wochen-/Monatsbericht – Wallet › Verlauf, Wallet-Overlay (Reiter „Bericht“, Kurve unter Gesamtwert)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), DAY = 864e5, day = t => new Date(t).toISOString().slice(0, 10);
const CHARS = [
  { access_token: 'a', refresh_token: 'r', expires_at: NOW + 3600000, character_id: '111', character_name: 'Taron Velkar' },
  { access_token: 'b', refresh_token: 'r', expires_at: NOW + 3600000, character_id: '222', character_name: 'Alt Char' }
];
// Verlauf: 40 Tage alt bis gestern, dazu ein Tag vor über 3 Jahren (fliegt raus)
const hist = { d: {}, n: { 111: 'Taron Velkar', 222: 'Alt Char' } };
for (let i = 40; i >= 1; i--) hist.d[day(NOW - i * DAY)] = { 111: [1e9 + (40 - i) * 1e7, 1e8, 0, 5e8, 0], 222: [2e8, 0, 5e7, 0, 0] };
hist.d[day(NOW - 1200 * DAY)] = { 111: [1, 0, 0, 0, 0] };
// Gewinn-Daten Charakter 111: Tritanium +1 Mio, Pyerite −200 Tsd. in den letzten 7 Tagen, alter Verkauf vor 20 Tagen
const pnl = { tx: {
    1: [NOW - 25 * DAY, 34, 1000, 1000, 1, 60003760], 2: [NOW - 3 * DAY, 34, 1000, 2000, 0, 60003760],
    3: [NOW - 25 * DAY, 35, 100, 5000, 1, 60003760], 4: [NOW - 2 * DAY, 35, 100, 3000, 0, 60003760],
    5: [NOW - 25 * DAY, 36, 10, 100, 1, 60003760], 6: [NOW - 20 * DAY, 36, 10, 500, 0, 60003760] },
  fee: { 10: [NOW - 3 * DAY, 't', 20000, 'market_transaction_id', 2], 11: [NOW - 4 * DAY, 'b', 5000, '', 0], 13: [NOW - 2 * DAY, 't', 9000, 'market_transaction_id', 4], 12: [NOW - 20 * DAY, 't', 100, 'market_transaction_id', 6] },
  ord: {}, upd: NOW };
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.localStorage.setItem('eve-zentrale-networth-v1', JSON.stringify(hist));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(pnl));
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    T.nwPnlSkip();
    // Stand heute: Overlay-Werte (ohne Assets) + Gesamtwert mit Assets
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.5e9, sell: 2e8, escrow: 1e7, d24: 0 }, { id: '222', name: 'Alt Char', bal: 3e8, sell: null, escrow: null, d24: null }] });
    T.nwSetNetWorth([{ id: '111', name: 'Taron Velkar', cash: 1.5e9, assetValue: 6e8 }, { id: '222', name: 'Alt Char', cash: 3e8, assetValue: null }]);
    assert(T.nwSnap() === true, 'AA6: Stand von heute gespeichert');
    let s = T.nwLoad(), t = s.d[day(NOW)];
    assert(JSON.stringify(t['111']) === JSON.stringify([1.5e9, 2e8, 1e7, 6e8, 0]), 'AA6: Charakter mit allen Werten: Kontostand, Verkauf, Treuhand, Assets, Läufe');
    assert(JSON.stringify(t['222']) === JSON.stringify([3e8, 0, 5e7, 0, 0]), 'AA6: fehlende Werte (keine Order-Berechtigung, Assets) vom letzten Tag übernommen');
    assert(!s.d[day(NOW - 1200 * DAY)] && s.d[day(NOW - 40 * DAY)], 'AA6: älter als 3 Jahre gelöscht, 40 Tage bleiben');
    // alter Wallet-Stand von gestern zählt nicht als heute
    T.owWalletSet({ t: NOW - DAY - 1000, list: [{ id: '111', name: 'Taron Velkar', bal: 1, sell: 0, escrow: 0 }] }); T.nwSetNetWorth([]);
    assert(T.nwSnap() === false && T.nwLoad().d[day(NOW)]['111'][0] === 1.5e9, 'AA6: Wallet-Stand von gestern überschreibt heute nicht');

    const s30 = T.nwSeries(30), s365 = T.nwSeries(365);
    assert(s30.length === 30 && s365.length === 41 && s30[29].tot === 1.5e9 + 2e8 + 1e7 + 6e8 + 3e8 + 5e7, 'AA6: Kurve 30 Tage = 30 Punkte, 1 Jahr = alle 41, heute Summe aller Teile');

    // Bericht
    const r = T.nwReport('w');
    assert(Math.round(r.profit) === 1000000 - 20000 - 200000 - 9000 - 5000 && r.rev === 2e6 + 3e5 && r.sales === 2, 'AA6: Woche: Gewinn netto 766 Tsd., Umsatz 2,3 Mio., 2 Verkäufe (' + r.profit + ')');
    assert(r.tax === 29000 && r.brk === 5000, 'AA6: Steuer + Broker aus dem Journal der Woche');
    assert(r.best.join() === '34' && r.worst.join() === '35', 'AA6: beste Ware Tritanium, schlechteste Pyerite');
    const exp = s365.find(x => x.d === day(NOW - 7 * DAY));
    assert(r.chg === s30[29].tot - exp.tot, 'AA6: Vermögensänderung seit 7 Tagen aus dem Verlauf');
    const m = T.nwReport('m');
    assert(m.sales === 3 && m.tax === 29100, 'AA6: Monat nimmt den Verkauf vor 20 Tagen mit');
    const txt = T.nwReportText('w');
    assert(/^Wochenbericht /.test(txt) && /Gewinn netto: \+766 Tsd\. ISK/.test(txt) && /Steuer: 29 Tsd\. ISK/.test(txt) && /Beste Waren: /.test(txt) && /Vermögensänderung: \+/.test(txt), 'AA6: Bericht als Text zum Kopieren:\n' + txt);

    // Hauptfenster: Wallet › Verlauf
    $('neo-btn-wallet') ? $('neo-btn-wallet').click() : T.switchTab('wallet');
    await tick(50);
    $('wv-view-hist').click(); await tick(50);
    const pg = $('nw-page');
    assert(!$('wv-hist-wrap').hidden && $('wv-overview-wrap').hidden && pg.querySelector('.nw-svg polyline') && pg.querySelector('.nw-rep'), 'AA6: Wallet › Verlauf zeigt Kurve + Bericht');
    assert(pg.querySelectorAll('.nw-card .ow-grid span').length === 5 && /Ware in Läufen/.test(pg.textContent), 'AA6: Aufteilung heute (5 Teile)');
    pg.querySelector('[data-ova="nwDays"][data-arg="365"]').click(); await tick(30);
    assert(pg.querySelector('[data-arg="365"][aria-pressed="true"]'), 'AA6: 1 Jahr wählbar');
    // 14.10.: Skala links + Daten unten + Hover
    const gl = [...pg.querySelectorAll('.nw-ch .nw-gl span')].map(x => x.textContent), xm = [...pg.querySelectorAll('.nw-xm span')].map(x => x.textContent);
    assert(gl.length === 4 && gl.every(x => / ISK$/.test(x)) && gl[0] !== gl[3], 'Skala: 4 Hilfslinien mit ISK (' + gl.join(' | ') + ')');
    assert(xm.length === 3 && xm.every(x => /^\d\d\.\d\d\.$/.test(x)), 'Skala: Anfang/Mitte/Ende als Datum (' + xm.join(' | ') + ')');
    const ch = pg.querySelector('.nw-ch'); ch.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 180 });
    ch.querySelector('svg').dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 399, clientY: 50 }));
    const tip = ch.querySelector('.nw-tip');
    assert(!tip.hidden && !ch.querySelector('.nw-hl').hidden && tip.textContent.includes(new Date(NOW).toISOString().slice(8, 10) + '.') && /Gesamt/.test(tip.textContent) && /zum Vortag/.test(tip.textContent) && /Kontostand.*Verkaufsorders.*Kauf \(Treuhand\).*Assets \(gesch\.\).*Ware in Läufen/.test(tip.textContent), 'Hover: Linie + Tooltip mit Datum, Gesamt, Vortag, 5 Teilen');
    d.body.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true }));
    assert(tip.hidden, 'Hover: außerhalb wieder weg');
    const ser100 = []; for (let i = 100; i >= 0; i--) ser100.push({ d: day(NOW - i * DAY), p: [i, 0, 0, 0, 0], tot: 1e9 + i });
    const big = d.createElement('div'); big.innerHTML = T.nwChart(ser100, 180);
    assert(big.querySelectorAll('.nw-xm span').length >= 3 && [...big.querySelectorAll('.nw-xm span')].every(x => /^(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)/.test(x.textContent)), 'Skala: lange Zeiträume mit Monatsnamen');
    assert(!/nw-gl/.test(T.nwChart(ser100, 34, true)), 'Mini-Kurve ohne Skala');
    pg.querySelector('[data-ova="nwPer"][data-arg="m"]').click(); await tick(30);
    assert(/^Monatsbericht/.test(pg.querySelector('.nw-rep .ov-name').textContent), 'AA6: Umschalten auf Monatsbericht');
    pg.querySelector('[data-ova="nwNote"]').click(); await tick(30);
    s = T.nwLoad();
    assert(s.note === true && s.rep === T.nwWeek(NOW) && /Meldung: an/.test(pg.textContent), 'AA6: Wochenbericht-Meldung einschaltbar (erste Meldung nächste Woche)');

    // Meldung zu Wochenbeginn: letzte Meldung vorige Woche → beim nächsten Stand kommt sie
    const sent = []; w.Notification = function(title, o){ sent.push([title, o.body]); }; w.Notification.permission = 'granted';
    s.rep = T.nwWeek(NOW - 7 * DAY); w.localStorage.setItem('eve-zentrale-networth-v1', JSON.stringify(s));
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.6e9, sell: 0, escrow: 0 }] }); T.nwSnap();
    assert(sent.length === 1 && /Wochenbericht/.test(sent[0][0]) && /Gewinn netto/.test(sent[0][1]) && T.nwLoad().rep === T.nwWeek(NOW), 'AA6: neue Woche → eine Meldung mit dem Bericht');
    T.nwSnap();
    assert(sent.length === 1, 'AA6: in derselben Woche keine zweite Meldung');

    // Overlay: Reiter „Bericht“ und Kurve unter Gesamtwert
    const view = () => { const b = d.createElement('div'); T.owView(b, false); return b; };
    w.localStorage.setItem('eve-zentrale-owview-v1', JSON.stringify({ tab: 'w' }));
    let b = view();
    assert(b.querySelector('.ow-tabs [data-arg="b"]') && b.querySelector('.ow-top .nw-spark svg polyline'), 'AA6: Overlay Wallets: Reiter „Bericht“ + kleine Kurve unter Gesamtwert');
    w.localStorage.setItem('eve-zentrale-owview-v1', JSON.stringify({ tab: 'b', nd: 90, per: 'w' }));
    b = view();
    assert(b.querySelector('.nw-card .nw-svg') && b.querySelector('[data-arg="90"][aria-pressed="true"]') && /Wochenbericht/.test(b.querySelector('.nw-rep').textContent) && b.querySelector('[data-ova="nwCopy"]'), 'AA6: Overlay Bericht: Kurve 90 Tage + Wochenbericht + Kopieren');
    T.ovSatAction('wallet', { type: 'nwPer', arg: 'm' });
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-owview-v1')).per === 'm', 'AA6: Overlay-Knöpfe (auch eigenes Fenster) laufen über ovSatAction');
    // Export nimmt den Verlauf mit
    assert(JSON.parse(w.EVECore.exportData(false)).data['eve-zentrale-networth-v1'], 'AA6: Verlauf ist im Export');
    console.log('\nALL AA6 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
