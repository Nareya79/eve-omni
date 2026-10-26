// 25.10.2026: OmniMap – Größe von Porträts und Live-Kill-/Alarm-Kästen über den Regler „Größe“ (Ansicht-Leiste) und Strg+Mausrad auf der Karte.
// Vorher schickte Strg+Mausrad über der Karte „mapFont“ der alten Karte (wirkungslos) – Porträts und Kästen blieben gleich groß.
const fs = require('fs');
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
(async () => {
  let br;
  try{
    assert(/function kmMk\(host\)\{ var v = Number\(kmOpt\(host\)\.mk\); return v >= 0\.5 && v <= 2\.5 \? v : 1; \}/.test(html), 'Größe 50–250 %, Standard 100 %');
    assert(/var P = Math\.round\(28 \* kmMk\(host\)\);/.test(html) && /\* F \* \(0\.85 \+ 0\.25 \* s\)/.test(html) && /fs = Math\.round\(11 \* F\), bh = Math\.round\(16 \* F\)/.test(html), 'Porträts, Kugeln und Kill-/Alarm-Kästen rechnen mit der Größe');
    assert(/if \(ev\.target\.closest && ev\.target\.closest\("\.km canvas"\)\) return;/.test(html) && !/type: "mapFont"/.test(html), 'Einzelfenster: Strg+Mausrad über der Karte nicht mehr „mapFont“');
    br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const p = await br.newPage({ viewport: { width: 1300, height: 820 } }), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.addInitScript(() => { if (!sessionStorage.getItem('x')){ sessionStorage.setItem('x', 1); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); } });
    await p.goto('file:///home/claude/EVECore.html'); await tick(1200);
    await p.evaluate(() => document.getElementById('neo-btn-jump').click()); await tick(200);
    await p.evaluate(() => document.getElementById('nav-sub-map').click()); await tick(500);
    // ausgedachter Charakter in Jita + Live-Kill, Bild fehlt absichtlich (Buchstabe) – gemessen wird __meHit
    const put = () => p.evaluate(() => { const h = document.querySelector('#km-big .km'); h.__st.me = [['91000001', '30000142', 'Probe Eins', null, null, 1]]; h.__st.fc = '91000001';
      h.__st.lk = [['30000142', Date.now(), 'Probe-Schiff', 12e6]]; const o = h.__st.o = Object.assign({}, h.__st.o); o.om = Object.assign({}, o.om, { me: true }); window.__test && 0; });
    const size = () => p.evaluate(() => { const h = document.querySelector('#km-big .km'); return (h.__meHit || [])[0] ? h.__meHit[0][2] : 0; });
    await put(); await p.evaluate(() => { const h = document.querySelector('#km-big .km'); h.__st.o.mk = 1; }); await tick(50);
    await p.evaluate(() => { const h = document.querySelector('#km-big .km'); h.__vb = [h.__vb[0], h.__vb[1], h.__vb[2], h.__vb[3]]; }); await tick(200);
    await p.mouse.move(650, 450); await p.mouse.wheel(0, -1); await tick(400);   // neu zeichnen lassen
    const s0 = await size();
    assert(s0 === 28, 'Porträt bei 100 % = 28 px (' + s0 + ')');
    const sz = await p.$('#km-big [data-kmsz]');
    assert(sz && await p.evaluate(e => e.value, sz) === '1', 'Regler „Größe“ in der Ansicht-Leiste, Start 100 %');
    await p.evaluate(e => { e.value = '1.5'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, sz); await tick(400);
    assert(await size() === 42, 'Regler 150 % → Porträt 42 px (' + await size() + ')');
    const mz = await p.evaluate(() => { const v = document.querySelector('#km-big .km-view'); return [getComputedStyle(v).zoom, v.getBoundingClientRect().height]; });
    const cls = await p.evaluate(() => { const h = document.querySelector('#km-big .km'); return [h.clientWidth, h.classList.contains('km-nw')]; });
    assert(cls[1] === (cls[0] / 1.5 < 860), 'wenig Platz (Breite ÷ Größe < 860) → Menüs untereinander (' + cls.join() + ')');
    assert(Number(mz[0]) === 1.5, 'Menüs (Systemnamen, Regionsnamen …) wachsen mit (zoom ' + mz[0] + ', Höhe ' + Math.round(mz[1]) + ' px)');
    await tick(600);
    assert(JSON.parse(await p.evaluate(() => localStorage.getItem('eve-zentrale-map-v1'))).kmO.mk == 1.5, 'Größe gemerkt (gilt auch fürs Overlay)');
    const box = await p.evaluate(() => { const r = document.querySelector('#km-big canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const vb0 = await p.evaluate(() => document.querySelector('#km-big .km').__vb.join());
    await p.mouse.move(box[0], box[1]); await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.mouse.wheel(0, -100); await p.keyboard.up('Control'); await tick(700);
    assert(await size() === 48, 'Strg+Mausrad hoch (2×) → 170 % = 48 px (' + await size() + ')');
    assert(await p.evaluate(() => document.querySelector('#km-big .km').__vb.join()) === vb0, 'Strg+Mausrad zoomt nicht die Karte selbst');
    assert(await p.evaluate(e => e.value, sz) === '1.7', 'Regler zieht mit');
    await p.evaluate(e => e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), sz); await tick(400);
    assert(await size() === 28, 'Doppelklick auf den Regler = wieder 100 %');
    assert(!errs.length, 'keine Seitenfehler ' + (errs[0] || ''));
    await br.close();
    console.log('\nALL KM-GROESSE TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); if (br) await br.close(); process.exit(1); }
})();
