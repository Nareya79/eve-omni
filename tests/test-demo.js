// V1 (03.10.2026): Demo-Modus – ?demo=1, Banner, Demo-Daten in allen Bereichen, keine Anfrage nach draußen, echte Daten byte-gleich,
// „Demo beenden“, Erststart „Erst mal umsehen“ → Demo, gesperrte Knöpfe, keine echten Charakternamen. Echter Browser (Playwright), weil Layout/Bilder.
const { chromium } = require('playwright'), fs = require('fs');
const FILE = 'file:///home/claude/EVECore.html';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK: ' : 'FAIL: ') + m); if (!c) fails++; };
const BAD_HOSTS = /esi\.evetech\.net|login\.eveonline\.com|zkillboard\.com|dotlan|github|eve-scout|nareya79\.com/;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // V6: Browsersprache fest Deutsch – die Prüfungen erwarten die deutsche Demo; GitHub-Läufer sind en-US (sonst orders/wormhole/mining rot)
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, locale: 'de-DE' });
  const net = [];
  await ctx.route(/^https?:\/\//, r => { net.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // echte Daten vorher anlegen
  await p.goto(FILE); await p.waitForTimeout(500);
  await p.evaluate(() => { localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ character_id: '1', character_name: 'Echter Pilot', access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 864e5 }]));
    localStorage.setItem('eve-zentrale-trades-v1', '[{"id":"x","name":"Echt"}]'); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); });
  await p.goto(FILE); await p.waitForTimeout(1500);   // normaler Start räumt auf – erst danach den Stand merken
  const real = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k.indexOf('eve-zentrale-demo-') !== 0) o[k] = localStorage.getItem(k); } return o; });
  net.length = 0;
  // Demo
  await p.goto(FILE + '?demo=1'); await p.waitForTimeout(3500);
  ok(await p.evaluate(() => !!document.querySelector('.demo-bar') && /DEMO/.test(document.querySelector('.demo-bar').textContent)), 'V1: Banner „DEMO – erfundene Daten“');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-characters')).map(c => c.character_name).join() === 'Aria Demo,Kael Demo,Nova Demo'), 'V1: drei Demo-Charaktere geladen');
  const areas = { station: /Drone Damage Amplifier II|Hobgoblin II/, track: /Damage Control II/, wallet: /Aria Demo/, skills: /Tycoon|Transport Ships/, chars: /Kaels Charon|Charon/, orders: /aktive Orders/, map: /Navigation/, wormhole: /J-System/, mining: /Erz/ };
  for (const [t, re] of Object.entries(areas)){
    await p.evaluate(t => document.getElementById('neo-btn-' + t).click(), t); await p.waitForTimeout(t === 'map' ? 3000 : 1500);
    const txt = await p.evaluate(() => (document.querySelector('section.panel.active') || document.body).innerText);
    ok(re.test(txt), 'V1: Bereich ' + t + ' zeigt Demo-Daten');
  }
  // Markt-Scanner liefert Vorschläge
  await p.evaluate(() => document.getElementById('neo-btn-station').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('tsc-start').click()); await p.waitForTimeout(6000);
  ok(await p.evaluate(() => document.querySelectorAll('#tsc-body tr, #tsc-results tr, .tsc-row').length >= 5), 'V1: Markt-Scanner liefert Vorschläge');
  // Porträts der erfundenen Charaktere = Platzhalter
  ok(await p.evaluate(() => ![...document.images].some(i => /images\.evetech\.net\/(characters|corporations)\//.test(i.src) && !/\/(94978996|98495668)\//.test(i.src))), 'V1: keine Porträts/Logos echter Spieler (außer Entwickler-Hinweis)');
  // gesperrte Knöpfe
  await p.evaluate(() => { const b = document.getElementById('win-eve-q') || document.getElementById('sso-login-btn'); b.click(); });
  ok(await p.evaluate(() => !!document.querySelector('.demo-toast')), 'V1: gesperrter Knopf zeigt „In der Demo nicht möglich“');
  const CREDIT = /\/(94978996|98495668)\//;   // Entwickler-Hinweis unter „Über“ (Nareya Mythec, erlaubt)
  const bad = net.filter(u => BAD_HOSTS.test(u) || (/images\.evetech\.net\/(characters|corporations|alliances)/.test(u) && !CREDIT.test(u)));
  ok(!bad.length, 'V1: keine Anfrage nach draußen (' + bad.slice(0, 3).join(' ') + ')');
  const html = fs.readFileSync('/home/claude/EVECore.html', 'utf8'), demo = html.slice(html.indexOf('<script id="demo-js">'), html.indexOf('</script>', html.indexOf('<script id="demo-js">')));
  ok(!/Taron|Velkar|Selia|Kerana|Orvan|Delvar/i.test(demo), 'V1: keine echten Charakternamen in den Demo-Daten');
  // echte Daten am Ende der Demo-Sitzung (direkt im echten Speicher gelesen), dann Demo beenden
  const demoReal = await p.evaluate(() => { const s = localStorage.__real, o = {}; for (let i = 0; i < s.length; i++){ const k = s.key(i); if (k.indexOf('eve-zentrale-demo-') !== 0) o[k] = s.getItem(k); } return o; });
  ok(JSON.stringify(Object.keys(demoReal).sort()) === JSON.stringify(Object.keys(real).sort()) && Object.keys(real).every(k => demoReal[k] === real[k]), 'V1: echte Daten während der Demo byte-gleich (alle ' + Object.keys(real).length + ' Schlüssel)');
  await p.evaluate(() => document.querySelector('.demo-bar button').click()); await p.waitForTimeout(1500);
  ok(!/demo=1/.test(p.url()) && !(await p.evaluate(() => !!document.querySelector('.demo-bar'))), 'V1: „Demo beenden“ → normale Ansicht');
  const after = demoReal;
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-trades-v1'))[0].name === 'Echt'), 'V1: nach „Demo beenden“ wieder die echten Daten');
  ok(await p.evaluate(() => Object.keys(localStorage).some(k => k.indexOf('eve-zentrale-demo-') === 0)), 'V1: Demo schreibt nur eve-zentrale-demo-…');
  // Erststart „Erst mal umsehen“ → Demo
  const p2 = await (await browser.newContext({ locale: 'de-DE' })).newPage();
  await p2.route(/^https?:\/\//, r => r.abort());
  await p2.goto(FILE); await p2.waitForTimeout(800);
  await p2.click('[data-wl="de"]'); await p2.waitForTimeout(1500); await p2.click('[data-wl="play"]'); await p2.waitForTimeout(300); await p2.click('[data-wl="wz-std"]'); await p2.waitForTimeout(300); await p2.click('[data-wl="skip"]'); await p2.waitForTimeout(2500);   // VV2: + Schritt 3
  ok(/demo=1/.test(p2.url()) && await p2.evaluate(() => !!document.querySelector('.demo-bar')), 'V1: Erststart „Erst mal umsehen“ → Demo');
  // Einstellungen › Allgemein: Demo ansehen
  await p2.goto(FILE); await p2.waitForTimeout(800);
  await p2.evaluate(() => document.getElementById('setup-again').click()); await p2.waitForTimeout(300);
  await p2.click('[data-wl="lang-skip"]'); await p2.waitForTimeout(300); await p2.click('[data-wl="skip"]'); await p2.waitForTimeout(2000);
  ok(/demo=1/.test(p2.url()), 'VV2: Demo über „Einrichtung erneut starten“ (Einstellungen › Allgemein) → Überspringen → Demo');
  ok(!errs.length, 'V1: keine Skriptfehler (' + errs.slice(0, 2).join(' | ') + ')');
  await browser.close();
  console.log(fails ? fails + ' DEMO TESTS FAILED' : 'ALL TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
