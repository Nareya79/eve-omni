// AF5 (18.10.2026): Kopfbalken der Overlay-Fenster im Stil EVE – links ⤢, Titel links, rechts ⋮ · Schloss · — · ×;
// ⋮-Menü löst die versteckten Knöpfe aus (Aktualisieren, Durchklicken, Vordergrund, Fenster-Optionen), — klappt ein wie Doppelklick.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve\.sat-win:not\(\.sat-neo\) #ov-root :is\(#ov-refresh, #ov-ct, #ov-pin, #ov-settings\)\{display:none\}/.test(css), 'Stil EVE: ⟳, Durchklicken, Vordergrund, ⚙ nicht in der Leiste');
    assert(/\.ov-more-b, \.ov-roll-b, \.ov-more-m\{display:none\}/.test(css) && /html\.ov-eve\.sat-win:not\(\.sat-neo\) #ov-root :is\(\.ov-more-b, \.ov-roll-b\)\{display:inline-flex\}/.test(css), '⋮ und — nur im Stil EVE (EVE Omni unverändert)');
    assert(/html\.ov-eve\.sat-win #ov-root \.sat-title\{font-weight:400/.test(css) && !/sat-title\{position:static/.test(css) && /html\.ov-eve svg\.ic2 > rect\[rx="44"\]\{rx:0\}/.test(css), 'Titel bleibt mittig (Nutzer 18.10.), Schrift wie EVE; Symbolrahmen eckig (AG3)');
    const H = { actions: [], mini: [], settings: [] };
    const host = { getSettings: () => Promise.resolve({ alwaysOnTop: true }), setSettings: p => { H.settings.push(p); return Promise.resolve(p); }, onCommand(cb){ H.cmd = cb; }, ready(){},
      satAction: a => H.actions.push(a), closeSelf(){}, resizeTo(){}, resizeEnd(){}, satMini: h => H.mini.push(h) };
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=route', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.evecoreHost = host; } }).window;
    await tick(400);
    const d = w.document, $ = id => d.getElementById(id);
    const ids = [...$('ov-bar').querySelectorAll('button')].map(b => b.id).filter(i => /ov-(more|lock|roll|hide)/.test(i));
    assert(ids.join(',') === 'ov-more,ov-lock,ov-roll,ov-hide', 'Reihenfolge rechts: ⋮ · Schloss · — · × (' + ids + ')');
    $('ov-more').onclick({ stopPropagation(){} });
    const items = [...$('ov-more-m').querySelectorAll('[data-more]')];
    assert(!$('ov-more-m').hidden && items.map(b => b.getAttribute('data-more')).join(',') === 'ov-refresh,ov-ct,ov-pin,ov-settings', 'Menü: Aktualisieren, Durchklicken, Vordergrund, Fenster-Optionen');
    assert(/Aktualisieren/.test(items[0].textContent) && /Immer im Vordergrund/.test(items[2].textContent), 'kurze Bezeichnungen');
    items[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert(H.actions.some(a => a.type === 'refresh') && $('ov-more-m').hidden, 'Eintrag „Aktualisieren“ löst ⟳ aus, Menü schließt');
    $('ov-roll').onclick();
    assert(H.mini.length === 1, '— klappt ein (wie Doppelklick)');
    w.close();
    console.log('\nALL AF5 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
