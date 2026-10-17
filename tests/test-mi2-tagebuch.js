// MI2 (30.09.2026): Mining-Tagebuch – ESI-Ledger je Charakter, lokal länger gemerkt (Menge je Tag ersetzt), Wert heute wie im Erz-Rechner,
// Summen heute/7 Tage/Zeitraum, Balken je Tag, Hauptfenster (Tabelle je Tag) + Overlay (Heute je Charakter), fehlende Freigabe, AA6-Bericht
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const day = o => new Date(Date.now() - o * 864e5).toISOString().slice(0, 10);
const JWT = scopes => 'x.' + Buffer.from(JSON.stringify({ scp: scopes })).toString('base64') + '.y';
let ledger = { 111: [{ date: day(0), solar_system_id: 30000142, type_id: 1230, quantity: 1000 }, { date: day(2), solar_system_id: 30000142, type_id: 1230, quantity: 5000 }] };
const JITA = 60003760;
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: k => /x-pages/i.test(k) ? '1' : null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
    { access_token: JWT(['esi-industry.read_character_mining.v1', 'esi-wallet.read_character_wallet.v1']), refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' },
    { access_token: JWT(['esi-wallet.read_character_wallet.v1']), refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '222', character_name: 'Zwei' }]));
  // alter Tag (vor 40 Tagen) ist schon gemerkt – EVE liefert ihn nicht mehr
  x.localStorage.setItem('eve-zentrale-miningledger-v1', JSON.stringify({ e: { ['111|' + day(40) + '|30000142|1230']: ['111', day(40), 30000142, 1230, 2000] }, cn: { 111: 'Eins' } }));
  x.fetch = (u, o) => { u = String(u); let m;
    if ((m = /characters\/(\d+)\/mining\//.exec(u))) return json(ledger[m[1]] || []);
    if (/universe\/systems\/30000142/.test(u)) return json({ name: 'Jita', security_status: 0.95, constellation_id: 20000020 });
    if (/universe\/constellations\//.test(u)) return json({ region_id: 10000002 });
    if (/universe\/names/.test(u)) return json([{ id: 10000002, name: 'The Forge' }]);
    if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))){ const p = { 1230: 20, 62516: 22, 34: 4 }[m[1]]; return json(p ? [{ is_buy_order: true, location_id: JITA, system_id: 30000142, range: 'station', price: p, volume_remain: 1e9, min_volume: 1 }] : []); }
    return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const tax = T.tscFees(T.tscReadCfg()).tax;
    // Hauptfenster: Mining › Tagebuch per Klick → lädt selbst
    $('neo-btn-mining').click(); await tick(100);
    d.querySelector('#mi-page [data-ova="miView"][data-arg="log"]').click(); await tick(400);
    let st = JSON.parse(w.localStorage.getItem('eve-zentrale-miningledger-v1'));
    assert(Object.keys(st.e).length === 3 && st.t && st.miss === 1, 'MI2: Klick auf „Tagebuch“ lädt von EVE, alter Tag bleibt gemerkt, 1 Charakter ohne Freigabe');
    const pg = $('mi-page');
    assert(/Ohne Mining-Freigabe: Zwei/.test(pg.textContent), 'MI2: Hinweis für Charakter ohne Freigabe');
    const unit = 22 * (1 - tax);   // Veldspar: komprimiert am besten (22 > 20)
    assert(new RegExp('Heute ' + T.shortIsk(1000 * unit).replace(/[.]/g, '\\.')).test(pg.querySelector('.ml-sum').textContent), 'MI2: Heute = 1000 × Wert je Einheit (komprimiert, netto)');
    assert(pg.querySelectorAll('.ml-t tr.ml-dh').length === 2 && pg.querySelector('.ml-chart rect'), 'MI2: Tabelle je Tag (30 Tage: heute + vorgestern), Balken je Tag');
    // Zeitraum „alles“ zeigt auch den 40 Tage alten Eintrag
    d.querySelector('#mi-page [data-ova="mlDays"][data-arg="0"]').click(); await tick(50);
    assert(pg.querySelectorAll('.ml-t tr.ml-dh').length === 3, 'MI2: „alles“ zeigt auch gemerkte Tage älter als 30');
    // EVE zählt den Tag weiter hoch → Menge ersetzt, nicht addiert
    ledger[111][0].quantity = 1500;
    d.querySelector('#mi-page [data-ova="mlGo"]').click(); await tick(300);
    const rows = T.mlRows(day(0));
    assert(rows.length === 1 && rows[0].q === 1500 && near(rows[0].val, 1500 * unit) && near(rows[0].m3, 150), 'MI2: gleicher Tag/System/Erz wird ersetzt (1500), m³ und Wert');
    // Overlay: Heute je Charakter
    const box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    assert(/Heute abgebaut/.test(box.textContent) && box.querySelectorAll('.ml-row').length === 1 && /Eins/.test(box.querySelector('.ml-row').textContent) && /150 m³/.test(box.textContent), 'MI2: Overlay zeigt „Heute abgebaut“ je Charakter mit m³ und Wert');
    assert(!box.querySelector('.ml-t'), 'MI2: Tabelle nur im Hauptfenster');
    // AA6-Bericht
    const rep = T.nwReportRows(T.nwReport('w')).find(x => /^Mining/.test(x[0]));
    assert(rep && rep[1] === T.shortIsk((1500 + 5000) * unit), 'MI2: Wochenbericht zeigt Mining-Wert (heute + vorgestern)');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
