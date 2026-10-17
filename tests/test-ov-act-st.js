// 4.0.73: Routenzeile (.ov-act-st) direkt im Overlay-Inhalt füllte die ganze Höhe (flex:1 in der Spalte) → große Lücke vor „Alle Preise aktualisieren“.
// Echter Browser noetig (jsdom rechnet kein Layout). Start: node test-ov-act-st.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
  await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
  await page.goto('file:///home/claude/EVECore.html');
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const b = document.createElement('div'); b.className = 'ov-body'; b.style.cssText = 'position:fixed;top:0;left:0;width:680px;height:900px;z-index:99999';
    b.innerHTML = '<div class="ov-act"><button>Beste Ladung berechnen</button><span class="ov-act-st">Fertig.</span></div>' +
      '<div class="ov-act-st">Sicherste Route Jita → Dodixie: 15 Sprünge</div><div class="ov-l">Alle Preise aktualisieren</div>';
    document.body.appendChild(b);
    const st = b.children[1].getBoundingClientRect(), inBar = b.querySelector('.ov-act .ov-act-st').getBoundingClientRect();
    return { h: st.height, barW: inBar.width };
  });
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok ' : 'FAIL ') + m); if (!c) fails++; };
  ok(r.h < 40, 'Routenzeile im Overlay nur eine Zeile hoch: ' + r.h);
  ok(r.barW > 140, 'Statustext neben dem Knopf füllt weiter die Breite: ' + r.barW);
  await browser.close();
  console.log(fails ? '\nOV-ACT-ST TESTS FAILED' : '\nALL OV-ACT-ST TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
