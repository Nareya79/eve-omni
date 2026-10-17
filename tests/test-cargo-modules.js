// Verifies the new "echte Cargo-Module" feature in der Schiffsempfehlung, added after user feedback:
// Basis bleibt IMMER der Skill-Bonus (+5%/Level auf den maßgeblichen Skill, wie bisher). ZUSÄTZLICH wird
// live in den Assets nachgeschaut, ob der Charakter das jeweilige Schiff tatsächlich besitzt und ob darin
// echte cargo-relevante Module/Rigs (Dogma-Attribut 149 "cargoCapacityMultiplier", z.B. Expanded Cargohold II)
// gefittet sind. Wird sowas gefunden, fließt der reale Bonus zusätzlich ein und
// die Spalte "Cargo-Module (echt)" zeigt ihn; wird nichts gefunden (Schiff nicht besessen, oder besessen aber
// nichts gefittet), bleibt es exakt bei der Skill-Basis ("Skill-Basis" in der Spalte) - kein angenommenes Maximum.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const NAME_IDS = {
  'Caldari Industrial': 2001,
  'Minmatar Industrial': 2002,
  'Badger': 3001,
  'Mammoth': 3002,
  'Expanded Cargohold II': 4001,   // Dogma 149 = 1.275 (+27.5%)
  'Expanded Cargohold I': 4002,    // Dogma 149 = 1.15  (+15%), zweites Modul
  '125mm Gatling AutoCannon II': 4003, // kein Cargo-Modul (kein Attribut 149) -> wird ignoriert
};
const SHIP_TYPE_STATS = {
  3001: { mass: 8000000, attrs: { 70: 3.6, 1281: 3 } },  // Badger
  3002: { mass: 9000000, attrs: { 70: 3.2, 1281: 3 } },  // Mammoth
};
const MODULE_CARGO_MULT = {
  4001: 1.275, // Expanded Cargohold II
  4002: 1.15,  // Expanded Cargohold I
};

// Alice: zwei Badger im Hangar.
//   - Badger A (item 9001): ungefittet -> keine echten Cargo-Module gefunden.
//   - Badger B (item 9002): Expanded Cargohold II + Expanded Cargohold I gefittet (+ ein Waffenmodul ohne
//     Cargo-Bezug, das ignoriert werden muss) -> das ist die bessere der beiden eigenen Instanzen, also
//     MUSS deren Bonus in der Empfehlung stehen (beste eigene Instanz gewinnt).
// Mammoth (item 9010): keine Instanz besessen (kommt in den Assets gar nicht vor) -> reine Skill-Basis.
const ASSETS_ALICE = [
  { item_id: 9001, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 3001, quantity: 1 }, // Badger A (Hülle)
  { item_id: 9002, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 3001, quantity: 1 }, // Badger B (Hülle)
  { item_id: 9101, location_id: 9002, location_type: 'other', location_flag: 'LoSlot0', type_id: 4001, quantity: 1 },     // in Badger B: Expanded Cargohold II
  { item_id: 9102, location_id: 9002, location_type: 'other', location_flag: 'LoSlot1', type_id: 4002, quantity: 1 },     // in Badger B: Expanded Cargohold I
  { item_id: 9103, location_id: 9002, location_type: 'other', location_flag: 'HiSlot0', type_id: 4003, quantity: 1 },    // in Badger B: Waffe (kein Cargo-Bezug)
];
const SKILLS_ALICE = [
  { skill_id: NAME_IDS['Caldari Industrial'], trained_skill_level: 3 },
  { skill_id: NAME_IDS['Minmatar Industrial'], trained_skill_level: 4 }, // fliegbar, aber keine Mammoth im Hangar
];

const CHARS = [
  { access_token: 'tokA', refresh_token: 'rA', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Alice' },
];

function makeFetchMock() {
  return function (url, opts) {
    const u = String(url);
    if (u.indexOf('/universe/ids/') !== -1 && opts && opts.method === 'POST') {
      const names = JSON.parse(opts.body);
      const inventory_types = names.filter(n => NAME_IDS[n] !== undefined).map(n => ({ name: n, id: NAME_IDS[n] }));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ inventory_types }) });
    }
    let m = u.match(/\/characters\/(\d+)\/assets\//);
    if (m) {
      const list = m[1] === '111' ? ASSETS_ALICE : [];
      return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(list) });
    }
    m = u.match(/\/characters\/(\d+)\/skills\//);
    if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: m[1] === '111' ? SKILLS_ALICE : [] }) });
    m = u.match(/\/characters\/(\d+)\/implants\//);
    if (m) return Promise.resolve({ ok: false, status: 403 }); // nicht relevant für diesen Test
    m = u.match(/\/universe\/types\/(\d+)\//);
    if (m) {
      const tid = Number(m[1]);
      if (SHIP_TYPE_STATS[tid]) {
        const s = SHIP_TYPE_STATS[tid];
        const dogma_attributes = Object.keys(s.attrs).map(k => ({ attribute_id: Number(k), value: s.attrs[k] }));
        const nameEntry = Object.keys(NAME_IDS).find(n => NAME_IDS[n] === tid);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ mass: s.mass, dogma_attributes, name: nameEntry || ('#' + tid) }) });
      }
      if (MODULE_CARGO_MULT[tid] !== undefined) {
        const nameEntry = Object.keys(NAME_IDS).find(n => NAME_IDS[n] === tid);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          name: nameEntry || ('#' + tid),
          dogma_attributes: [{ attribute_id: 149, value: MODULE_CARGO_MULT[tid] }]
        }) });
      }
      if (tid === 4003) { // Waffe: hat dogma_attributes, aber KEIN Attribut 149
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: '125mm Gatling AutoCannon II', dogma_attributes: [{ attribute_id: 999, value: 1 }] }) });
      }
      const nameEntry = Object.keys(NAME_IDS).find(n => NAME_IDS[n] === tid);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: nameEntry || ('#' + tid) }) });
    }
    return Promise.reject(new Error('unexpected fetch: ' + u));
  };
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '111');
    // Auswahl-Checkliste explizit auf genau die zwei hier relevanten Schiffe setzen (NICHT null lassen -
    // null würde den separaten, bereits existierenden "erster Seitenaufruf"-Auto-Scan auslösen (siehe
    // test-owned-ships.js), der die Auswahl selbst schon auf Basis der Assets verändert und diesen Test
    // verfälschen würde; der hier zu testende Cargo-Modul-Bonus ist ein davon unabhängiges Feature).
    window.localStorage.setItem('eve-zentrale-owned-ships-v1', JSON.stringify(['Badger (Caldari)', 'Mammoth (Minmatar)']));
    window.fetch = makeFetchMock();
  }
});
const { window } = dom;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

setTimeout(async () => {
  try {
    const doc = window.document;
    const T = window.__test;
    assert(T && T.combineCargoMultipliers && T.getModuleCargoMultiplier, '__test hook exposes die Cargo-Modul-Funktionen');

    // --- Unit: O3 Cargo-Module haben keine Stacking-Penalty (ESI: Attribut 149 stackable) -> reines Produkt ---
    const expectedFull = 1.275 * 1.15;
    assert(Math.abs(T.combineCargoMultipliers([1.275, 1.15]) - expectedFull) < 1e-9, 'O3: combineCargoMultipliers multipliziert ohne Stacking-Penalty');
    assert(Math.abs(T.combineCargoMultipliers([1.275, 1.275, 1.275]) - Math.pow(1.275, 3)) < 1e-9, 'O3: 3× Expanded Cargohold II = 1,275³');

    // --- Unit: getModuleCargoMultiplier liest Dogma-Attribut 149 live per ESI ---
    assert(Math.abs((await T.getModuleCargoMultiplier(4001)) - 1.275) < 1e-9, 'getModuleCargoMultiplier(Expanded Cargohold II) liefert 1.275 aus Dogma-Attribut 149');
    assert((await T.getModuleCargoMultiplier(4003)) === null, 'getModuleCargoMultiplier bei einem Modul ohne Attribut 149 (Waffe) liefert null');

    // --- End-to-end über runShipRecommendation ---
    await T.runShipRecommendation('hl', 3000, 2);
    const rows = Array.from(doc.querySelectorAll('#hl-shiprec-body tr'));
    // I14: nur Schiffe aus dem Hangar - die Mammoth besitzt Alice nicht, faellt raus
    assert(rows.length === 1 && rows[0].textContent.indexOf('Mammoth') === -1, 'I14: nur die Badger aus dem Hangar, nicht besessene Mammoth fehlt (got ' + rows.length + ')');
    assert(doc.getElementById('hl-fitting-wrap').hidden, 'I14: Badger ist gefittet und reicht - kein Fitting-Vorschlag');
    await T.runShipRecommendation('hl', 999999, 2);
    assert(!doc.getElementById('hl-fitting-wrap').hidden && /Industrial/.test(doc.getElementById('hl-fitting-wrap').textContent), 'I14: reicht nicht - Fitting-Vorschlag erscheint von selbst');
    await T.runShipRecommendation('hl', 3000, 2);
    const badgerRow = rows[0];
    assert(/aus dem Hangar/.test(doc.getElementById('hl-shiprec-status').textContent), 'I14: Status nennt Hangar-Schiffe');
    function modCellText(row){ return row.querySelector('td[data-label="Cargo-Module (echt)"]').textContent.trim(); }
    function capCellValue(row){ return parseFloat(row.querySelector('td[data-label="Effektiver Laderaum"]').textContent.replace(/\./g,'').replace(',','.').replace(' m³','')); }

    // Badger: Alice hat Caldari Industrial III -> Skill-Basis = 3900 * (1+3*0.05) = 4485. Die BESSERE der
    // beiden besessenen Badger-Instanzen (Badger B, gefittet) muss verwendet werden -> zusätzlicher
    // Multiplikator = expectedFull von oben.
    const badgerSkillCap = 3900 * (1 + 3 * 0.05);
    const expectedBadgerCap = badgerSkillCap * expectedFull;
    assert(Math.abs(capCellValue(badgerRow) - expectedBadgerCap) < 1, 'Badger-Zeile: effektiver Laderaum enthält den echten, Modul-Bonus der besseren eigenen Instanz (' + capCellValue(badgerRow) + ' vs ' + expectedBadgerCap.toFixed(1) + ')');
    const badgerBonusPct = (expectedFull - 1) * 100;
    assert(modCellText(badgerRow).indexOf('+') === 0 && Math.abs(parseFloat(modCellText(badgerRow).replace('+','').replace(',','.').replace(' %','')) - badgerBonusPct) < 0.2,
      'Badger-Zeile: Spalte "Cargo-Module (echt)" zeigt den gefundenen Prozent-Bonus (' + modCellText(badgerRow) + ' vs +' + badgerBonusPct.toFixed(1) + ' %)');

    console.log('\\nALL CARGO-MODULE TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 500);
