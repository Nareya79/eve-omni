// AA1 (30.09.2026): Kurier-Verträge-Scanner – öffentliche Kurierverträge je Region (Seiten, 30 Min. Cache), nur courier + nicht abgelaufen,
// Sprünge, niedrigste Sicherheit, Gank auf der Route, Collateral-/Struktur-Warnung, Filter, Sortierung ISK/Std., Hauptfenster + Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760, AMARR = 60008494, DODI = 60011866, KEEP = 1035466617946;
const DAY = 86400000, exp = d => new Date(Date.now() + d * DAY).toISOString();
const K = (id, from, to, rew, vol, col, e, type) => ({ contract_id: id, type: type || 'courier', start_location_id: from, end_location_id: to, reward: rew, volume: vol, collateral: col, days_to_complete: 3, date_expired: exp(e), date_issued: exp(-1), title: '' });
const P1 = [K(1, JITA, AMARR, 20e6, 10000, 100e6, 5), K(2, JITA, KEEP, 50e6, 5000, 3e9, 2), K(4, JITA, AMARR, 99e6, 10, 0, -1)];
const P2 = [K(3, JITA, DODI, 5e6, 900000, 0, 7), K(5, JITA, AMARR, 1e9, 1, 0, 7, 'item_exchange')];
const ST = { [JITA]: ['Jita IV - Moon 4 - Caldari Navy Assembly Plant', 30000142], [AMARR]: ['Amarr VIII (Oris) - Emperor Family Academy', 30002187], [DODI]: ['Dodixie IX - Moon 20 - Federation Navy Assembly Plant', 30002659] };
const SYS = { 30000142: ['Jita', 0.95], 30002768: ['Uedama', 0.5], 30002187: ['Amarr', 1.0], 30000144: ['Perimeter-X', 0.4], 30002659: ['Dodixie', 0.87] };
const RT = { '30000142:30002187': [30000142, 30002768, 30002187], '30000142:30002659': [30000142, 30000144, 30002659] };
let cCalls = 0;
const json = (x, hd) => Promise.resolve({ ok: true, status: 200, headers: { get: k => (hd || {})[String(k).toLowerCase()] || null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if ((m = /contracts\/public\/(\d+)\/.*page=(\d+)/.exec(u))){ cCalls++; if (m[1] !== '10000002') return Promise.resolve({ ok: true, status: 204, headers: { get: () => null }, json: () => Promise.resolve(null) }); return json(m[2] === '1' ? P1 : P2, { 'x-pages': '2' }); }
      if ((m = /universe\/stations\/(\d+)/.exec(u))) return ST[m[1]] ? json({ name: ST[m[1]][0], system_id: ST[m[1]][1], type_id: 1531 }) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      if ((m = /universe\/systems\/(\d+)/.exec(u))) return json({ name: SYS[m[1]][0], security_status: SYS[m[1]][1], constellation_id: 20000020 });
      if (/universe\/constellations\//.test(u)) return json({ region_id: 10000002 });
      if (/universe\/names/.test(u)) return json([{ id: 10000002, name: 'The Forge' }]);
      if ((m = /\/route\/(\d+)\/(\d+)/.exec(u))) return json({ route: RT[m[1] + ':' + m[2]] || [+m[1], +m[2]] });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    await T.coAction({ type: 'coGo' }); await tick(300);
    let D = T.coLoad(), L = D.last;
    assert(L && L.rows.length === 3 && L.n === 3 && cCalls === 2 + 4, 'AA1: beide Seiten der Region geladen, nur Kurier + nicht abgelaufen (3 von 5), andere Regionen leer');
    const r1 = L.rows.find(r => r.id === 1), r2 = L.rows.find(r => r.id === 2), r3 = L.rows.find(r => r.id === 3);
    assert(r1.j === 2 && r1.fsn === 'Jita' && r1.tsn === 'Amarr' && Math.abs(r1.sec - 0.5) < 1e-9 && r1.gank.indexOf('Uedama') >= 0, 'AA1: Sprünge, niedrigste Sicherheit und Gank-System auf der Route');
    assert(Math.abs(r1.iskh - 20e6 / (2 * 1 + 5) * 60) < 1, 'AA1: ISK/Std. wie T9 (1 Min./Sprung ohne Schiff + 5 Min.)');
    assert(r2.j === null && r2.tl > 1e12 && r2.iskh == null, 'AA1: Struktur ohne Zugriff – Sprünge unbekannt');
    assert(Math.abs(r3.sec - 0.4) < 1e-9, 'AA1: Lowsec auf der Route erkannt');
    let S = T.coShown(D).map(r => r.id).join(',');
    assert(S === '1,2', 'AA1: nur Highsec blendet Lowsec-Route aus, Standard-Sortierung ISK/Std. (unbekannt ans Ende): ' + S);
    await T.coAction({ type: 'coTog', arg: 'hs' });
    assert(T.coShown(T.coLoad()).length === 3, 'AA1: nur Highsec aus – alle 3');
    // Overlay
    const box = d.createElement('div'); T.ovRenderViewInto('courier', box);
    assert(box.querySelectorAll('.co-row').length === 3 && /⚠ Gank: Uedama/.test(box.textContent) && /⚠ Collateral 60× Belohnung/.test(box.textContent) && /⚠ Ziel Struktur/.test(box.textContent), 'AA1: Overlay mit Karten und Warnungen (Gank, Collateral, Struktur)');
    assert(box.querySelector('[data-ova="coEve"][data-arg="1"]') && box.querySelector('[data-ova="coRoute"][data-arg="1"]') && box.querySelector('[data-ova="coDest"][data-arg="2"]') && !box.querySelector('[data-ova="coRoute"][data-arg="2"]'), 'AA1: Knöpfe → EVE, Ziel, Route (Route nur mit bekannten Systemen)');
    assert(box.querySelector('[data-ova="coReg"][data-arg="10000043"][aria-pressed="true"]') && box.querySelector('[data-ova="coReg"][data-arg="10000016"][aria-pressed="false"]') && box.querySelector('.sort-bar[data-sort="courier"]'), 'AA1: Standard-Regionen an, Sortierleiste da');
    assert(box.querySelector('.co-row .tsc-cp-b[data-copy]'), 'AA1: Namen kopierbar');
    // Filter: Volumen, Sprünge, ISK/Sprung (Verträge aus dem Speicher, keine neuen Abfragen)
    await T.coAction({ type: 'coGo', form: { covol: '8.000', cocol: '', cojmax: '', coipj: '' } }); await tick(200);
    assert(T.coLoad().last.rows.map(r => r.id).join() === '2' && cCalls === 6, 'AA1: max. m³ filtert, Verträge 30 Min. im Speicher');
    await T.coAction({ type: 'coGo', form: { covol: '', cocol: '1.000.000.000', cojmax: '', coipj: '' } }); await tick(200);
    assert(T.coLoad().last.rows.map(r => r.id).sort().join() === '1,3', 'AA1: max. Collateral filtert');
    await T.coAction({ type: 'coGo', form: { covol: '', cocol: '', cojmax: '2', coipj: '5.000.000' } }); await tick(200);
    assert(T.coShown(T.coLoad()).map(r => r.id).join() === '1', 'AA1: max. Sprünge + min. ISK/Sprung');
    await T.coAction({ type: 'coGo', form: { cojmax: '', coipj: '' } }); await tick(200);
    T.sortClick('courier:rew');
    assert(T.coShown(T.coLoad()).map(r => r.id).join() === '2,1,3', 'AA1: nach Belohnung sortieren');
    await T.coAction({ type: 'coGo', arg: 'neu' }); await tick(200);
    assert(cCalls === 12, 'AA1: ↻ fragt neu bei EVE');
    await T.coAction({ type: 'coReg', arg: '10000043' });
    assert(T.coLoad().reg.indexOf(10000043) < 0, 'AA1: Region abwählbar');
    // Hauptfenster
    $('neo-btn-courier').click(); await tick(50);
    const pg = $('co-page');
    assert(pg && pg.querySelector('[data-ovf="covol"]') && pg.querySelectorAll('.co-row').length === 3, 'AA1: Seite im Hauptfenster mit Formular und Liste');
    assert(/OV_VIEWS = {[^}]*courier: "Kurier"/.test(html) && $('neo-btn-courier'), 'AA1: eigene Overlay-Ansicht + OmniCom-Knopf');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
