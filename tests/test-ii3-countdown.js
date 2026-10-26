// II3 (05.10.2026): Overlay-Fußzeile zählt je EVE-Datenart bis „neu ab“ herunter (statt Uhrzeit), Laufschrift wenn zu lang.
// Echter Browser (Breite/Animation). Start: node test-ii3-countdown.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.route(/^https?:\/\//, r => r.abort());
  await p.addInitScript(() => { localStorage.setItem('eve-zentrale-lang-v1', 'de'); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); });
  await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(800);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok ' : 'FAIL ') + m); if (!c) fails++; };
  const r = await p.evaluate(async () => {
    const T = window.__test, now = Date.now(), H = { get: k => ({ 'last-modified': new Date(now - 60e3).toUTCString(), expires: new Date(now + 125e3).toUTCString() })[k] || null };
    T.esiStampRec('https://esi.evetech.net/latest/markets/10000002/orders/?type_id=34', { ok: true, headers: H });
    T.esiStampRec('https://esi.evetech.net/latest/characters/1/orders/', { ok: true, headers: { get: k => ({ 'last-modified': new Date(now - 60e3).toUTCString(), expires: new Date(now + 1205e3).toUTCString() })[k] || null } });
    const f = T.ovFootText('trades');
    // schmale Fußzeile wie ein kleines Overlay
    const foot = document.createElement('div'); foot.className = 'ov-foot'; foot.style.cssText = 'position:fixed;left:0;top:0;width:140px'; foot.innerHTML = '<span id="__age"></span><span id="__nx">x</span>';
    document.body.appendChild(foot);
    const age = document.getElementById('__age'); T.ovAgeSet(age, f);
    const t1 = age.textContent; await new Promise(r => setTimeout(r, 1100)); T.ovAgeSet(age, f); const t2 = age.textContent;
    const narrow = age.classList.contains('marq'), anim = getComputedStyle(age.firstElementChild).animationName;
    foot.style.width = '900px'; T.ovAgeSet(age, f);
    return { cd: f.cd, t1, t2, narrow, anim, wide: age.classList.contains('marq'), tip: age.title };
  });
  ok(r.cd.length === 2 && r.cd.some(c => c[0] === 'Markt') && r.cd.some(c => c[0] === 'Orders'), 'Trades-Overlay: Markt und Orders als Datenarten: ' + JSON.stringify(r.cd.map(c => c[0])));
  ok(/Markt 2:0\d/.test(r.t1) && /Orders 20:0\d/.test(r.t1) && !/\d\d:\d\d:\d\d|neu ab/.test(r.t1), 'Restzeit statt Uhrzeit: ' + r.t1);
  ok(r.t1 !== r.t2, 'zählt im Sekundentakt: ' + r.t1 + ' → ' + r.t2);
  ok(r.narrow && r.anim === 'ov-marq', 'schmales Fenster: Laufschrift');
  ok(!r.wide, 'breites Fenster: steht still');
  ok(/Markt .*→/.test(r.tip), 'Tooltip mit EVE-Stand → neu ab bleibt: ' + r.tip);
  // EN (25.10.2026): Datenart + „neu“ übersetzt (vorher „Ort 2:58“ im Englischen)
  const en = await p.evaluate(() => { document.documentElement.lang = 'en'; const n = Date.now(); const t = window.__test.esiCdTxt([['Ort', n + 178e3], ['Markt', n - 1]], n); document.documentElement.lang = 'de'; return t; });
  ok(/^Location 2:5\d · Market new$/.test(en), 'EN-Fußzeile übersetzt: ' + en);
  await b.close();
  console.log(fails ? '\nII3 TESTS FAILED' : '\nALL II3 TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
