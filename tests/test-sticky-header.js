// A1: Kopfzeile (header.top) bleibt beim Scrollen im Hauptfenster oben sichtbar.
// Echter Browser noetig (jsdom rechnet kein Layout). Start: node test-sticky-header.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  for (const [w, h, name] of [[1400, 700, 'breit'], [400, 700, 'handy']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));   // V2: Erststart-Assistent würde den Kopf verdecken
    await page.goto('file:///home/claude/EVECore.html');
    await page.waitForTimeout(600);
    // genug Inhalt erzwingen, damit die Seite scrollt
    await page.evaluate(() => { const d = document.createElement('div'); d.id = '__filler'; d.style.height = '5000px'; document.querySelector('.app-main').appendChild(d); });
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const hd = document.querySelector('header.top'), b = hd.getBoundingClientRect(), cs = getComputedStyle(hd);
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { y: window.scrollY, top: b.top, bottom: b.bottom, pos: cs.position, bg: cs.backgroundColor, onTop: hd.contains(hit) };
    });
    ok(r.y >= 1500, name + ': Seite ist gescrollt (' + r.y + ')');
    ok(r.pos === 'sticky', name + ': Kopf ist sticky');
    ok(Math.abs(r.top) < 1 && r.bottom > 20, name + ': Kopf klebt oben (top=' + r.top + ')');
    ok(r.onTop, name + ': Kopf liegt ueber dem Inhalt (nicht verdeckt)');
    ok(r.bg !== 'rgba(0, 0, 0, 0)', name + ': Kopf hat deckenden Hintergrund');
    await page.close();
  }
  await browser.close();
  console.log(fails ? '\n' + fails + ' STICKY-HEADER TESTS FAILED' : '\nALL STICKY-HEADER TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
