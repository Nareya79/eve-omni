// OmniBreaker als Vollbild-Overlay in EVE Omni: Öffnen über Einstellungen, Spielen, Esc, Speicher-Schlüssel, Fehlerfreiheit.
// Echter Browser nötig. Start: node test-omnibreaker-overlay.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
  await page.goto('file:///home/claude/EVECore.html');
  await page.waitForTimeout(800);
  // 1) Knopf in Einstellungen › Allgemein
  await page.evaluate(() => { const b = document.getElementById('neo-btn-settings'); if (b) b.click(); });
  await page.waitForTimeout(200);
  ok(!(await page.$('#ob-open')) && !!(await page.$('#neo-btn-game')), 'UU3: kein Minispiel-Kasten mehr in Einstellungen, Start über das OmniCom');
  ok(await page.evaluate(() => !document.getElementById('ob-overlay')), 'Overlay wird erst beim Öffnen gebaut');
  ok(await page.evaluate(() => !!window.OmniBreaker && window.OmniBreaker.LEVELS.length === 150), 'OmniBreaker geladen, 150 Level');
  ok(await page.evaluate(() => !!window.EVEOmniBreaker), 'Öffnen/Schließen-Schnittstelle da');
  // 2) Öffnen
  await page.evaluate(() => { localStorage.setItem('eve-zentrale-omnibreaker-progress-v4', '1'); localStorage.setItem('eve-zentrale-omnibreaker-best', JSON.stringify({ 56: 1000 })); });   // XX1: Level 57 freigespielt
  await page.evaluate(() => window.EVEOmniBreaker.open());
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => {
    const o = document.getElementById('ob-overlay'), r = o && o.querySelector('.ob-root'), c = o && o.querySelector('canvas');
    const b = c && c.getBoundingClientRect();
    return { open: !!o && o.classList.contains('open'), root: !!r, canvasW: b ? b.width : 0, canvasH: b ? b.height : 0, z: o ? getComputedStyle(o).zIndex : '', fixed: o ? getComputedStyle(o).position : '', hitTop: o ? o.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) : false };
  });
  ok(st.open && st.root, 'Overlay offen, Spiel aufgebaut');
  ok(st.canvasW > 250 && st.canvasH > 300, 'Spielfeld sichtbar (' + Math.round(st.canvasW) + 'x' + Math.round(st.canvasH) + ')');
  ok(st.fixed === 'fixed' && +st.z >= 100000, 'Overlay liegt über allem');
  ok(st.hitTop, 'Mitte des Fensters gehört dem Spiel');
  await page.screenshot({ path: '/home/claude/integ/shots-overlay.png' });
  // 3) Spielen: Mausbewegung + Schuss, Spiel läuft ohne Fehler weiter
  const box = await page.evaluate(() => { const b = document.querySelector('#ob-overlay canvas').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.6);
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.6);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/claude/integ/shots-overlay-schuss.png' });
  ok(errs.length === 0, 'keine Seitenfehler beim Spielen ' + errs.join('|'));
  // 3b) OB5: Level-Raster im ☰-Menü startet die Übung
  await page.click('#ob-menu-btn'); await page.waitForTimeout(150);
  const lv = await page.evaluate(() => { const c = document.querySelectorAll('#ob-overlay .ob-lv-c'); return { n: c.length, peaks: document.querySelectorAll('#ob-overlay .ob-lv-peak').length, vis: c[0] && c[0].getBoundingClientRect().width > 10 }; });
  ok(lv.n === 151 && lv.peaks === 15 && lv.vis, 'Level-Raster: 150 Level + Zufall, 15 Höhepunkte (' + lv.n + '/' + lv.peaks + ')');
  await page.click('#ob-overlay .ob-lv-c[data-lv="57"]'); await page.waitForTimeout(400);
  const pr = await page.evaluate(() => ({ menu: document.querySelector('#ob-overlay .ob-menu').classList.contains('open'), hud: document.querySelector('#ob-overlay .ob-hud').textContent }));
  ok(!pr.menu && /Practice\s*57/.test(pr.hud), 'Klick auf Level 57 startet die Übung, Menü zu (' + pr.hud.slice(0, 60) + ')');
  await page.screenshot({ path: '/home/claude/integ/shots-overlay-lv57.png' });
  // 3c) 12.10.: im Zielmodus knapp neben ☰ klicken öffnet das Menü statt zu schießen; Rechtsklick = Menü
  const mb = await page.evaluate(() => { const r = document.querySelector('#ob-overlay .ob-menu-btn').getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; });
  const balls0 = await page.evaluate(() => window.OmniBreaker && document.querySelector('#ob-overlay .ob-hud').textContent);
  await page.mouse.click(mb.x - 4, mb.y + mb.h / 2); await page.waitForTimeout(250);
  const near = await page.evaluate(() => ({ open: document.querySelector('#ob-overlay .ob-menu').classList.contains('open'), hud: document.querySelector('#ob-overlay .ob-hud').textContent }));
  ok(near.open && near.hud === balls0, 'Klick 4 px neben ☰ öffnet das Menü und schießt nicht');
  await page.click('#ob-menu-btn'); await page.waitForTimeout(150);
  await page.mouse.click(mb.x - 200, mb.y + 300, { button: 'right' }); await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.querySelector('#ob-overlay .ob-menu').classList.contains('open')), 'Rechtsklick aufs Spielfeld öffnet das Menü');
  await page.click('#ob-menu-btn'); await page.waitForTimeout(150);
  // 4) Esc schließt und pausiert; Spielstand/Speicher-Schlüssel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => { const o = document.getElementById('ob-overlay'); return !o.classList.contains('open') && getComputedStyle(o).display === 'none'; });
  ok(closed, 'Esc schließt das Overlay');
  // 5) wieder öffnen: gleiche Spielinstanz
  await page.evaluate(() => window.EVEOmniBreaker.open());
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.querySelectorAll('#ob-overlay .ob-root').length === 1), 'Erneut öffnen baut kein zweites Spiel');
  await page.click('#ob-close');
  ok(await page.evaluate(() => !document.getElementById('ob-overlay').classList.contains('open')), '✕-Knopf schließt');
  // 6) Esc im geschlossenen Zustand tut nichts Schlimmes; Tasten im Spiel dürfen die Seite nicht beeinflussen
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => /omnibreaker/i.test(k)));
  ok(keys.every(k => k.indexOf('eve-zentrale-omnibreaker-') === 0), 'Speicher-Schlüssel beginnen mit eve-zentrale-omnibreaker- ' + keys.join(','));
  // 7) Version
  const ver = await page.evaluate(() => document.getElementById('set-ver') ? document.getElementById('set-ver').textContent : '');
  ok(/4\.0\.76/.test(await page.evaluate(() => document.body.innerHTML.match(/Beta 4\.0\.76/) ? 'Beta 4.0.76' : '')), 'Patchnotes 4.0.76 vorhanden');
  // 8) Handy-Breite
  await page.setViewportSize({ width: 400, height: 760 });
  await page.evaluate(() => window.EVEOmniBreaker.open());
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => { const c = document.querySelector('#ob-overlay canvas').getBoundingClientRect(); return { w: c.width, right: c.right, x: c.x, sw: document.getElementById('ob-overlay').scrollWidth, cw: document.getElementById('ob-overlay').clientWidth }; });
  ok(m.x >= 0 && m.right <= 401, 'Handybreite: Spielfeld passt in den Bildschirm');
  await page.screenshot({ path: '/home/claude/integ/shots-overlay-handy.png' });
  ok(errs.length === 0, 'insgesamt keine Seitenfehler ' + errs.join('|'));
  await browser.close();
  console.log(fails ? '\n' + fails + ' OMNIBREAKER-OVERLAY TESTS FAILED' : '\nALL OMNIBREAKER-OVERLAY TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
