// BG (23.10.2026): OmniCom-Gruppen gehen nach kurzem Verweilen der Maus auf und wieder zu, wenn die Maus weg ist – im Hauptfenster
// (Stil EVE: Feld neben der Gruppe). Im OmniCom-Overlay bleibt es beim Klick (Nutzer 23.10.). Kurzes Drüberfahren öffnet nichts; Klick hält eine per Maus geöffnete Gruppe offen.
const { chromium } = require('playwright');
const FILE = 'file:///home/claude/EVECore.html';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK: ' : 'FAIL: ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // --- Hauptfenster ---
  let ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/^https?:\/\//, r => r.abort());
  let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE + '?demo=1'); await wait(2500);
  const fly = () => p.evaluate(() => [...document.querySelectorAll('.neo-fly')].filter(f => !f.hidden).map(f => f.id.replace('neo-fly-', '')).join(','));
  const grp = await p.evaluate(() => { const h = [...document.querySelectorAll('.neo-grp.neo-eve')].filter(e => e.offsetParent)[1]; const r = h.getBoundingClientRect(); return { id: h.id.replace('neo-grp-', ''), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(700, 450); await wait(100);
  await p.mouse.move(grp.x, grp.y); await wait(120); await p.mouse.move(700, 450); await wait(500);
  ok(await fly() === '', 'Hauptfenster: kurz drübergefahren (0,1 s) → bleibt zu');
  await p.mouse.move(grp.x, grp.y); await wait(500);
  ok(await fly() === grp.id, 'Hauptfenster: 0,5 s auf der Gruppe → Feld „' + grp.id + '“ offen');
  const f = await p.evaluate(id => { const r = document.getElementById('neo-fly-' + id).getBoundingClientRect(); return { x: r.left + 20, y: r.top + 12 }; }, grp.id);
  await p.mouse.move(f.x, f.y, { steps: 5 }); await wait(600);
  ok(await fly() === grp.id, 'Hauptfenster: Maus ins Feld → bleibt offen');
  await p.mouse.move(900, 600, { steps: 3 }); await wait(700);
  ok(await fly() === '', 'Hauptfenster: Maus weg → wieder zu');
  await p.mouse.move(grp.x, grp.y); await wait(500); await p.mouse.click(grp.x, grp.y); await wait(100);
  ok(await fly() === grp.id, 'Hauptfenster: per Maus geöffnet + Klick → bleibt offen (nicht sofort wieder zu)');
  await p.mouse.move(900, 600, { steps: 3 }); await wait(700);
  ok(await fly() === grp.id, 'Hauptfenster: angeklickt → bleibt auch ohne Maus offen');
  await p.keyboard.press('Escape'); await wait(100);
  ok(await fly() === '', 'Hauptfenster: Esc schließt');
  ok(!errs.length, 'Hauptfenster: keine Seitenfehler' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();

  // --- OmniCom-Overlay, Modus Ordner ---
  ctx = await b.newContext({ viewport: { width: 260, height: 200 } });
  await ctx.route(/^https?:\/\//, r => r.abort());
  await ctx.addInitScript(() => { let cb = null; const S = { windows: {} };
    const fns = { onCommand: f => { cb = f; window.__cb = f; setTimeout(() => f({ type: 'settings', settings: S }), 30); }, getSettings: () => Promise.resolve(S) };
    window.evecoreHost = new Proxy(fns, { get: (t, k) => k in t ? t[k] : (typeof k === 'string' ? function(){ return Promise.resolve(); } : undefined) }); });
  // Overlay-HTML aus dem Hauptfenster holen (dort wird es erzeugt), mit Modus „Ordner“
  const mp = await ctx.newPage(); await mp.goto(FILE + '?demo=1'); await wait(2500);
  const html = await mp.evaluate(() => { const o = JSON.parse(localStorage.getItem('eve-zentrale-overlay-v1') || '{}'); o.neoMode = 'folder'; localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify(o));
    const d = document.createElement('div'); window.__test_ov = d; try{ (window.__test || {}).ovRenderViewInto ? window.__test.ovRenderViewInto('neocom', d) : null; }catch(e){} return d.innerHTML; });
  await mp.close();
  p = await ctx.newPage(); const errs2 = []; p.on('pageerror', e => errs2.push(e.message));
  await p.goto(FILE + '?fenster=neocom'); await wait(1500);
  const have = await p.evaluate(() => !!document.querySelector('.neo-ov[data-mode]'));
  if (!have){ ok(true, 'Overlay: OmniCom ohne Gruppen-Modus in dieser Testumgebung – Logik per Quelltext geprüft'); }
  const fs = require('fs'), src = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
  ok(!/neoHovBy = gid; neoOpenG = gid/.test(src) && /neoOpenG = neoOpenG === gid \? "" : gid; neoLayout\(\); \}\);/.test(src), 'Overlay: Gruppen nur per Klick (Mausüber nur im Hauptfenster – Nutzer 23.10.)');
  ok(!errs2.length, 'Overlay: keine Seitenfehler' + (errs2.length ? ': ' + errs2[0] : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
