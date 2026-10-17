// AA10 (27.09.2026): Versicherungsrechner – je Schiff in den Assets (groß + Overlay) Kosten, Auszahlung, Verlust netto, lohnt ab
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const INS = [{ type_id: 24698, levels: [{ name: 'Platinum', cost: 15e6, payout: 50e6 }, { name: 'Basic', cost: 2.5e6, payout: 20e6 }, { name: 'Gold', cost: 10e6, payout: 42e6 }] }];
let calls = 0;
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = u => /insurance\/prices/.test(u) ? (calls++, Promise.resolve({ ok: true, json: () => Promise.resolve(INS) })) : Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const ship = (id, tid, nm, val, fv) => ({ tid, name: nm, qty: 1, estValue: val, vol: 15000, ship: { id, nm: '', eft: '', fv, sl: [] } });
    T.asRender({ v: true, v2: 1, n: 1, g: [{ cid: '111', name: 'Eins', locs: [{ id: '60003760', name: 'Jita IV - Moon 4', sys: null, st: null,
      rows: [ship(1, 24698, 'Drake', 50e6, 20e6), ship(2, 999, 'Shuttle X', 1e5, 0)] }] }] });
    d.querySelector('#as-body [data-ova="asShip"][data-arg="s1"]').click(); await tick(100);
    let ins = d.querySelector('#as-body .as-ins');
    assert(ins && calls === 1, 'Schiff aufgeklappt: Versicherung geladen (ESI /insurance/prices/)');
    const rows = [...ins.querySelectorAll('tr')].slice(1).map(r => [...r.cells].map(c => c.textContent));
    assert(rows.map(r => r[0]).join(',') === 'ohne,Basis,Gold,Platin', 'Stufen deutsch, nach Auszahlung sortiert, dazu „ohne“');
    const plat = rows[3];
    assert(/15/.test(plat[1]) && /50/.test(plat[2]), 'Platin: Kosten 15 Mio., Auszahlung 50 Mio.');
    assert(/35/.test(plat[3]) && /70/.test(rows[0][3]) && /52/.test(rows[1][3]), 'Verlust netto = Schiff 50 + Fitting 20 − Auszahlung + Kosten (ohne 70, Basis 52,5, Platin 35)');
    assert(plat[4] === '30 %' && rows[1][4] === '13 %', '„lohnt ab“ = Kosten ÷ Auszahlung');
    assert(ins.querySelector('tr.best') && /Platin/.test(ins.querySelector('tr.best').textContent) && /deckt 50 %/.test(ins.textContent), 'beste Stufe grün, deckt 50 % des Werts');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-insurance-v1')).p[24698].length === 3, 'Preise gemerkt in eve-zentrale-insurance-v1');
    // Overlay: gleiche Anzeige im Assets-Overlay
    const b = d.createElement('div'); T.ovRenderViewInto('assets', b);
    assert(b.querySelector('.as-ins tr.best'), 'Assets-Overlay: Versicherung beim aufgeklappten Schiff');
    // nicht versicherbar, ohne Wert, kein zweiter Abruf
    assert(/nicht versicherbar/.test(T.insHtml(999, 1e5, 0)) && /Schiff \?/.test(T.insHtml(24698, null, null)) && calls === 1, 'nicht versicherbar / ohne Preise geladen; Preise nur einmal am Tag abgerufen');
    console.log('\nALL AA10 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
