// AB (17.10.2026): Umkreis-Ergebnis im Hauling-Overlay wie „Feste Hubs“ – zugeklappte Zeilen mit Einsatz, Klick = Hub-Ansicht (⌀ Preise, Multibuy), beste 5 + „mehr anzeigen“
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const item = (tid, name, q, sp, p) => ({ tid: String(tid), name, q, sp, p, vol: 0.01, totalVol: q * 0.01, avgBuy: sp / q, avgSell: (sp + p) / q, maxBuy: sp / q * 1.02 });
const dest = (i, profit) => ({ stationId: i, stationName: 'Station ' + i + ' - Moon 1', systemName: 'Sys' + i, jumps: i + 2, itemCount: 2, profit, spend: profit * 9, iskh: profit / 2,
  items: [item(34, 'Tritanium', 120000, 600000, profit * 0.6), item(2048, 'Damage Control II', 12, 2400000, profit * 0.4)], load: { profit, spend: profit * 9, volUsed: 1200, cargo: 60000 } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    const p = await b.newPage({ viewport: { width: 380, height: 700 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
    const list = [1, 2, 3, 4, 5, 6, 7].map(i => dest(i, (8 - i) * 1e6));
    await p.evaluate(L => { const T = window.__test;
      T.setOvData({ haul: { t: Date.now(), origin: 'Jita IV', originLabel: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', originSys: 'Jita', list: L } });
      T.ovSetMode('compact');
      const s = T.ovLoad(); s.views = s.views.filter(v => v.id !== 'handel').concat([{ id: 'handel', on: true }]); s.view = 'handel'; T.ovSave(s);
      localStorage.setItem('eve-zentrale-handel-mode-v1', 'haul'); T.ovSatAction('handel', { type: 'kkd', arg: 'umkreis' }); }, list);
    await p.waitForTimeout(200);
    const st = () => p.evaluate(() => { const b = document.getElementById('ov-body');
      return { rows: b.querySelectorAll('[data-ova="haulSel"]').length, open: b.querySelectorAll('[data-ova="haulSel"][aria-expanded="true"]').length, cards: b.querySelectorAll('.ov-card:not(.ov-opt)').length,
        first: (b.querySelector('[data-ova="haulSel"]') || {}).textContent || '', more: (b.querySelector('[data-ova="haulMore"]') || {}).textContent || '', text: b.textContent }; });
    let s = await st();
    assert(s.rows === 5 && s.open === 0 && s.cards === 0, 'zugeklappt: die besten 5 Ziele als Zeilen, keine Einkaufsliste (' + JSON.stringify([s.rows, s.open, s.cards]) + ')');
    assert(/Ziel 1: \+7(,0)? Mio\. ISK Gewinn · Einsatz 63(,0)? Mio\. ISK · Sprünge: 3/.test(s.first) && /empfohlen/.test(s.first), 'Zeile mit Gewinn, Einsatz, Sprüngen, empfohlen: ' + s.first);
    assert(/mehr anzeigen \(2\)/.test(s.more), '„mehr anzeigen (2)“');
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'haulMore' })); s = await st();
    assert(s.rows === 7 && /weniger anzeigen/.test(s.more), 'mehr anzeigen → alle 7');
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'haulSel', arg: '0' })); s = await st();
    assert(s.open === 1 && s.cards === 2 && /Einsatz 63(,0)? Mio\. ISK/.test(s.text) && /Einkauf ⌀/.test(s.text) && /Verkauf ⌀/.test(s.text) && /Multibuy|Einkaufsliste kopieren/.test(s.text), 'Klick: Hub-Ansicht mit Einsatz, ⌀ Preisen und Multibuy');
    assert(await p.evaluate(() => !!document.querySelector('#ov-body [data-ova="haulEve"][data-arg="0"]') && !!document.querySelector('#ov-body [data-ova="hrAdd"][data-arg="0"]')), 'Knöpfe Route/→ EVE/Lauf merken für dieses Ziel');
    await p.screenshot({ path: '/tmp/ab-de.png' });
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'haulSel', arg: '0' })); s = await st();
    assert(s.open === 0 && s.cards === 0, 'zweiter Klick klappt zu');
    // Englisch: frische Seite mit Sprache Englisch (Sprachwechsel lädt die Seite neu)
    await p.evaluate(() => localStorage.setItem('eve-zentrale-lang-v1', 'en')); await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(L => { const T = window.__test; T.setOvData({ haul: { t: Date.now(), origin: 'Jita IV', originLabel: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', originSys: 'Jita', list: L } });
      T.ovSetMode('compact'); const s = T.ovLoad(); s.view = 'handel'; T.ovSave(s); T.ovSatAction('handel', { type: 'kkd', arg: 'umkreis' }); T.ovSatAction('handel', { type: 'haulSel', arg: '0' }); }, list);
    await p.waitForTimeout(300); s = await st();
    assert(/Destination 1: \+7(\.0)? M(io\.)? ISK profit/i.test(s.first) && /Investment/.test(s.first) && /recommended/.test(s.first) && /show more \(2\)|show less/.test(s.more), 'EN: Zeile übersetzt: ' + s.first + ' | ' + s.more);
    assert(/Investment/.test(s.text) && !/Einkauf ⌀|Ziel 1|Einsatz|erkannt/.test(s.text), 'EN: aufgeklappte Ansicht ohne deutsche Reste');
    await p.screenshot({ path: '/tmp/ab-en.png' });
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('ALL AB TESTS PASSED');
  }catch(e){ console.log(e.stack || e.message); await b.close(); process.exit(1); }
  await b.close(); process.exit(0);
})();
