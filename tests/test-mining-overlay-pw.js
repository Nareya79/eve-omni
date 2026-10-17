// Mining-Overlay (14.10.2026), echter Browser: im schmalen Overlay ist nichts abgeschnitten (Reiter-Gruppen umbrechen, Erz-Zeilen passen),
// Screenshots Overlay klein + groß + Hauptfenster (DE) und Overlay klein (EN) nach /tmp/mining-*.png
const { chromium } = require('playwright');
const FILE = 'file:///tmp/eve-zentrale-test14.html';
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const day = o => new Date(Date.now() - o * 864e5).toISOString().slice(0, 10);
const JWT = 'x.' + Buffer.from(JSON.stringify({ scp: ['esi-industry.read_character_mining.v1'] })).toString('base64') + '.y';
const ORES = [1230, 1228, 1224, 46281, 46319, 17471];   // Veldspar, Scordite, Pyroxeres, Glistening Zeolites, Shining Ytterbite, Veldspar III-Grade (lange Namen)
const ledger = { 111: [], 222: [] };
ORES.forEach((t, i) => { ledger[111].push({ date: day(0), solar_system_id: i % 2 ? 30000144 : 30000142, type_id: t, quantity: 1000 * (i + 1) }); ledger[111].push({ date: day(i % 5 + 1), solar_system_id: 30000142, type_id: t, quantity: 4000 }); });
ledger[222].push({ date: day(0), solar_system_id: 30002768, type_id: 1228, quantity: 12345 });
const PX = { 1230: 20, 1228: 15, 1224: 30, 46281: 900, 46319: 4000, 17471: 22 };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    async function page(lang, vp){
      const ctx = await b.newContext({ viewport: vp });
      await ctx.route(/^https?:\/\//, r => { const u = r.request().url(); let m;
        const J = x => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'x-pages': '1' }, body: JSON.stringify(x) });
        if ((m = /characters\/(\d+)\/mining\//.exec(u))) return J(ledger[m[1]] || []);
        if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))) return J(PX[m[1]] ? [{ is_buy_order: true, location_id: 60003760, system_id: 30000142, range: 'station', price: PX[m[1]], volume_remain: 1e9, min_volume: 1, order_id: 1, type_id: +m[1], duration: 90, issued: '2026-10-01T00:00:00Z' }] : []);
        return r.abort(); });
      await ctx.addInitScript(([lang, jwt]) => {
        if (sessionStorage.__x) return; sessionStorage.__x = 1;
        localStorage.setItem('eve-zentrale-lang-v1', lang); localStorage.setItem('eve-zentrale-welcome-v1', 'done');
        localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: jwt, refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Taron Velkar' }, { access_token: jwt, refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '222', character_name: 'Lirae Ostrander' }]));
        localStorage.setItem('eve-zentrale-miningledger-v1', JSON.stringify({ e: {}, cn: {} }));
        localStorage.setItem('eve-zentrale-syssec-v1', JSON.stringify({ sys: { 30000142: { n: 'Jita', s: 0.946, c: 1, r: 10000002 }, 30000144: { n: 'Perimeter', s: 0.95, c: 1, r: 10000002 }, 30002768: { n: 'Uedama', s: 0.5, c: 4, r: 10000033 } }, reg: { 10000002: 'The Forge', 10000033: 'The Citadel' } }));
        localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ view: 'mining', views: [{ id: 'mining', on: true }] }));
      }, [lang, JWT]);
      const p = await ctx.newPage();
      await p.goto(FILE); await p.waitForTimeout(800);
      return p;
    }
    async function overlay(p){
      await p.evaluate(() => window.__test.ovSetMode('compact')); await p.waitForTimeout(800);
      await p.click('#ov-root [data-ova="miView"][data-arg="log"]'); await p.waitForTimeout(300);
      await p.click('#ov-root [data-ova="mlGo"]'); await p.waitForTimeout(1500);
    }
    const clipped = p => p.evaluate(() => {   // Knöpfe/Zeilen, die über den Rand ragen oder deren Text abgeschnitten ist
      const W = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#ov-root .mi-view button, #ov-root .mi-grp-t, #ov-root .mi-desc, #ov-root [data-ova="mlDays"], #ov-root [data-ova="mlGo"], #ov-root .ml-head, #ov-root .ml-row, #ov-root .ml-ore, #ov-root .ml-sum span, #ov-root .ml-more, #ov-root .ml-ore .mi-n').forEach(e => {
        const r = e.getBoundingClientRect(); if (!r.width) return;
        if (r.right > W + 1 || r.left < -1 || e.scrollWidth > e.clientWidth + 1) out.push((e.className || e.tagName) + ' „' + e.textContent.trim().slice(0, 30) + '“ ' + Math.round(r.left) + '–' + Math.round(r.right) + '/' + W + ' sw ' + e.scrollWidth + '>' + e.clientWidth);
      });
      return out;
    });
    // Overlay klein (DE)
    let p = await page('de', { width: 320, height: 640 });
    await overlay(p);
    assert(await p.$$eval('#ov-root .ml-ore', l => l.length) >= 4 && /\+ \d+ weitere/.test(await p.textContent('#ov-root')), 'Overlay klein: Erze je Charakter + „weitere“');
    let c = await clipped(p);
    assert(!c.length, 'Overlay klein (320 px): nichts abgeschnitten' + (c.length ? ': ' + c.join(' | ') : ''));
    await p.screenshot({ path: '/tmp/mining-overlay-klein.png' });
    for (const v of ['calc', 'table', 'sell', 'moon']){
      await p.click('#ov-root [data-ova="miView"][data-arg="' + v + '"]'); await p.waitForTimeout(300);
      c = await clipped(p); assert(!c.length, 'Overlay klein, Reiter ' + v + ': Reiterleiste nicht abgeschnitten' + (c.length ? ': ' + c.join(' | ') : ''));
    }
    await p.click('#ov-root [data-ova="miView"][data-arg="calc"]'); await p.waitForTimeout(300);
    await p.screenshot({ path: '/tmp/mining-overlay-klein-rechner.png' });
    await p.context().close();
    // Overlay groß (DE)
    p = await page('de', { width: 620, height: 720 });
    await overlay(p);
    c = await clipped(p); assert(!c.length, 'Overlay groß (620 px): nichts abgeschnitten' + (c.length ? ': ' + c.join(' | ') : ''));
    await p.screenshot({ path: '/tmp/mining-overlay-gross.png' });
    await p.context().close();
    // Hauptfenster (DE)
    p = await page('de', { width: 1400, height: 1000 });
    await p.evaluate(() => window.__test.switchTab('mining')); await p.waitForTimeout(500);
    await p.click('#mi-page [data-ova="miView"][data-arg="log"]'); await p.waitForTimeout(300);
    await p.click('#mi-page [data-ova="mlGo"]'); await p.waitForTimeout(1500);
    assert(await p.$$eval('#mi-page .ml-ore', l => l.length) === 7 && await p.$$eval('#mi-page .ml-t tr.ml-dh', l => l.length) >= 2, 'Hauptfenster: alle 7 Erze heute + Tabelle je Tag');
    await p.screenshot({ path: '/tmp/mining-hauptfenster.png', fullPage: true });
    await p.context().close();
    // Overlay klein (EN)
    p = await page('en', { width: 320, height: 640 });
    await overlay(p);
    c = await clipped(p); assert(!c.length, 'EN Overlay klein: nichts abgeschnitten' + (c.length ? ': ' + c.join(' | ') : ''));
    const t = await p.textContent('#ov-root .mi-view') + ' ' + await p.textContent('#ov-root .ml-head');
    assert(/My mining/.test(t) && /Plan & sell/.test(t) && /Mined today/.test(t), 'EN: Gruppen und Kopf englisch: ' + t.replace(/\s+/g, ' ').slice(0, 120));
    await p.screenshot({ path: '/tmp/mining-overlay-klein-en.png' });
    await p.context().close();
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); await b.close(); process.exit(1); }
  await b.close(); process.exit(0);
})();
