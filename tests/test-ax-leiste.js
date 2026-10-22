// AX (22.10.2026): Leiste (Aufbau wie ein Overlay-Fenster, echtes CSS der Seite) mit Reitern immer in EVE-Größe (32 px im Stil EVE, Schrift fest), nur der Inhalt zoomt mit Overlay-Größe/Mausrad;
// Windows-Skalierung wird herausgerechnet. Misst ein echtes Overlay-Fenster (fenster=handel) bei Zoom 0,7 / 1 / 1,5 und Windows 150 %.
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    const p = await b.newPage({ viewport: { width: 320, height: 380 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => { const de = document.documentElement; de.classList.add('ov-eve', 'sat-boot', 'sat-win'); document.querySelectorAll('#ov-root').forEach(e => e.remove());
      const r = document.createElement('div'); r.id = 'ov-root'; r.style.display = 'flex'; r.innerHTML = '<div class="ov-bar" id="ov-bar"><div class="ov-tabs"><button class="ov-tab sat-title" aria-selected="true">Hauling</button></div></div><div class="ov-body">x</div>'; document.body.appendChild(r); const out = [];
      for (const [z, dpr] of [[1, 1], [0.7, 1], [1.5, 1], [1, 1.5]]){
        de.style.setProperty('--ov-scale', String(z)); de.style.setProperty('--dpr', String(dpr));
        const bar = document.querySelector('#ov-root > .ov-bar'), body = document.querySelector('#ov-root > .ov-body'), t = document.createElement('span'); t.textContent = 'M'; body.appendChild(t);
        out.push({ z, dpr, bar: Math.round(bar.getBoundingClientRect().height * 10) / 10, txt: Math.round(t.getBoundingClientRect().height * 10) / 10 }); t.remove(); }
      return out; });
    const [a, s, l, w] = m;
    assert(a.bar === 33, 'Stil EVE: Leiste 33 px wie in EVE (' + a.bar + ')');
    assert(s.bar === 33 && l.bar === 33, 'Overlay-Zoom 0,7 und 1,5: Leiste bleibt 33 px');
    assert(s.txt < a.txt && l.txt > a.txt, 'Inhalt zoomt mit (' + s.txt + ' < ' + a.txt + ' < ' + l.txt + ')');
    assert(Math.abs(w.bar * 1.5 - 33) < 0.8, 'Windows 150 %: Leiste in echten Pixeln weiter 33 px (' + w.bar + ' × 1,5)');
    // AY (22.10.): Symbole + Reiter 1:1 wie EVE (Stil EVE)
    const y = await p.evaluate(() => { const r = document.getElementById('ov-root'), bar = r.querySelector('.ov-bar'); r.querySelector('#ov-root > .ov-body');
      bar.insertAdjacentHTML('beforeend', '<button class="ov-ib" id="ov-more"></button><button class="ov-ib" id="ov-lock" aria-pressed="false"></button><button class="ov-ib" id="ov-roll"></button><button class="ov-ib" id="ov-hide"></button>');
      document.documentElement.style.setProperty('--ov-scale', '1'); document.documentElement.style.setProperty('--dpr', '1');
      const L = document.getElementById('ov-lock'), cs = e => getComputedStyle(e), mk = () => cs(L).getPropertyValue('--eic'); const open = mk(); L.setAttribute('aria-pressed', 'true'); const zu = mk();
      const bs = ['ov-more', 'ov-lock', 'ov-roll', 'ov-hide'].map(id => document.getElementById(id).getBoundingClientRect().width);
      return { bar: bar.getBoundingClientRect().height, bs, ic: getComputedStyle(L, '::before').width, col: cs(L).color, open, zu, tab: cs(r.querySelector('.ov-tab')).fontSize, tabCol: cs(r.querySelector('.ov-tab')).color }; });
    assert(y.bar === 33, 'AY: Leiste 33 px wie EVE');
    assert(y.bs.every(w => w === 24) && y.ic === '12px', 'AY: Knöpfe 24 px, Symbole 12 px');
    assert(y.col === 'rgb(207, 206, 204)', 'AY: Symbolfarbe #cfcecc (gemessen)');
    assert(y.open !== y.zu && !/rx/.test(decodeURIComponent(y.zu)) && /evenodd/.test(decodeURIComponent(y.zu)), 'AY: Schloss nur Umriss, gesperrt = anderer Bügel (zu)');
    assert(y.tab === '13px' && y.tabCol === 'rgb(228, 228, 228)', 'AY: Reiter 13 px normal (EVE: Großbuchstaben 9 px), aktiv #e4e4e4');
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exitCode = 1; } finally { await b.close(); }
})();
