// PQ7 (12.10.2026): OmniBreaker in EVE Omni – weltweite Bestenliste im Menü, Hochladen nur mit Haken, Name = aktiver Charakter.
// Echter Browser nötig. Der Server wird abgefangen (kein Netz).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [], posts = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route(/^https?:\/\//, r => {
    const u = r.request().url();
    if (u.indexOf('fluxserver01.taileafff1.ts.net:8443/omni/score') >= 0) { posts.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"ok":true,"better":true,"rank":3}' }); }
    if (u.indexOf('fluxserver01.taileafff1.ts.net:8443/omni/top') >= 0) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([{ n: 'Alpha <b>', s: 123456, lv: 12 }, { n: 'Beta', s: 1000, lv: 1 }]) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
  await page.goto('file:///home/claude/EVECore.html');
  await page.waitForTimeout(800);
  await page.evaluate(() => {   // erst nach dem Laden: ohne echte Anmeldung räumt die App die Liste beim Start auf
    localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ character_id: '111', character_name: 'Andere' }, { character_id: '94978996', character_name: 'Testpilot' }]));
    localStorage.setItem('eve-zentrale-active-char', '94978996');
  });
  await page.evaluate(() => { const b = document.createElement('div'); b.id = 'obbox'; b.style.cssText = 'width:500px;height:700px'; document.body.appendChild(b); window.__c = window.EVEOmniBreaker.mountWindow(b); });
  await page.waitForTimeout(300);
  const ui = await page.evaluate(() => { const b = document.getElementById('obbox'); return { h: [...b.querySelectorAll('h3')].some(h => /Weltweite Bestenliste/.test(h.textContent)), chk: b.querySelector('.ob-ww-on input').checked, who: b.querySelector('.ob-ww-who').textContent, opts: b.querySelectorAll('.ob-ww-row option').length }; });
  ok(ui.h && ui.chk === true, 'Menü: weltweite Bestenliste, Hochladen standardmäßig an');
  ok(/Testpilot/.test(ui.who), 'Name = aktiver Charakter (' + ui.who + ')');
  ok(ui.opts === 151, 'Auswahl Kampagne + 150 Level');
  // ohne Haken: nichts hochladen (13.10.: Haken ist standardmäßig an → erst entfernen)
  await page.evaluate(() => { const c = document.querySelector('#obbox .ob-ww-on input'); c.checked = false; c.dispatchEvent(new Event('change')); });
  ok(await page.evaluate(() => localStorage.getItem('eve-zentrale-omnibreaker-online') === '0'), 'Haken entfernt wird als aus gespeichert');
  const win = async () => page.evaluate(() => { const g = window.__c.game; window.__c.startPractice(5); g.time = 42; g.status = 'flying'; g.targetsLeft = 0; g.score = 7777; g.levelStartScore = 0; g._endShot('out'); });
  await win(); await page.waitForTimeout(400);
  ok(posts.length === 0, 'ohne Haken wird nichts hochgeladen');
  await page.evaluate(() => { const c = document.querySelector('#obbox .ob-ww-on input'); c.checked = true; c.dispatchEvent(new Event('change')); });
  await win(); await page.waitForTimeout(400);
  ok(posts.length === 1 && posts[0].l === 5 && posts[0].cid === '94978996' && posts[0].n === 'Testpilot' && posts[0].s > 0 && posts[0].ms >= 42000 && posts[0].ms < 43000, 'gewonnenes Level hochgeladen: ' + JSON.stringify(posts[0]));
  ok(await page.evaluate(() => localStorage.getItem('eve-zentrale-omnibreaker-online') === '1'), 'Haken gespeichert');
  // Kampagne: Game over → Gesamtpunkte
  await page.evaluate(() => { const g = window.__c.game; window.__c.startCampaign(); g.levelsCleared = 3; g.score = 25000; g.status = 'flying'; g.ballsLeft = 0; g.targetsLeft = 4; g._endShot('out'); });
  await page.waitForTimeout(400);
  const camp = posts.find(p => p.l === 0);
  ok(camp && camp.s === 25000 && camp.lv === 3, 'Kampagne hochgeladen: ' + JSON.stringify(camp));
  // Liste anzeigen
  await page.evaluate(() => { const b = document.getElementById('obbox'); b.querySelector('.ob-ww-row select').value = '0'; b.querySelector('.ob-ww-row button').click(); });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelectorAll('#obbox .ob-ww .ob-scores').length === 1 && !document.querySelector('#obbox .ob-side .ob-scores') && !/Highscore leeren/.test(document.querySelector('#obbox .ob-root').textContent)), 'TT4: nur die weltweite Liste, keine lokale Top 10');
  const lst = await page.evaluate(() => { const l = document.querySelector('#obbox .ob-ww .ob-scores'); return { n: l.querySelectorAll('li').length, html: l.innerHTML, txt: l.textContent }; });
  ok(lst.n === 2 && /Alpha <b>/.test(lst.txt) && !/<b>/.test(lst.html.replace(/&lt;b&gt;/g, '')), 'weltweite Liste gezeigt, Namen als Text (kein HTML)');
  // Demo: kein Name, kein Hochladen
  ok(await page.evaluate(() => { window.EVE_DEMO = { on: true }; const b = document.createElement('div'); b.style.cssText = 'width:400px;height:600px'; document.body.appendChild(b); window.EVEOmniBreaker.mountWindow(b); const w = b.querySelector('.ob-ww-who').textContent; delete window.EVE_DEMO; return /Kein EVE-Charakter/.test(w); }), 'Demo: kein Charakter, also kein Hochladen');
  ok(!errs.length, 'keine Fehler ' + errs.join(' | '));
  await browser.close();
  if (fails) { console.log('PQ7 ONLINE TESTS FAILED'); process.exit(1); }
  console.log('ALL TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
