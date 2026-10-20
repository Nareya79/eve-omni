// AL10 (20.10.2026): Unterreiter aller Bereiche im Hauptfenster als Liste links (.al-nav), im Overlay und bei schmalem Fenster wie bisher oben.
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    assert(/@media \(min-width: 760px\)\{\nsection\.panel:has\(\.al-nav\)/.test(html), 'CSS: Liste links nur im Hauptfenster und ab 760 px Breite');
    const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'de'); });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
    const chk = id => p.evaluate(id => { const k = document.getElementById('neo-btn-' + id); k.hidden = false; k.click();
      const pn = document.querySelector('section.panel.active'), n = [...pn.querySelectorAll('.al-nav')].find(x => x.getClientRects().length);
      if (!n) return { id, none: true };
      const r = n.getBoundingClientRect(), pr = pn.getBoundingClientRect(), btns = [...n.querySelectorAll('button')].filter(x => x.getClientRects().length);
      return { id, inPanel: n.offsetParent === pn, col: getComputedStyle(n).flexDirection, left: Math.round(r.left - pr.left), pad: parseFloat(getComputedStyle(pn).paddingLeft),
        stacked: btns.every((x, i) => !i || x.getBoundingClientRect().top > btns[i - 1].getBoundingClientRect().top), n: btns.length }; }, id);
    for (const id of ['station', 'haul', 'track', 'contracts', 'wallet', 'fits', 'industry', 'jump', 'chars', 'settings']){
      const r = await chk(id);
      assert(!r.none && r.inPanel && r.col === 'column' && r.left === 0 && r.pad >= 170 && r.stacked && r.n >= 1, id + ': Unterreiter als Liste links ' + JSON.stringify(r));
    }
    // Aktionen bleiben oben, nur Reiter wandern nach links
    const act = await p.evaluate(() => ['trk-refresh', 'trk-check', 'ch-all-open', 'ch-refresh'].map(id => !document.getElementById(id).closest('.al-nav')));
    assert(act.every(Boolean), 'Watchlist/Charaktere: Knöpfe wie „Alle prüfen“, „alle aufklappen“ bleiben oben');
    const tab = await p.evaluate(() => { document.getElementById('neo-btn-track').click(); document.querySelector('[data-trk="done"]').click(); return document.querySelector('[data-trk="done"]').getAttribute('aria-selected'); });
    assert(tab === 'true', 'Klick auf einen Reiter links wählt ihn');
    // schmales Fenster: wie bisher oben
    await p.setViewportSize({ width: 700, height: 900 });
    const narrow = await p.evaluate(() => { document.getElementById('neo-btn-wallet').click(); const n = document.querySelector('#panel-wallet .al-nav'); return getComputedStyle(n).position + '/' + getComputedStyle(n).flexDirection; });
    assert(narrow === 'static/row', 'schmales Fenster: Reiter oben in einer Zeile (' + narrow + ')');
    // Overlay unverändert
    await p.setViewportSize({ width: 330, height: 900 });
    const ov = await p.evaluate(() => { const T = window.__test; T.ovSetMode('compact'); const s = T.ovLoad(); s.views = s.views.filter(x => x.id !== 'mining').concat([{ id: 'mining', on: true }]); s.view = 'mining'; T.ovSave(s); T.ovRender();
      const n = document.querySelector('#ov-body .al-nav'); return n ? getComputedStyle(n).position : 'fehlt'; });
    assert(ov === 'static', 'Overlay Mining: Reiter bleiben oben (' + ov + ')');
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('\nALL AL10 TESTS PASSED');
  }catch(e){ console.error(e); process.exitCode = 1; }
  finally{ await b.close(); }
})();
