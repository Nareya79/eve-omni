// 27.09.2026: Ladung passte nicht in die Charon (Plan = 100 % Laderaum) – geplant wird mit 1,5 % Luft, Multibuy zeigt die Gesamt-m³
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await new Promise(r => setTimeout(r, 500));
    const T = w.__test;
    // Magnate 2.500 m³ verpackt, Laderaum genau 100 Stück
    const lots = [{ tid: 29248, qty: 1000, price: 1e6, margin: 1e5, vol: 2500, bPrice: 1.1e6 }];
    const r = T.greedyAllocate(lots, l => l.margin, 1e12, 250000);
    assert(r.perItem[29248].q === 98 && r.volUsed <= 250000 * 0.985, 'Plan lässt 1,5 % Luft (98 statt 100 Magnate, ' + r.volUsed + ' m³)');
    // Reserve: Standard 1000 m³, Feld in Hub-Handel und Hauling gleich, 0 = keine
    const d = w.document;
    assert(d.getElementById('is-reserve').value === '1.000' && d.getElementById('hl-reserve').value === '1.000', 'Reserve steht auf 1000 m³');
    const r2 = T.greedyAllocate(lots, l => l.margin, 1e12, 11000);
    assert(r2.perItem[29248].q === 3, 'Reserve geht vom Laderaum ab (11.000 − 1.000 → 3 Magnate)');
    d.getElementById('is-reserve').value = '0'; d.getElementById('is-reserve').dispatchEvent(new w.Event('change'));
    assert(d.getElementById('hl-reserve').value === '0' && T.greedyAllocate(lots, l => l.margin, 1e12, 11000).perItem[29248].q === 4, 'Reserve 0 gilt auch fürs Hauling');
    assert(T.mbVol([{ tid: 1, name: 'A', q: 4, vol: 2500 }, { tid: 2, name: 'B', q: 10, vol: 0.01 }]) === 10000.1, 'Gesamt-m³ der Einkaufsliste');
    assert(T.mbVol([{ tid: 987654321, name: 'X', q: 1 }]) === null, 'unbekanntes Volumen → keine Angabe');
    const b = w.document.createElement('div'); b.appendChild(T.ovMultibuy([{ tid: 1, name: 'Magnate', q: 40, vol: 2500 }]));
    assert(/Multibuy\) · 100\.000 m³/.test(b.textContent) && b.querySelector('[data-copy]').getAttribute('data-copy') === 'Magnate 40', 'Overlay-Multibuy zeigt m³, kopiert nur Name Menge');
    // Reserve auch in den Overlay-Suchoptionen (Hub-Handel + Hauling), Übernahme gilt für beide
    assert(/data-ovf="is-reserve"/.test(T.ovMirrorFields('hub-run')) && /data-ovf="hl-reserve"/.test(T.ovMirrorFields('haul-run')), 'Overlay-Suchoptionen zeigen „Reserve (m³)“');
    T.ovMirrorApply({ 'is-reserve': '106000' });
    assert(d.getElementById('hl-reserve').value === '106.000' && w.localStorage.getItem('eve-zentrale-cargo-reserve-v1') === '106000', 'Reserve aus dem Overlay übernommen und gespeichert');
    // Auto-Erledigt ab 90 % liess 2 Scorpion + 2 Schiffe in der Charon – der Rest wird angezeigt
    const g = { items: { 640: { name: 'Scorpion', b: 2, s: 0, lost: 0 }, 29248: { name: 'Magnate', b: 97, s: 97, lost: 0 }, 588: { name: 'Reaper', b: 1, s: 0, lost: 1 } } };
    assert(T.hrRest(g) === '2× Scorpion', 'Rest: nur Unverkauftes, Verlorenes zählt nicht');
    assert(T.hrRest({ items: { 1: { name: 'A', b: 3, s: 3, lost: 0 } } }) === '', 'alles verkauft → kein Hinweis');
    // wieder geöffneter Lauf mit Rest wird beim Aktualisieren nicht gleich wieder zu (Scorpions blieben in der Charon)
    const now = Date.now(), run = T.hrAdd(1, 'Jita', 2, 'Amarr', [{ tid: 29248, name: 'Magnate', q: 9, sp: 9, p: 1 }, { tid: 640, name: 'Scorpion', q: 1, sp: 1, p: 1 }]);
    T.hrUpdate(run.id, { charId: '111' });
    const tx = { 1: [now, 29248, 9, 1, 1, 1], 2: [now, 640, 1, 1, 1, 1], 3: [now + 1, 29248, 9, 2, 0, 2] };
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx, fee: {}, ord: {}, upd: 0 }));
    const st = () => T.hrLoad().find(r => r.id === run.id);
    await T.hrRefresh2(); assert(st().status === 'done', '90 % verkauft → automatisch erledigt');
    T.hrUpdate(run.id, { status: 'active', keepOpen: true });
    await T.hrRefresh2(); assert(st().status === 'active', 'wieder geöffnet + Rest → bleibt offen');
    tx[4] = [now + 2, 640, 1, 2, 0, 2]; w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx, fee: {}, ord: {}, upd: 0 }));
    await T.hrRefresh2(); assert(st().status === 'active', 'BB10: von Hand wieder geöffnet → bleibt offen, auch wenn alles verkauft');
    console.log('\nALL CARGO TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
