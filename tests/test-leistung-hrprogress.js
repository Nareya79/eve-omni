// Leistung (20.10.2026): hrProgress merkt sein Ergebnis je Lauf, solange nichts geändert ist – nach Speichern (Läufe, Buchungen) oder einer Eingabe wird neu gerechnet.
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const NOW = Date.now(), H = 3600000;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(a => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'de');
      localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([{ id: 'r1', from: 60003760, fromName: 'Jita IV - Moon 4', to: 60008494, toName: 'Amarr VIII (Oris)', charId: '9000001', charName: 'Testa Lauf',
        items: [{ tid: 2048, name: 'Damage Control II', q: 10, sp: 1e7, p: 2e6 }], created: a.now - 3 * a.H, status: 'active' }])); }, { now: NOW, H });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1000);
    const r = await p.evaluate(a => { const T = window.__test, run = () => T.hrLoad()[0];
      const g1 = T.hrProgress(run()), same = T.hrProgress(run()) === g1;
      // Buchungen speichern (Kauf 10 Stück am Start) → neu rechnen, im selben Durchlauf
      T.pnlSaveStore('9000001', { tx: { k1: [a.now - a.H, 2048, 10, 1e6, true, 60003760] }, fee: {}, ord: {}, upd: a.now });
      const g2 = T.hrProgress(run());
      // Lauf ändern (Planmenge) → neu rechnen
      const l = T.hrLoad(); l[0].items[0].q = 20; localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify(l));
      const g3 = T.hrProgress(run());
      return { same, b1: g1.bought, b2: g2.bought, plan3: g3.plan, newObj: g2 !== g1 && g3 !== g2 }; }, { now: NOW, H });
    assert(r.same, 'zweimal gleicher Lauf ohne Änderung → gemerktes Ergebnis');
    assert(r.b1 === 0 && r.b2 === 10 && r.newObj, 'nach pnlSaveStore sofort neu gerechnet (gekauft ' + r.b1 + ' → ' + r.b2 + ')');
    assert(r.plan3 === 20, 'geänderter Lauf → neu gerechnet (Plan ' + r.plan3 + ')');
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('\nALL HRPROGRESS MEMO TESTS PASSED');
  }catch(e){ console.error(e); process.exitCode = 1; }
  finally{ await b.close(); }
})();
