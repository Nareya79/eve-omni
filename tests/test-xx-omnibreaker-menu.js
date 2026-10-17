// XX (17.10.2026): OmniBreaker-Menü – Level freispielen (XX1), „Kampagne löschen“ mit Rückfrage (XX2), Bestenliste oben, Level-Auswahl darunter (XX3).
// Echter Browser nötig. Start: node test-xx-omnibreaker-menu.js (aus /home/claude)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]' }));
  await page.addInitScript(() => localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
  await page.goto('file:///home/claude/EVECore.html');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    localStorage.setItem('eve-zentrale-omnibreaker-progress-v4', '1');
    localStorage.setItem('eve-zentrale-omnibreaker-best', JSON.stringify({ 1: 500, 2: 700 }));
    localStorage.setItem('eve-zentrale-omnibreaker-highscores', JSON.stringify([{ name: 'X', score: 999, level: 3, date: '2026-10-17' }]));
  });
  await page.evaluate(() => window.EVEOmniBreaker.open());
  await page.waitForTimeout(500);
  await page.click('#ob-menu-btn'); await page.waitForTimeout(150);
  const q = () => page.evaluate(() => {
    const c = [...document.querySelectorAll('#ob-overlay .ob-lv-c')];
    return { free: c.filter(b => b.dataset.lv !== '0' && !b.classList.contains('ob-lv-lock')).map(b => +b.dataset.lv), rnd: !c.find(b => b.dataset.lv === '0').classList.contains('ob-lv-lock'), open: document.querySelector('#ob-overlay .ob-menu').classList.contains('open') };
  });
  let s = await q();
  ok(s.free.join() === '1,2,3' && s.rnd, 'XX1: frei nur geschaffte Level + das nächste (' + s.free.join() + '), Zufall frei');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('#ob-overlay .ob-lv-c[data-lv="4"]'), '::before').width === '7px'), 'XX1: gesperrt mit Schloss');
  await page.click('#ob-overlay .ob-lv-c[data-lv="9"]', { force: true }); await page.waitForTimeout(200);
  s = await q();
  ok(s.open && await page.evaluate(() => !document.querySelector('#ob-overlay .ob-hud').textContent.includes('9')), 'XX1: Klick auf gesperrtes Level startet nichts, Menü bleibt offen');
  // XX3: Reihenfolge im Menü
  ok(await page.evaluate(() => { const m = document.querySelector('#ob-overlay .ob-menu'), w = m.querySelector('.ob-ww'), l = m.querySelector('.ob-lv'); return w && l && w.getBoundingClientRect().top < l.getBoundingClientRect().top && /Weltweite Bestenliste/.test(w.textContent) && !m.querySelector('.ob-side .ob-ww-on'); }), 'XX3: Bestenliste oben, Level-Auswahl darunter');
  // XX2: 1. Klick fragt nach, Menü bleibt offen, nichts gelöscht
  await page.click('#ob-overlay .ob-wipe'); await page.waitForTimeout(100);
  const a = await page.evaluate(() => ({ t: document.querySelector('#ob-overlay .ob-wipe').textContent, best: localStorage.getItem('eve-zentrale-omnibreaker-best'), open: document.querySelector('#ob-overlay .ob-menu').classList.contains('open') }));
  ok(/Wirklich/.test(a.t) && a.open && /700/.test(a.best), 'XX2: 1. Klick „Wirklich löschen?“, noch nichts gelöscht');
  await page.click('#ob-overlay .ob-wipe'); await page.waitForTimeout(150);
  await page.click('#ob-menu-btn'); await page.waitForTimeout(150);
  s = await q();
  const b = await page.evaluate(() => ({ best: localStorage.getItem('eve-zentrale-omnibreaker-best'), prog: localStorage.getItem('eve-zentrale-omnibreaker-progress'), hs: localStorage.getItem('eve-zentrale-omnibreaker-highscores'), t: document.querySelector('#ob-overlay .ob-wipe').textContent }));
  ok(s.free.join() === '1' && !b.best && !b.prog, 'XX2: nach Bestätigung nur Level 1 frei, Spielstand + Bestwerte weg');
  ok(/999/.test(b.hs || '') && /Kampagne löschen/.test(b.t), 'XX2: Highscores bleiben, Knopf wieder „Kampagne löschen“');
  // EN
  await page.evaluate(() => localStorage.setItem('eve-zentrale-lang-v1', 'en'));
  await page.reload(); await page.waitForTimeout(800);
  await page.evaluate(() => window.EVEOmniBreaker.open()); await page.waitForTimeout(400);
  const en = await page.evaluate(() => ({ w: document.querySelector('#ob-overlay .ob-wipe').textContent, l: document.querySelector('#ob-overlay .ob-lv-c[data-lv="5"]').title }));
  ok(en.w === 'Delete campaign' && /locked/.test(en.l), 'EN: ' + en.w + ' / ' + en.l.replace(/\n/g, ' '));
  ok(!errs.length, 'keine Fehler ' + errs.join(' | '));
  await browser.close();
  if (fails) { console.log('XX TESTS FAILED'); process.exit(1); }
  console.log('ALL TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
