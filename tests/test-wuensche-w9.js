// W9 (26.09.2026): Schmuggelware kennzeichnen + Route durch Zoll-Highsec warnen
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
// Jita (Caldari, 0.9) → Perimeter (Caldari, 1.0) → Niarja (Amarr, 0.5) → Amarr (Amarr, 1.0); Station 1 in Jita, Station 2 in Amarr
const SYS = { 30000142: ['Jita', 0.946, 500001], 30000144: ['Perimeter', 0.95, 500001], 30003504: ['Niarja', 0.5, 500003], 30002187: ['Amarr', 1.0, 500003] };
const json = (x, st) => Promise.resolve({ ok: (st || 200) < 300, status: st || 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u);
      if (/\/universe\/stations\/60003760/.test(u)) return json({ system_id: 30000142 });
      if (/\/universe\/stations\/60008494/.test(u)) return json({ system_id: 30002187 });
      if (/\/route\//.test(u)) return json({ route: [30000142, 30000144, 30003504, 30002187] });
      const m = u.match(/\/universe\/systems\/(\d+)/); if (m) return json({ name: SYS[m[1]][0], security_status: SYS[m[1]][1], constellation_id: 1 });
      if (/\/universe\/constellations\//.test(u)) return json({ region_id: 10000002 });
      if (/sovereignty\/map/.test(u)) return json(Object.keys(SYS).map(id => ({ system_id: +id, faction_id: SYS[id][2] })));
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(700);
    const T = w.__test, d = w.document;
    // Kennzeichen neben dem Markt-Knopf
    const box = d.createElement('div'); box.appendChild(T.mkBtn(3721)); box.appendChild(T.mkBtn(34));
    const tags = box.querySelectorAll('.ct-tag');
    assert(tags.length === 1 && box.querySelectorAll('.mk-btn[data-mk]').length === 2, 'W9: nur Slaves bekommt das rote Kennzeichen, Markt-Knopf bleibt');
    assert(/Caldari: Strafe 5 % vom Wert, −0.2 Ansehen/.test(tags[0].title) && /Minmatar/.test(tags[0].title), 'W9: Tooltip nennt Fraktion und Folgen');
    // Route: Slaves (Caldari verbietet überall) → 2 Caldari-Highsec-Systeme; Small Arms (Amarr ab 0.5) → Niarja + Amarr
    const l = await T.ctRoute(60003760, 60008494, [{ tid: 3721, name: 'Slaves' }, { tid: 9844, name: 'Small Arms' }, { tid: 34, name: 'Tritanium' }]);
    assert(l.some(x => /^Slaves: in Caldari-Highsec verboten – Route führt durch 2 Caldari-Highsec-Systeme$/.test(x)), 'W9: Slaves → 2 Caldari-Systeme: ' + l.join(' | '));
    assert(l.some(x => /^Small Arms: in Amarr-Highsec .* 2 Amarr-Highsec-Systeme$/.test(x)) && !l.some(x => /Tritanium/.test(x)), 'W9: Small Arms → 2 Amarr-Systeme, legale Ware ohne Warnung');
    assert((await T.ctRoute(60003760, 60008494, [{ tid: 34, name: 'Tritanium' }])).length === 0, 'W9: ohne Schmuggelware keine Prüfung');
    // gemerkter Lauf zeigt die Warnung ohne Aufklappen
    const f = T.hrDetail({ id: 'r', from: 60003760, fromName: 'Jita IV', to: 60008494, toName: 'Amarr VIII', items: [{ tid: 3721, name: 'Slaves', q: 24, sp: 1000, p: 500 }] });
    const host = d.createElement('div'); host.appendChild(f); await tick(200);
    const wn = host.querySelector('.ct-warn');
    assert(wn && wn.style.display !== 'none' && /Schmuggelware auf der Route: Slaves/.test(wn.textContent) && host.querySelector('.ct-tag'), 'W9: Lauf warnt vor der Route und kennzeichnet die Ware');
    console.log('\nALL WUENSCHE-W9 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
