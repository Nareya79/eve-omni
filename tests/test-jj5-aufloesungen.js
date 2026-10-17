// JJ5: alle Seiten bei 1920x1080, 2560x1440, 3440x1440, 5120x1440, 3840x2160 je 100 % und 150 %, Deutsch + Englisch.
// Prueft automatisch: kein waagrechtes Scrollen, Kopfzeile nicht hoeher als 12 % des Fensters, nichts ragt rechts aus dem Fenster,
// kleinste sichtbare Schrift >= 10 px. Bilder je Aufloesung (Trading-Seite) nach /tmp/jj5-*.png. Echter Browser noetig (Layout).
const { chromium } = require('playwright');
const SIZES = [[1920, 1080], [2560, 1440], [3440, 1440], [5120, 1440], [3840, 2160]], ZOOMS = [1, 1.5], LANGS = ['de', 'en'];
const TABS = ['station', 'haul', 'track', 'wallet', 'assets', 'sell', 'orders', 'contracts', 'industry', 'mining', 'jump', 'intel', 'radar', 'wormhole', 'appraisal', 'courier', 'chars', 'skills', 'music', 'settings'];
const MIN_FONT = Number(process.env.JJ5_MINFONT || 10);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0, checks = 0; const smallest = {};
  for (const [W, H] of SIZES) for (const z of ZOOMS) for (const lang of LANGS) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(([z, lang]) => { localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', lang); localStorage.setItem('eve-zentrale-ui-v1', JSON.stringify({ scale: z, zoomSet: true })); }, [z, lang]);
    await page.goto('file:///home/claude/EVECore.html'); await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    for (const t of TABS) {
      await page.evaluate(t => { const b = document.getElementById('neo-btn-' + t); if (b) b.click(); }, t); await page.waitForTimeout(120);
      const r = await page.evaluate(() => {
        const de = document.documentElement, hd = document.querySelector('header.top'), pn = document.querySelector('section.panel.active');
        let minF = 99, minEl = '', outR = '';
        if (pn) pn.querySelectorAll('*').forEach(e => {
          if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.firstChild.nodeValue.trim()) return; if (e.closest('.q-tip')) return;   // „?“-Symbol fuer Tooltips, kein Lesetext
          const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) return;
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden') return;
          const f = parseFloat(cs.fontSize); if (f < minF){ minF = f; minEl = (e.className || e.tagName) + ': ' + e.firstChild.nodeValue.trim().slice(0, 30); }
          if (rc.right > innerWidth + 2 && !outR && !e.closest('[style*="overflow"], .tbl-wrap, .table-wrap, pre') && getComputedStyle(e.parentNode).overflowX === 'visible') outR = (e.className || e.tagName) + ' ' + Math.round(rc.right);
        });
        return { hscroll: de.scrollWidth > innerWidth + 1, hdr: hd ? hd.getBoundingClientRect().height / innerHeight : 0, minF, minEl, outR };
      });
      const id = W + 'x' + H + ' ' + Math.round(z * 100) + '% ' + lang + ' ' + t;
      checks++;
      if (!smallest[id.split(' ')[0]] || r.minF < smallest[id.split(' ')[0]][0]) smallest[id.split(' ')[0]] = [r.minF, t, r.minEl];
      const bad = [r.hscroll && 'waagrechtes Scrollen', r.hdr > 0.12 && 'Kopfzeile ' + Math.round(r.hdr * 100) + ' %', r.minF < MIN_FONT && 'Schrift ' + r.minF + ' px (' + r.minEl + ')', r.outR && 'ragt rechts raus: ' + r.outR].filter(Boolean);
      if (bad.length){ fails++; console.log('FAIL ' + id + ': ' + bad.join(', ')); }
    }
    if (z === 1 && lang === 'en'){ await page.evaluate(() => document.getElementById('neo-btn-station').click()); await page.screenshot({ path: '/tmp/jj5-' + W + 'x' + H + '.png' }); }
    await page.close();
  }
  await browser.close();
  Object.keys(smallest).forEach(k => console.log('kleinste Schrift ' + k + ': ' + smallest[k].join(' · ')));
  console.log(checks + ' Ansichten geprüft, ' + fails + ' mit Fehlern');
  console.log(fails ? '\nJJ5 TESTS FAILED' : '\nALL JJ5 TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
