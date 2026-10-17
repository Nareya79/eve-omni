// 13.10.2026 (Discord-Meldung): In der englischen Version fehlte der Login unter Settings › Account – eine Regel für die
// deutschen Patchnoten blendete im EN-Modus ALLE Klappkästen der Einstellungen aus (seit 4.0.73). Jetzt nur im Bereich „Über“.
const { chromium } = require('playwright');
let ok = 0, bad = 0;
function assert(c, m){ if (c){ ok++; console.log('OK:', m); } else { bad++; console.log('FAIL:', m); } }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const lang of ['en', 'de']) {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    await p.route(/^https?:\/\//, r => r.fulfill({ status: 200, body: '[]' }));
    await p.addInitScript(l => { localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l); }, lang);
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.getElementById('neo-btn-settings').click(); });
    await p.waitForTimeout(300);
    const vis = async pane => { await p.evaluate(k => document.querySelector('#panel-settings [data-set="' + k + '"]').click(), pane); await p.waitForTimeout(250); };
    await vis('chars');
    const r = await p.evaluate(() => { const s = id => { const e = document.getElementById(id); const q = e && e.getBoundingClientRect(); return !!q && q.width > 0 && q.height > 0; }; return { box: s('sso-login-box'), btn: s('sso-login-btn'), help: s('sso-help') }; });
    assert(r.box && r.btn && r.help, lang + ': Login-Kasten, Login-Knopf und Client-ID-Hilfe sichtbar ' + JSON.stringify(r));
    await vis('about');
    const pn = await p.evaluate(() => [...document.querySelectorAll('#set-pane-about details.skills-more')].filter(d => d.getBoundingClientRect().height > 0).length);
    assert(lang === 'en' ? pn === 0 : pn > 50, lang + ': deutsche Patchnoten ' + (lang === 'en' ? 'ausgeblendet' : 'sichtbar') + ' (' + pn + ')');
    await p.close();
  }
  await b.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})().catch(e => { console.error(e); console.log('FAILED'); process.exit(1); });
