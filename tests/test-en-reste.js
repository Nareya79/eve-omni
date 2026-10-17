// Englisch-Modus: alle Seiten (mit Unterreitern, aufgeklappt) ohne Login nach deutschen Resten absuchen (Text, title, placeholder).
// Echter Browser noetig. Patchnoten (details.skills-more) und lang="de" sind ausgenommen.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.addInitScript(() => { localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'en'); });
  await p.goto('file:///home/claude/EVECore.html'); await p.waitForTimeout(1500);
  const TABS = ['station','haul','track','wallet','assets','sell','orders','contracts','industry','mining','jump','map','intel','radar','wormhole','appraisal','courier','chars','pi','skills','music','settings','account'];
  const found = new Map();
  for (const t of TABS) {
    await p.evaluate(t => { const b = document.getElementById('neo-btn-' + t); if (b) b.click(); }, t); await p.waitForTimeout(300);
    // auch Unterreiter + aufklappbare Bereiche
    await p.evaluate(() => document.querySelectorAll('section.panel.active details').forEach(d => d.open = true));
    const subs = await p.evaluate(() => [...document.querySelectorAll('section.panel.active [role="tab"]')].map((x, i) => i));
    for (const i of [-1, ...subs]) {
      if (i >= 0) { await p.evaluate(i => { const x = document.querySelectorAll('section.panel.active [role="tab"]')[i]; if (x) x.click(); }, i); await p.waitForTimeout(200); }
      const r = await p.evaluate(() => {
        const DE = /[äöüÄÖÜß]|\b(und|oder|mit|nicht|für|bei|aus|der|die|das|den|dem|ein|eine|wird|werden|ist|sind|noch|nur|alle|auf|zum|zur|Preis|Menge|Stück|Laden|laden|Charakter|Wert|Monate|Erweitert|Rabatt|Steuer)\b/;
        const out = [];
        const w = document.createTreeWalker(document.querySelector('section.panel.active') || document.body, 4);
        let n; while ((n = w.nextNode())) {
          const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (v.length < 3 || !DE.test(v)) continue;
          const e = n.parentNode; if (!e || e.closest('[lang="de"], script, style, details.skills-more, option[value]')) continue;
          const rc = e.getBoundingClientRect(); if (!rc.width && !rc.height) continue;
          out.push(v.slice(0, 140));
        }
        document.querySelectorAll('section.panel.active [title], section.panel.active [placeholder]').forEach(e => ['title', 'placeholder'].forEach(a => { const v = e.getAttribute(a); if (v && DE.test(v)) out.push('[' + a + '] ' + v.slice(0, 140)); }));
        return out;
      });
      r.forEach(x => { if (!found.has(x)) found.set(x, t); });
    }
  }
  const hd = await p.evaluate(() => [...document.querySelectorAll('header.top *, nav.neocom *')].map(e => e.getAttribute('title') || '').filter(v => /[äöüß]|\b(und|mit|für)\b/.test(v)));
  hd.forEach(x => found.set('[title] ' + x.slice(0, 140), 'kopf/neocom'));
  for (const [k, v] of found) console.log(v.padEnd(10) + ' | ' + k);
  console.log('Anzahl: ' + found.size);
  await b.close();
  console.log(found.size ? '\nEN-RESTE TESTS FAILED' : '\nALL EN-RESTE TESTS PASSED'); process.exit(found.size ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
