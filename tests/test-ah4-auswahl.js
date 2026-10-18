// AH4 (18.10.2026): Auswahllisten im Stil EVE – beim Aufklappen (pointerdown/Tasten) bekommt das Feld .eve-sel (appearance base-select,
// Liste wie das EVE-Menü), die Größe wird vorher festgehalten; beim Verlassen zurück. Stil EVE Omni und Mehrfachauswahl unberührt.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve select\.eve-sel, html\.ov-eve select\.eve-sel::picker\(select\)\{appearance:base-select\}/.test(css), 'base-select nur mit .eve-sel (geschlossene Felder unverändert)');
    assert(/html\.ov-eve select\.eve-sel::picker\(select\)\{background:color-mix\(in srgb, var\(--bg\) 94%, #a0b0c8\);border:1px solid[^}]*border-radius:0/.test(css) && /option:is\(:hover, :focus-visible\)\{background:color-mix\(in srgb, var\(--accent\) 27%/.test(css), 'Liste wie das EVE-Menü');
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true, beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(600);
    const d = w.document, de = d.documentElement;
    de.classList.add('ov-eve'); de.classList.remove('ov-omni');
    const s = d.createElement('select'); s.innerHTML = '<option>a</option><option>b</option>'; d.body.appendChild(s);
    s.getBoundingClientRect = () => ({ width: 120, height: 21 }); Object.defineProperty(s, 'offsetWidth', { get: () => 120 });
    s.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert(s.classList.contains('eve-sel') && s.style.width === '120px' && s.style.height === '21px', 'Aufklappen: .eve-sel, Größe festgehalten');
    s.dispatchEvent(new w.Event('blur'));
    assert(!s.classList.contains('eve-sel') && s.style.width === '' && s.style.height === '', 'Verlassen: zurück wie vorher');
    const m = d.createElement('select'); m.multiple = true; d.body.appendChild(m);
    m.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert(!m.classList.contains('eve-sel'), 'Mehrfachauswahl unberührt');
    de.classList.remove('ov-eve'); de.classList.add('ov-omni');
    s.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert(!s.classList.contains('eve-sel'), 'Stil EVE Omni unberührt');
    w.close();
    console.log('\nALL AH4 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
