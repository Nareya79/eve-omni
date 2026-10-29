// WM4 (28.10.2026, Issue #8): Thera/Turnur – gleiche Signatur-ID im gleichen System (EVE-Scout) → Vorschlag, erst nach Bestätigung in der Kette
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test;
    T.thStateSet([{ out_system_id: 31000005, out_system_name: 'Thera', out_signature: 'AAA-111', in_system_id: 31002318, in_system_name: 'J111613', in_signature: 'IDM-628', in_system_class: 'c5', max_ship_size: 'large', remaining_hours: 11, expires_at: new Date(Date.now() + 11 * 3600e3).toISOString() },
                   { out_system_id: 30045328, out_system_name: 'Turnur', out_signature: 'TTT-999', in_system_id: 31002318, in_system_name: 'J111613', in_signature: 'ZZZ-000', max_ship_size: 'medium', remaining_hours: 3 }]);
    assert(T.wmScout('j111613').map(m => m.id + '>' + m.to).sort().join() === 'IDM-628>Thera,ZZZ-000>Turnur' && T.wmScout('Thera')[0].to === 'J111613', 'wmScout: beide Richtungen, Groß/klein egal');
    T.wmAction({ type: 'whMapPick', arg: 'J111613' });
    await T.wmFromText('IDM-628\tCosmic Signature\t\t\t0.0%\t27.89 AU\nIRM-820\tCosmic Signature\t\t\t0.0%\t21.63 AU', false);
    let h = T.wmHtml(), b = w.document.createElement('div'); b.innerHTML = h;
    assert(b.querySelector('[data-ova="whMapScout"][data-arg="IDM-628"]') && /Vorschlag: → Thera/.test(b.textContent) && /large · noch ~11 Std\./.test(b.textContent), 'Vorschlag am Treffer (auch unbestimmte Signatur), mit Größe und Restzeit');
    assert(!b.querySelector('[data-arg="IRM-820"][data-ova="whMapScout"]'), 'kein Vorschlag ohne Treffer');
    assert(/EVE-Scout kennt hier: ZZZ-000 → Turnur/.test(b.textContent), 'Hinweis: EVE-Scout-Loch, das der Scan nicht hat');
    assert(!T.wmLoad().sys.J111613.sg['IDM-628'].to && !/EVE-Scout → Thera/.test(b.textContent), 'nichts still übernommen');
    T.wmAction({ type: 'whMapScout', arg: 'IDM-628' });
    let o = T.wmLoad().sys.J111613.sg['IDM-628'];
    assert(o.k === 'wh' && o.to === 'Thera' && o.src === 'EVE-Scout' && o.sz === 'large', 'Übernehmen: Wurmloch → Thera, Quelle gemerkt');
    b.innerHTML = T.wmHtml();
    assert(!b.querySelector('[data-ova="whMapScout"]') && /IDM-628 · EVE-Scout → Thera/.test(b.textContent) && /large · bis/.test(b.textContent), 'Kette zeigt Thera mit Quelle; Vorschlag weg');
    // Nein: Vorschlag verschwindet, Ziel bleibt leer
    await T.wmFromText('IRM-820\tCosmic Signature\t\t\t0.0%\t21.63 AU\nZZZ-000\tCosmic Signature\t\t\t0.0%\t1 AU', false);
    b.innerHTML = T.wmHtml();
    assert(b.querySelector('[data-ova="whMapScout"][data-arg="ZZZ-000"]') && !/kennt hier/.test(b.textContent), 'neuer Scan: ZZZ-000 jetzt als Vorschlag statt Hinweis');
    T.wmAction({ type: 'whMapScoutNo', arg: 'ZZZ-000' });
    b.innerHTML = T.wmHtml();
    assert(!b.querySelector('[data-ova="whMapScout"]') && !T.wmLoad().sys.J111613.sg['ZZZ-000'].to, 'Nein: Vorschlag weg, nichts verknüpft');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
