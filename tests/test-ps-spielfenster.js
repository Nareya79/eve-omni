// PS (12.10.2026): OmniBreaker-Overlay – Level-Anzeige nie abgeschnitten („12/100“: Zahl groß, „/100“ klein, Schrift schrumpft),
// Spielfenster hält 9:16 (4.0; nach jeder Größenänderung, nie höher als der Bildschirm). Live geprüft per CDP (siehe UEBERGABE.md).
const fs = require('fs');
const { chromium } = require('playwright');
const main = fs.readFileSync('/home/claude/main.js', 'utf8');
let ok = 0, bad = 0;
function assert(c, m){ if (c){ ok++; console.log('OK:', m); } else { bad++; console.log('FAIL:', m); } }
(async () => {
  assert(/if \(id === 'spiel' && !w\.__fit\)\{[^\n]*w\.on\('resize'[^\n]*spielFit\(w\)/.test(main), 'Spielfenster: nach jeder Größenänderung einpassen');
  assert((() => { const f = (main.match(/function spielFit\(w\)\{[\s\S]*?\n\}/) || [''])[0]; return /\/ 0\.5625 \+ exH/.test(f) && /workArea/.test(f) && /\* 0\.5625 \+ exW/.test(f); })(), 'spielFit: Höhe = Breite / 0,5625 (9:16) + Kopfleiste, bei zu hoch schmaler');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } }), errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
  await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(800);
  for (const w of [260, 360, 520]) {
    const r = await p.evaluate(async w => {
      const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + Math.round(w * 16 / 9) + 'px;z-index:99999'; document.body.appendChild(box);
      const c = window.EVEOmniBreaker.mountWindow(box); await new Promise(r => setTimeout(r, 300));
      c.game.resumeCampaign(150, 0); await new Promise(r => setTimeout(r, 300));
      const lv = box.querySelector('.ob-s-level b'), of = lv.querySelector('.ob-of');
      const res = { t: lv.textContent, of: of && of.textContent, fit: lv.scrollWidth <= lv.clientWidth + 1 };
      c.destroy(); box.remove(); return res;
    }, w);
    assert(r.t === '150/150' && r.of === '/150' && r.fit, 'Fenster ' + w + ' px: „150/150“ passt, „/150“ klein (' + JSON.stringify(r) + ')');
  }
  assert(!errs.length, 'keine Fehler ' + errs.join(' | '));
  await b.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})().catch(e => { console.error(e); console.log('FAILED'); process.exit(1); });
