// BF (23.10.2026): Reiter eines Overlay-Stapels per Maus umsortieren. Overlay „trades“ im Stapel trades|route|handel (nachgebautes Programm):
// Reiter innerhalb der Leiste ziehen → Einfügestrich + stackOrder mit neuer Reihenfolge; kurzer Klick → stackTab; aus der Leiste ziehen → stackOut.
const { chromium } = require('playwright');
const fs = require('fs');
const FILE = 'file:///home/claude/EVECore.html';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK: ' : 'FAIL: ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 520, height: 400 } });
  await ctx.route(/^https?:\/\//, r => r.abort());
  await ctx.addInitScript(() => { window.__calls = [];
    const S = { windows: {}, stacks: [{ ids: ['trades', 'route', 'handel'], tab: 'trades' }], viewNames: { trades: 'Trades', route: 'Route', handel: 'Hauling' } };
    const fns = { onCommand: f => setTimeout(() => f({ type: 'settings', settings: S }), 50), getSettings: () => Promise.resolve(S),
      stackOrder: ids => window.__calls.push(['order', ids.join('|')]), stackTab: id => window.__calls.push(['tab', id]), stackOut: id => window.__calls.push(['out', id]), stackOutEnd(){} };
    window.evecoreHost = new Proxy(fns, { get: (t, k) => k in t ? t[k] : (typeof k === 'string' ? function(){ return Promise.resolve(); } : undefined) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE + '?fenster=trades'); await p.waitForTimeout(2500);
  const box = id => p.evaluate(id => { const r = document.querySelector('#ov-tabs [data-stab="' + id + '"] .st-n').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right }; }, id);
  const calls = () => p.evaluate(() => window.__calls.splice(0));
  ok(await p.evaluate(() => [...document.querySelectorAll('#ov-tabs [data-stab]')].map(t => t.getAttribute('data-stab')).join('|')) === 'trades|route|handel', 'Stapel mit drei Reitern gezeichnet');
  // Hauling ganz nach vorn
  let a = await box('handel'), t = await p.evaluate(() => document.querySelector('#ov-tabs [data-stab="trades"]').getBoundingClientRect().left);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x - 20, a.y, { steps: 3 }); await p.mouse.move(t + 2, a.y, { steps: 8 });
  ok(await p.evaluate(() => !!document.querySelector('.st-ins')), 'beim Ziehen erscheint der Einfügestrich');
  await p.mouse.up(); await p.waitForTimeout(100);
  let c = await calls();
  ok(c.length === 1 && c[0][0] === 'order' && c[0][1] === 'handel|trades|route', 'Hauling nach vorn → stackOrder handel|trades|route (' + JSON.stringify(c) + ')');
  ok(await p.evaluate(() => !document.querySelector('.st-ins')), 'nach dem Loslassen ist der Strich weg');
  // Route ans Ende
  a = await box('route'); const h = await box('handel');
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 20, a.y, { steps: 3 }); await p.mouse.move(h.r + 6, a.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(100);
  c = await calls(); ok(c.length === 1 && c[0][1] === 'trades|handel|route', 'Route ans Ende → trades|handel|route');
  // kleine Bewegung an derselben Stelle: keine neue Reihenfolge
  a = await box('route'); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 8, a.y, { steps: 2 }); await p.mouse.up(); await p.waitForTimeout(100);
  c = await calls(); ok(!c.some(x => x[0] === 'order'), 'Ziehen auf die eigene Stelle: keine Umsortierung');
  // Klick
  a = await box('route'); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(100);
  c = await calls(); ok(c.length === 1 && c[0][0] === 'tab' && c[0][1] === 'route', 'kurzer Klick → Reiter nach vorn (stackTab)');
  // aus der Leiste ziehen
  a = await box('route'); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x, a.y + 90, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(100);
  c = await calls(); ok(c.some(x => x[0] === 'out' && x[1] === 'route') && !c.some(x => x[0] === 'order'), 'aus der Leiste gezogen → eigenes Fenster (stackOut), keine Umsortierung');
  const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
  ok(/ipcMain\.on\('evecore:stackOrder'/.test(main) && /ids\.length !== s\.ids\.length \|\| !ids\.every\(id => s\.ids\.includes\(id\)\)/.test(main), 'main.js nimmt nur dieselben Ansichten in neuer Reihenfolge an');
  ok(!errs.length, 'keine Seitenfehler' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
