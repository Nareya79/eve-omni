// A2: Aktives OmniCom-Symbol ist ganz umrandet (Hauptfenster + OmniCom-Overlay im EVE-Stil), nicht nur Balken links.
// Echter Browser noetig (berechnete Styles). Start: node test-neocom-frame.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const frame = s => /inset/.test(s) && /0px 0px 0px 1px/.test(s);
  for (const [w, name] of [[1400, 'breit'], [400, 'handy']]) {
    const page = await browser.newPage({ viewport: { width: w, height: 700 } });
    await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('file:///home/claude/EVECore.html'); await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const a = document.querySelector('.neo-btn[aria-selected="true"]'), b = document.querySelector('.neo-btn[aria-selected="false"]');
      return { a: a && getComputedStyle(a).boxShadow, ab: a && getComputedStyle(a).borderTopColor, b: b && getComputedStyle(b).boxShadow };
    });
    ok(r.a && (frame(r.a) || /255, 255, 255/.test(r.ab)), name + ': aktives Symbol hat Rahmen rundum (' + r.a + ' / ' + r.ab + ')');   // AJ: im Stil EVE weiße Kante statt Innenrahmen
    ok(r.b === 'none', name + ': inaktive Symbole ohne Rahmen');
    await page.close();
  }
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await p.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.goto('file:///home/claude/EVECore.html'); await p.waitForTimeout(600);
  // Overlay-OmniCom im EVE-Stil: Stilregel direkt pruefen (Einzelfenster braucht das Programm)
  const o = await p.evaluate(() => {
    document.documentElement.classList.add('ov-eve');
    const g = document.createElement('div'); g.className = 'neo-ov'; g.innerHTML = '<button class="on">a</button><button>b</button>'; document.body.appendChild(g);
    const bs = g.querySelectorAll('button'), c0 = getComputedStyle(bs[0]), c1 = getComputedStyle(bs[1]), r = { on: c0.borderTopColor + ' ' + c0.borderTopWidth, off: c1.borderTopColor, sh: c0.boxShadow };
    g.remove(); document.documentElement.classList.remove('ov-eve'); return r;
  });
  // AF3 (18.10.): wie das EVE-Neocom – offen = Kante ringsum in Symbol-/Akzentfarbe (statt weißem Innenrahmen A2), zu = graue Kante
  ok(/1px$/.test(o.on) && !/255, 255, 255/.test(o.on) && o.sh === 'none', 'Overlay (EVE-Stil): offenes Symbol hat Kante rundum in Symbolfarbe (' + o.on + ')');
  ok(o.off === 'rgba(255, 255, 255, 0.16)', 'Overlay (EVE-Stil): geschlossene Symbole mit grauer Kante (' + o.off + ')');
  // Farben
  const col = sel => p.evaluate(s => getComputedStyle(document.querySelector(s)).color, sel);
  const GOLD = 'rgb(255, 226, 154)';
  ok(await col('#neo-btn-haul svg') === GOLD && await col('#neo-btn-intel svg') === GOLD, 'T27: alle Symbole in der Symbolfarbe (Standard Gold)');
  ok(await p.evaluate(() => { const g = document.querySelector('#ic-defs #ic-l-ffe29a'); return !!g && /url\(#ic-l-ffe29a\)/.test(document.querySelector('#neo-btn-haul svg').outerHTML) && !!document.querySelector('#neo-btn-haul svg [fill="url(#ic-cyan)"]'); }), 'T27: Linien-Verlauf je Farbe + Cyan aus dem gemeinsamen Vorrat');
  ok(await p.evaluate(() => ['station','haul','wallet','skills','jump','chars','settings','account'].every(id => document.querySelector('#neo-btn-' + id + ' svg.ic2')) && !!document.querySelector('#neo-quit svg.ic2')), 'T27: neue Symbole in allen Knöpfen inkl. Beenden');
  const rows = await p.evaluate(() => document.querySelectorAll('#neo-order input[type=color], #neo-color-extra input[type=color]').length);
  const nBtn = await p.evaluate(() => document.querySelectorAll('#neocom .neo-btn:not(#neo-quit):not(#neo-btn-account):not(#neo-btn-orders)').length);   // AL5: Orders steckt unter Trading
  ok(rows === nBtn + 11, 'Farbfeld fuer jedes Symbol inkl. Alert/Gang-Report/Notizen/Leistung/Timer/D-Scan/Sound/Scanner-Plan/PI-Planer/Workbench/Produktion (' + rows + ')');
  await p.evaluate(() => { const i = document.querySelector('[data-neo-color="neo-btn-haul"]'); i.value = '#ff0000'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
  ok(await col('#neo-btn-haul svg') === 'rgb(255, 0, 0)' && await p.evaluate(() => !!document.getElementById('ic-l-ff0000')), 'eigene Farbe je Symbol (Ausnahme) sofort, mit eigenem Verlauf');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-neocom-colors-v1'))['neo-btn-haul'] === '#ff0000'), 'eigene Farbe gespeichert (eve-zentrale-neocom-colors-v1)');
  await p.reload(); await p.waitForTimeout(600);
  ok(await col('#neo-btn-haul svg') === 'rgb(255, 0, 0)', 'eigene Farbe bleibt nach Neuladen');
  ok(await p.evaluate(() => document.querySelector('[data-neo-color="neo-btn-haul"]').value === '#ff0000'), 'Farbfeld zeigt gespeicherte Farbe');
  ok(await p.evaluate(() => /#ff0000/i.test(document.getElementById('neo-btn-haul').querySelector('svg').outerHTML)), 'Farbe steckt im Symbol, das ins OmniCom-Overlay kopiert wird');
  // Symbolfarbe (Einstellungen › Darstellung)
  await p.evaluate(() => document.querySelector('#ic-presets [data-icp="gallente"]').click());
  ok(await col('#neo-btn-intel svg') === 'rgb(127, 214, 141)' && await col('#neo-btn-haul svg') === 'rgb(255, 0, 0)', 'T27: Vorlage Gallente färbt alle, Ausnahme bleibt');
  ok(await p.evaluate(() => document.querySelector('#ic-presets [data-icp="gallente"]').getAttribute('aria-pressed') === 'true'), 'T27: gewählte Vorlage markiert');
  await p.evaluate(() => { const i = document.getElementById('ic-color'); i.value = '#123456'; i.dispatchEvent(new Event('change')); });
  ok(await col('#neo-btn-intel svg') === 'rgb(18, 52, 86)', 'T27: eigene Symbolfarbe per Farbwähler');
  await p.evaluate(() => { document.querySelector('#ui-schemes [data-scheme="minmatar-eve"]').click(); const c = document.getElementById('ic-scheme'); c.checked = true; c.dispatchEvent(new Event('change')); });
  ok(await col('#neo-btn-intel svg') === 'rgb(208, 92, 59)' && await p.evaluate(() => document.querySelector('#ic-presets button').disabled), 'T27: passend zum Farbschema (Minmatar (EVE) -> EVE-Akzent), Vorlagen gesperrt');
  await p.evaluate(() => document.querySelector('#ui-schemes [data-scheme="caldari-eve"]').click());
  ok(await col('#neo-btn-intel svg') === 'rgb(154, 210, 227)', 'T27: Farbschema gewechselt -> Symbolfarbe folgt (Caldari (EVE))');
  await p.evaluate(() => { document.querySelector('#ui-schemes [data-scheme="photon"]').click(); const c = document.getElementById('ic-scheme'); c.checked = false; c.dispatchEvent(new Event('change')); document.querySelector('#ic-presets [data-icp="gold"]').click(); });
  // A5 jetzt: x = wieder Symbolfarbe
  await p.evaluate(() => document.querySelector('[data-neo-nocolor="neo-btn-haul"]').click());
  ok(await col('#neo-btn-haul svg') === GOLD, 'x-Knopf: Symbol wieder in der Symbolfarbe');
  ok(await p.evaluate(() => !('neo-btn-haul' in JSON.parse(localStorage.getItem('eve-zentrale-neocom-colors-v1'))) && document.querySelector('[data-neo-nocolor="neo-btn-haul"]').disabled), 'Ausnahme gelöscht, x-Knopf gesperrt');
  await p.evaluate(() => { localStorage.setItem('eve-zentrale-neocom-colors-v1', JSON.stringify({ 'neo-btn-intel': 'none', 'neo-btn-pi': '#00ff00' })); });
  await p.reload(); await p.waitForTimeout(600);
  ok(await col('#neo-btn-intel svg') === GOLD && await col('#neo-btn-pi svg') === 'rgb(0, 255, 0)', 'altes „none“ = Symbolfarbe, alte eigene Farbe bleibt');
  await p.evaluate(() => document.getElementById('neo-color-reset').click());
  ok(await col('#neo-btn-pi svg') === GOLD && await p.evaluate(() => !document.getElementById('neo-color-none')), 'Alle in Symbolfarbe');
  await browser.close();
  console.log(fails ? '\n' + fails + ' OMNICOM-FRAME TESTS FAILED' : '\nALL OMNICOM-FRAME TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
