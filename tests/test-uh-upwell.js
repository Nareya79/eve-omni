// UH (01.11.2026, Discord-Meldung): Upwell-Hauler in der Schiffsliste + Schalter „Infrastrukturraum mitzählen“
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await new Promise(r => setTimeout(r, 500));
    const T = w.__test, U = T.uh, d = w.document;
    // UH1: alle vier in der Liste, mit ESI-Werten, ohne Laderaum-Bonus je Level
    const S = n => U.flattenShips().find(x => x.name === n);
    const de = S('Deluge (Upwell)'), to = S('Torrent (Upwell)'), sq = S('Squall (Upwell)'), av = S('Avalanche (Upwell)');
    assert(de && de.group === 'Blockade Runner' && de.cap === 4000 && de.ih === 30000 && de.skill === 'Upwell Hauler', 'Deluge bei den Blockade Runnern (4.000 m³ + 30.000 Infrastruktur)');
    assert(to && to.group === 'Deep Space Transport' && to.fh === 30000 && to.ih === 60000, 'Torrent beim DST mit 30.000 Flottenhangar');
    assert(sq && /Industrial/.test(sq.group) && sq.ih === 45000 && av && /Frachter/.test(av.group) && av.cap === 205000 && av.skill === 'Upwell Freighter', 'Squall + Avalanche');
    assert(U.shipCb(de) === 0 && U.shipCb(S('Crane (Caldari)')) === 0.05, 'Upwell: kein +5 %/Level auf den Laderaum, andere Schiffe wie bisher');
    assert(d.querySelector('#hl-max-ship option[value="Deluge (Upwell)"]') && /Infrastruktur/.test(d.querySelector('#hl-max-ship option[value="Deluge (Upwell)"]').textContent), 'Deluge im Hauling wählbar, Infrastrukturraum steht dabei');
    // UH2: Schalter aus = nichts zählt
    assert(U.infraFor('Deluge (Upwell)') === 0, 'Schalter aus → kein Infrastrukturraum');
    w.localStorage.setItem('eve-zentrale-infra-v1', '1');
    assert(U.infraFor('Deluge (Upwell)') === 30000 && U.infraFor('Crane (Caldari)') === 0, 'an, ohne Skill: Grundwert 30.000; Crane hat keinen');
    U.infraLv['Upwell Hauler'] = 5;
    assert(U.infraFor('Deluge (Upwell)') === 45000, 'Upwell Hauler V → 45.000 m³ (wie im Spiel gemeldet)');
    // Ladung: PI (Gruppe 1034, Kat. 43 → hier von Hand) in den Infrastrukturraum, Tritanium nicht
    U.typeGrp[2393] = 1136; U.typeGrp[34] = 18;   // 1136 = Fuel Block (fest erlaubt), 18 = Mineral
    assert(U.infraOk(2393) && !U.infraOk(34), 'erlaubt: Fuel Block; nicht: Mineral');
    d.getElementById('hl-reserve').value = '0'; d.getElementById('hl-reserve').dispatchEvent(new w.Event('change'));
    const lots = () => [{ tid: 2393, qty: 1e6, price: 10, margin: 5, vol: 5, bPrice: 15 }, { tid: 34, qty: 1e6, price: 1, margin: 0.5, vol: 0.01, bPrice: 1.5 }];
    let r = T.greedyAllocate(lots(), l => l.margin / l.vol, 1e12, 4000);
    const fb0 = r.perItem[2393] ? r.perItem[2393].q : 0;
    r = T.greedyAllocate(lots(), l => l.margin / l.vol, 1e12, 4000, Infinity, 45000);
    assert(r.ih === 45000 && r.ihUsed > 44000 && r.ihUsed <= 45000 * 0.985 && r.perItem[2393].q > fb0 * 5, 'Fuel Blocks füllen den Infrastrukturraum (' + Math.round(r.ihUsed) + ' m³)');
    assert(r.volUsed <= 4000 * 0.985, 'normaler Laderaum bleibt in seiner Grenze (' + Math.round(r.volUsed) + ' m³)');
    r = T.greedyAllocate([{ tid: 34, qty: 1e9, price: 1, margin: 0.5, vol: 0.01, bPrice: 1.5 }], l => l.margin, 1e12, 4000, Infinity, 45000);
    assert(r.ihUsed === 0 && r.volUsed <= 4000 * 0.985, 'Tritanium kommt nie in den Infrastrukturraum');
    // Schalter nur bei Upwell-Schiff sichtbar, Text in „Gerechnet wird mit“
    const sel = d.getElementById('hl-max-ship'), pick = n => { sel.value = n; sel.dispatchEvent(new w.Event('change', { bubbles: true })); U.sbRender('hl'); };
    pick('Crane (Caldari)'); assert(d.getElementById('hl-infra').closest('.field').hidden, 'Crane: Schalter versteckt');
    pick('Deluge (Upwell)'); assert(!d.getElementById('hl-infra').closest('.field').hidden && d.getElementById('hl-infra').checked, 'Deluge: Schalter sichtbar und an');
    assert(/45\.000 m³ Infrastruktur/.test(d.getElementById('hl-calc').textContent), '„Gerechnet wird mit“ nennt den Infrastrukturraum');
    assert(/data-ovf="hl-infra"/.test(T.ovMirrorFields('haul-run')), 'Schalter auch in den Overlay-Suchoptionen');
    d.getElementById('is-infra').checked = false; d.getElementById('is-infra').dispatchEvent(new w.Event('change'));
    assert(!d.getElementById('hl-infra').checked && w.localStorage.getItem('eve-zentrale-infra-v1') === '0' && U.infraFor('Deluge (Upwell)') === 0, 'ein Schalter für Hub-Handel + Hauling');
    // Cargo-Rigs (614) zählen im Hangar mit – Kristoffs Deluge: 1× ECH II + 2× Small Cargohold Optimization I = 6.744,8 m³
    const DG = { 1319: { 149: 1.275 }, 31117: { 614: 15 }, 1335: { 150: 1.25, 614: -10 }, 2873: { 6: 1 } };
    w.fetch = u => { const m = /types\/(\d+)\//.exec(String(u)); const a = m && DG[m[1]];
      return a ? Promise.resolve({ ok: true, json: () => Promise.resolve({ dogma_attributes: Object.keys(a).map(k => ({ attribute_id: +k, value: a[k] })) }) }) : Promise.reject(new Error('offline')); };
    const mm = [await U.modMult(1319), await U.modMult(31117), await U.modMult(31117)];
    assert(Math.abs(4000 * mm[0] * mm[1] * mm[2] - 6744.8) < 0.1, 'Deluge mit ECH II + 2 Cargo-Rigs = 6.744,8 m³ (' + (4000 * mm[0] * mm[1] * mm[2]).toFixed(1) + ')');
    assert(await U.modMult(1335) === 0.9 && await U.modMult(2873) === null, 'Reinforced Bulkheads −10 %, Waffe ohne Einfluss');
    console.log('\nALL UH TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
