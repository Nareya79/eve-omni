// Abschnitt L (Wuensche vom 24.09.2026, 5. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now();
const RUN = { id: 'r1', from: 60003760, fromName: 'Jita IV - Caldari Navy', to: 60008494, toName: 'Amarr VIII - Emperor', charId: '111', charName: 'Taron',
  items: [{ tid: 34, name: 'Tritanium', q: 100, sp: 10, p: 500 }], created: now - 3600000, status: 'active' };
const PNL = { tx: { a: [now, 34, 100, 5, 1, 60003760], b: [now, 34, 100, 10, 0, 60008494] }, fee: {}, ord: {}, upd: now };
const TRADES = [{ id: 't1', name: 'Veldspar', status: 'done', done: now - 86400000, created: now - 2 * 86400000, finalResult: -12000 },
  { id: 't2', name: 'Abgebrochen', status: 'done', cancelled: true, done: now, created: now }];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([RUN]));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(PNL));
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TRADES)); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // L6: alles verkauft -> nach dem Aktualisieren automatisch erledigt, Ergebnis gespeichert
    await $('hr-refresh').onclick(); await tick(100);
    const r = JSON.parse(w.localStorage.getItem('eve-zentrale-haulruns-v1'))[0];
    assert(r.status === 'done' && r.doneAt && Math.round(r.res) > 0, 'L6: komplett verkaufter Lauf ist automatisch erledigt, mit Gewinn');
    assert(/omplett verkauft/.test($('hr-status').textContent), 'L6: Meldung beim Aktualisieren');
    // L2: Wallet-Liste „Erledigt“: Lauf (Gewinn) + Trade (Verlust), abgebrochener Trade fehlt
    const dl = T.doneList();
    assert(dl.length === 2 && /Jita IV → Amarr VIII/.test(dl[0].name) && dl[0].res > 0 && dl[1].res < 0 && $('wv-done-body').querySelector('b span'), 'L2/BB11: Erledigt (Lauf Gewinn, Trade Verlust, ohne Abgebrochene), Wallet zeigt nur die Summe');
    assert(/2 erledigt · Summe/.test($('wv-done-body').textContent), 'L2: Anzahl und Summe');
    // L4: Multibuy-Liste im Hub-Handel-Overlay
    const rows = [{ tid: 34, name: 'Tritanium', q: 500, sp: 1, p: 1, totalVol: 1, avgBuy: 1, avgSell: 2 }, { tid: 35, name: 'Pyerite', q: 20, sp: 1, p: 1, totalVol: 1, avgBuy: 1, avgSell: 2 }];
    T.setOvData({ hub: { t: now, src: { label: 'Jita (The Forge)', station: 1, stationName: 'Jita IV' }, dst: { label: 'Amarr (Domain)', station: 2, stationName: 'Amarr VIII' }, cargo: 10, rows: rows, profit: 1, spend: 1, volUsed: 1, strategy: 's' } });
    const ob = d.createElement('div'); T.ovRenderViewInto('hubhandel', ob);
    assert([].some.call(ob.querySelectorAll('.tsc-cp-b'), b => b.getAttribute('data-copy') === 'Tritanium 500\nPyerite 20'), 'L4: Hub-Handel-Overlay kopiert die Einkaufsliste für Multibuy');
    // L1/S13: Radar – Umkreis ueber Stargates (1 – 2 – 3), Gate-Camps laut zKillboard, Sicherheitsfilter, Sortierung
    const SYS = { 1: ['Aaa', 0.9, [101]], 2: ['Bbb', 0.3, [201, 202]], 3: ['Ccc', -0.2, [301]] }, GATE = { 101: 2, 201: 1, 202: 3, 301: 2 };
    const GNAME = { 50000201: 'Stargate (Aaa)', 50000301: 'Stargate (Bbb)' };
    const km = (loc, min, n, ship, wep, npc) => ({ killmail_time: new Date(now - min * 60000).toISOString(), zkb: { locationID: loc, npc: !!npc },
      attackers: Array.from({ length: n }, (_, i) => ({ character_id: 9000 + i, ship_type_id: ship, weapon_type_id: wep })) });
    const ZK = { 2: [km(50000201, 30, 2, 700, 800), km(40000001, 5, 1, 700, 800)],
      3: [1, 2, 3, 4, 5].map(i => km(50000301, i * 2, 12, 701, 801)).concat([km(50000301, 1, 1, 700, 800, true)]) };
    const ok = x => Promise.resolve({ ok: true, json: () => Promise.resolve(x) });
    w.fetch = (u, o) => { let m;
      if (/universe\/ids/.test(u)) return ok({ systems: [{ id: 1, name: 'Aaa' }] });
      if (/universe\/names/.test(u)) return ok(JSON.parse(o.body).map(id => ({ id, name: { 700: 'Rifter', 701: 'Onyx', 800: '200mm AutoCannon I', 801: 'Large EMP Smartbomb II' }[id] || 'X' })));
      if ((m = /systems\/(\d+)\//.exec(u))) return ok({ name: SYS[m[1]][0], security_status: SYS[m[1]][1], stargates: SYS[m[1]][2] });
      if ((m = /stargates\/(\d+)\//.exec(u))) return ok(GNAME[m[1]] ? { name: GNAME[m[1]] } : { destination: { system_id: GATE[m[1]] } });
      if (/system_kills/.test(u)) return ok([{ system_id: 2, ship_kills: 3, pod_kills: 1, npc_kills: 0 }, { system_id: 3, ship_kills: 5, pod_kills: 0, npc_kills: 7 }]);
      if (/system_jumps/.test(u)) return ok([]);
      if ((m = /solarSystemID\/(\d+)\/pastSeconds\/3600\//.exec(u))) return ok(ZK[m[1]] || []);
      return Promise.reject(new Error('offline')); };
    await T.ovSatAction('radar', { type: 'radarGo', form: { rsys: 'aaa', rr: '2' } }); await tick(200);
    const rb = d.createElement('div'); T.ovRenderViewInto('radar', rb);
    const rr = [...rb.querySelectorAll('.rad-r:not(.rad-h)')];
    const tx = rr.map(x => x.textContent);
    assert(rr.length === 2 && /^2j/.test(tx[0]) && /Ccc/.test(tx[0]) && /Bbb/.test(tx[0]) && /5\/1h$/.test(tx[0]) && /Bbb/.test(tx[1]) && /Aaa/.test(tx[1]) && /1\/1h$/.test(tx[1]), 'S13: Radar listet Gate-Camps nach Kills (ohne NPC-/Nicht-Gate-Kills): ' + tx.join(' | '));
    assert(/SMARTBOMB/.test(tx[0]) && /HIC/.test(tx[0]) && /BLOB/.test(tx[0]) && !/SMARTBOMB/.test(tx[1]), 'S13: Zusammensetzung SMARTBOMB / HIC / BLOB');
    assert(rr[0].classList.contains('hot') && !rr[1].classList.contains('hot'), 'S13: heißes Camp rot');
    assert(rr[0].querySelector('a[href="https://zkillboard.com/system/3/"]'), 'S1: Systemname öffnet zKillboard');
    assert(/2 Camps/.test(rb.textContent) && /3 Systeme gescannt/.test(rb.textContent), 'S13: Zusammenfassung');
    T.ovSatAction('radar', { type: 'radarSort', arg: 'near' });
    const rbn = d.createElement('div'); T.ovRenderViewInto('radar', rbn);
    assert(/^1j/.test(rbn.querySelector('.rad-r:not(.rad-h)').textContent), 'S13: Nächste zuerst');
    T.ovSatAction('radar', { type: 'radarSec', arg: 'null' });
    const rb2 = d.createElement('div'); T.ovRenderViewInto('radar', rb2);
    assert(rb2.querySelectorAll('.rad-r:not(.rad-h)').length === 1 && /Bbb/.test(rb2.textContent) && rb2.querySelector('[data-arg="null"]').getAttribute('aria-pressed') === 'false', 'L1: Nullsec ausgeblendet');
    // S1: Radar als dritter Reiter der Navigation
    T.ovSatAction('route', { type: 'navMode', arg: 'radar' });
    const nb = d.createElement('div'); T.ovRenderViewInto('route', nb);
    assert(nb.querySelector('[data-arg="radar"][aria-pressed="true"]') && nb.querySelector('.rad-r'), 'S1: Navigation zeigt den Radar-Reiter');
    T.ovSatAction('route', { type: 'navMode', arg: 'route' });
    // L3: Sprache – Deutsch bleibt unveraendert, Englisch uebersetzt feste und spaeter eingefuegte Texte
    assert(d.documentElement.lang === 'de' && $('ui-lang').value === 'de' && [...d.querySelectorAll('.opt-h')].some(x => x.textContent === 'Farbschema'), 'L3: Standard Deutsch');
    const e = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-lang-v1', 'en'); } }).window;
    await tick(700);
    const ed = e.document;
    assert(ed.documentElement.lang === 'en' && ed.getElementById('ui-lang').value === 'en', 'L3: Englisch gewählt');
    const hs = [...ed.querySelectorAll('.opt-h, .acc-h')].map(x => x.textContent);
    assert(hs.includes('Color scheme') && hs.includes('Language') && !hs.includes('Farbschema'), 'L3: Überschriften übersetzt');
    const sp = ed.createElement('span'); sp.textContent = ' Suchoptionen '; sp.title = 'Namen kopieren'; ed.body.appendChild(sp); await tick(50);
    assert(sp.textContent === ' Search options ' && sp.title === 'Copy name', 'L3: später eingefügter Text und Tooltip übersetzt');
    sp.textContent = 'Gewinn 123'; await tick(50);
    assert(sp.textContent === 'Profit 123', 'L3 (4.0.73): bekannte Stücke werden auch in zusammengesetzten Texten übersetzt');
    sp.textContent = 'Jita 4-4 Zz'; await tick(50);
    assert(sp.textContent === 'Jita 4-4 Zz', 'L3: Unbekanntes bleibt stehen');
    console.log('ALL L TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); console.log('L TESTS FAILED'); process.exit(1); }
})();
