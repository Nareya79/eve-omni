// GG1 (04.10.2026): Englisch-Modus – Muster mit Zahlen/Namen werden übersetzt, und in den Hauptbereichen der Demo steht kein deutscher Text mehr.
// Fehlalarme („40 min“, „Min. per jump“, „an“ als englisches Wort) zählen nicht: geprüft werden nur eindeutig deutsche Merkmale.
const { chromium } = require('playwright');
const FILE = 'file:///tmp/eve-zentrale-test14.html';   // Testkopie mit window.__test (Overlays)
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK: ' : 'FAIL: ') + m); if (!c) fails++; };
const DE = /[äöüÄÖÜß]|\b(und|nicht|oder|für|wird|werden|einen?|keine?|Stück|Sprünge|Stand|gefunden|im Plan|aus EVE|Marktdaten|Suchoptionen|Kontostand|Warteschlange|Angelegt|Papierkorb|sortieren|Buchungen|netto|Mio|Mrd|Tsd)\b|\bStd\b/;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route(/^https?:\/\//, r => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('eve-zentrale-lang-v1', 'en'));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE + '?demo=1'); await p.waitForTimeout(2500);
  // Muster: Text einsetzen, Übersetzer (MutationObserver) abwarten
  const cases = [['im Plan · Jita', 'in plan · Jita'], ['/Std. · → Amarr', '/h · → Amarr'], ['Aria Demo · Standings aus EVE (Aria Demo)', 'Aria Demo · standings from EVE (Aria Demo)'],
    ['Abbau nicht berechnet: Typ 17482 nicht gefunden (ESI 404)', 'Yield not calculated: Type 17482 not found (ESI 404)'], ['5 Std 0 Min', '5 h 0 min'], ['jeden Artikel einzeln', 'each item individually'], ['Geprüft: gerade eben', 'Checked: just now'], ['Kills: vor 3 Min', 'Kills: 3 min ago'], ['von 34 Sprüngen', 'of 34 jumps'], ['EVE-Stand 09:55 · neu ab 10:01', 'EVE data 09:55 · new at 10:01'], ['nächste in 4:35', 'next in 4:35'], ['Ladung Jita IV → Amarr (453 ', 'Cargo Jita IV → Amarr (453 ']];
  const got = await p.evaluate(async cs => { const d = document.createElement('div'); document.body.appendChild(d);
    const out = []; for (const c of cs){ d.textContent = c[0]; await new Promise(r => setTimeout(r, 50)); out.push(d.textContent); } d.remove(); return out; }, cases);
  cases.forEach((c, i) => ok(got[i] === c[1], '„' + c[0] + '“ → „' + got[i] + '“'));
  // Hauptbereiche: sichtbarer Text ohne deutsche Merkmale
  const panels = ['station', 'haul', 'sell', 'orders', 'contracts', 'wallet', 'assets', 'industry', 'mining', 'intel', 'radar', 'wormhole', 'chars', 'skills'];
  for (const t of panels){
    await p.evaluate(t => document.getElementById('neo-btn-' + t).click(), t); await p.waitForTimeout(900);
    const de = await p.evaluate(re => { const R = new RegExp(re), out = [], w = document.createTreeWalker(document.querySelector('section.panel.active'), NodeFilter.SHOW_TEXT), w2 = document.createTreeWalker(document.querySelector('header.top'), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode() || w2.nextNode())){ const e = n.parentElement; if (!e.offsetParent || /^(SCRIPT|STYLE|TEXTAREA)$/.test(e.nodeName) || e.closest('details:not([open]), .ov-hidden')) continue;
        const s = n.textContent.replace(/\s+/g, ' ').trim(); if (s && R.test(s)) out.push(s.slice(0, 80)); } return out; }, DE.source);
    ok(!de.length, t + ': kein deutscher Text' + (de.length ? ' – ' + de.slice(0, 3).join(' | ') : ''));
  }
  // GG5: Overlays (alle Ansichten, Text + Tooltips)
  const views = await p.evaluate(() => Object.keys(window.__test.ovViews()));
  for (const v of views){
    const de = await p.evaluate(([v, re]) => { const b = document.createElement('div'); b.style.cssText = 'position:fixed;left:0;top:0;width:420px;height:900px;overflow:auto'; document.body.appendChild(b);
      try{ window.__test.ovRenderViewInto(v, b); }catch(e){} return new Promise(r => setTimeout(() => { const R = new RegExp(re), out = [], w = document.createTreeWalker(b, 5); let n;
        while ((n = w.nextNode())){ const s = (n.nodeType === 1 ? (n.getAttribute('title') || '') + ' ' + (n.getAttribute('placeholder') || '') : n.textContent).replace(/\s+/g, ' ').trim(); if (s && R.test(s)) out.push(s.slice(0, 80)); }
        b.remove(); r(out); }, 300)); }, [v, DE.source]);
    ok(!de.length, 'Overlay ' + v + ': kein deutscher Text' + (de.length ? ' – ' + de.slice(0, 3).join(' | ') : ''));
  }
  ok(!errs.length, 'keine Seitenfehler' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
