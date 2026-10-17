// 12.10.2026: OmniBreaker auf Englisch – alle sichtbaren Texte (Menü, Raster-Tooltips, Legende, Spielfeld, Ergebniskarten) ohne deutsche Reste; Deutsch: Menü/Legende deutsch, Spielfeld englisch (Nutzerwunsch 12.10.)
const { chromium } = require('playwright');
let fails = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; }
const GERMAN = /[äöüßÄÖÜ]|\b(der|die|das|und|nicht|mit|von|ein|eine|Drohne|Drohnen|Erzader|Erzadern|Punkte|Übung|Noch|Weiter|geräumt|Kampagne|Treffer|Brocken|Wracks|Tore|Felder|ruhendes|Gestein|neu|Bestwert|Ton|Zufall)\b/;
async function collect(page, lang) {
  await page.evaluate(l => { localStorage.setItem('eve-zentrale-lang-v1', l); }, lang);
  await page.reload(); await page.waitForTimeout(1500);
  return page.evaluate(async () => {
    const out = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y) { if (/[A-Za-zÄÖÜäöü]{2,}/.test(String(t))) out.push('canvas: ' + t); return orig.apply(this, arguments); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:650px;z-index:999999'; document.body.appendChild(box);
    const c = window.EVEOmniBreaker.mountWindow(box); await wait(400);
    const texts = () => {
      box.querySelectorAll('*').forEach(e => {
        const f = e.closest('.ob-stage') && !e.closest('.ob-menu, .ob-menu-btn') ? 'feld-' : '';   // Spielfeld: Anzeigen oben, Meldungen, Ergebniskarte
        e.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) out.push(f + 'text: ' + n.textContent.trim()); });
        ['title', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v) out.push(a + ': ' + v); });
      });
    };
    texts();
    for (const L of [1, 3, 10, 15, 21, 37, 51, 73, 100, 0]) { c.startPractice(L); await wait(250); texts(); }
    // Ergebniskarten: Übung gewonnen/verloren, Kampagne weiter/Ende, Highscore-Eintrag
    const g = c.game;
    const finish = async (won) => { g.targetsLeft = won ? 0 : 5; if (!won) g.ballsLeft = 0; g.status = 'flying'; g._endShot('out'); await wait(300); texts(); };
    c.startPractice(5); await finish(true); c.startPractice(5); await finish(false);
    c.startCampaign(); await wait(200); g.bestCombo = 12; g.comboTotal = 900; await finish(true);
    c.startCampaign(); await wait(200); g.score = 999999; await finish(false);
    const save = [...box.querySelectorAll('.ob-card button')].find(b => /Submit|Eintragen/.test(b.textContent)); if (save) { save.click(); await wait(200); texts(); }
    c.pause(); await wait(200); texts();
    // Spielfeld-Texte: Treffer, Items, Panzer, Frachter, Combo
    c.startPractice(73); await wait(200);
    ['hit', 'power', 'catch', 'combo', 'comboBonus', 'armor', 'net'].forEach(t => g.events.push({ type: t, x: 300, y: 300, pts: 100, t: 'z', kind: 'stasis', free: true, n: 10, hits: 12, hp: 1 }));
    g.volley = true; g.net = 1; c.resume(); await wait(500);
    return [...new Set(out)];
  });
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///tmp/eve-zentrale-test14.html'); await page.waitForTimeout(800);
  const en = await collect(page, 'en');
  const bad = en.filter(t => GERMAN.test(t.replace(/^[a-z-]+: /, '').replace(/OmniBreaker|Veldspar|Pyroxeres|Omber|Jaspet|Spodumain|Bistot|Arkonor|Mercoxit/g, '')));
  ok(en.length > 150, 'EN: ' + en.length + ' Texte gesammelt');
  ok(bad.length === 0, 'EN: keine deutschen Reste' + (bad.length ? '\n   ' + bad.slice(0, 40).join('\n   ') : ''));
  ok(en.some(t => /New campaign|Continue/.test(t)) && en.some(t => /Stasis web: everything on the field stops moving for 8 s \(from level 15\)/.test(t)), 'EN: Knöpfe und Item-Legende englisch');
  ok(en.some(t => /canvas: .*ORE VEINS|canvas: PRACTICE|canvas: VOLLEY READY/.test(t)) && en.some(t => /Level \d+ cleared!|Practice cleared/.test(t)), 'EN: Spielfeld und Ergebniskarten englisch');
  ok(en.some(t => /new: [A-Z]/.test(t)) && en.some(t => /FIRST SHOT|First Shot|A row, a V and a bowl/.test(t)), 'EN: Level-Namen und -Beschreibungen (4.0, handgebaut) übersetzt');
  const de = await collect(page, 'de');
  ok(de.some(t => /Neue Kampagne/.test(t)) && de.some(t => /Stasis-Netz: alle Bewegungen/.test(t)), 'DE: Menü, Knöpfe und Legende deutsch');
  const deField = de.filter(t => /^canvas: /.test(t));   // Nutzerwunsch 12.10.: Spielfeld auch in der deutschen Version englisch
  const deAll = de.filter(t => /^(canvas|feld-text): /.test(t)), deBad = deAll.filter(t => GERMAN.test(t.replace(/^[a-z-]+: /, '').replace(/OmniBreaker|Veldspar|Pyroxeres|Omber|Jaspet|Spodumain|Bistot|Arkonor|Mercoxit/g, '')));
  ok(deField.length > 10 && deAll.some(t => /feld-text: Score/.test(t)) && deBad.length === 0, 'DE: Spielfeld englisch – Zeichnung, Anzeigen, Ergebniskarten (' + deAll.length + ' Texte)' + (deBad.length ? '\n   ' + deBad.slice(0, 30).join('\n   ') : ''));
  ok(de.some(t => /Level \d+ cleared!|Practice cleared/.test(t)), 'DE: Ergebniskarte im Spielfeld englisch');
  ok(errs.length === 0, 'keine Seitenfehler ' + errs.join(' | '));
  await browser.close();
  console.log(fails ? '\n' + fails + ' OMNIBREAKER-EN TESTS FAILED' : '\nALL OMNIBREAKER-EN TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
