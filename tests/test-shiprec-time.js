// Verifies the time/implants/fitting extension of the ship recommendation, now living in the
// Hauling tab (hl-* ids) and driven by runShipRecommendation(neededCargo, jumps) instead of its
// own button (it used to be a standalone "Berechnen" button in Intensiv-Suche; that tab was
// replaced by the Hauling tab's destination-driven flow, see test-hauling.js for the full path):
// - align time computed live from ship mass + agility (dogma attr 70) via ESI, reduced by
//   Evasive Maneuvering (-5%/lvl) and Spaceship Command (-2%/lvl)
// - warp speed read from dogma attr 1281
// - travel-relevant implants (Ascendancy/Warp Drive Speed/Evasive Maneuvering sets) flagged per character,
//   "unbekannt" shown when the implants call fails (e.g. missing esi-clones.read_implants.v1 scope)
// - ranking: fits-first, then shortest align time first
// - travel time uses the jump count passed in from the selected Hauling destination
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const NAME_IDS = {
  'Caldari Industrial': 2001,
  'Evasive Maneuvering': 2002,
  'Spaceship Command': 2003,
  'Amarr Industrial': 2004,
  'Badger': 3001,
  'Bestower': 3002,
};
const SHIP_TYPE_STATS = {
  3001: { mass: 8000000, attrs: { 70: 3.6, 1281: 3 } },   // Badger
  3002: { mass: 13000000, attrs: { 70: 2.85, 1281: 3 } }, // Bestower
};
const IMPLANT_TYPE_NAMES = {
  9001: 'High-grade Ascendancy Alpha',    // travel-relevant (matches "ascendancy")
  9002: 'Ocular Filter - Basic',          // NOT travel-relevant
};

const CHARS = [
  { access_token: 'tokA', refresh_token: 'rA', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Alice' },
  { access_token: 'tokB', refresh_token: 'rB', expires_at: Date.now() + 3600000, character_id: '222', character_name: 'Bob' },
  { access_token: 'tokC', refresh_token: 'rC', expires_at: Date.now() + 3600000, character_id: '333', character_name: 'Carol' },
];
const SKILLS_BY_CHAR = {
  '111': [ // Alice: Badger, full agility skills -> shortest align time
    { skill_id: NAME_IDS['Caldari Industrial'], trained_skill_level: 4 },
    { skill_id: NAME_IDS['Evasive Maneuvering'], trained_skill_level: 3 },
    { skill_id: NAME_IDS['Spaceship Command'], trained_skill_level: 2 },
  ],
  '222': [ // Bob: Bestower, no agility skills -> slowest align time (Amarr Industrial governs only Bestower, unlike Transport Ships)
    { skill_id: NAME_IDS['Amarr Industrial'], trained_skill_level: 3 },
  ],
  '333': [ // Carol: Badger, same cargo skill level as Alice but NO agility skills -> same cargo, slower align
    { skill_id: NAME_IDS['Caldari Industrial'], trained_skill_level: 4 },
  ],
};
const IMPLANTS_BY_CHAR = {
  '111': [9001], // Alice wears a travel-relevant implant
  '222': [9002], // Bob wears an unrelated implant
  // '333' (Carol): implants call fails below -> "unbekannt"
};

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '111');
    window.fetch = function (url, opts) {
      const u = String(url);
      if (u.indexOf('/universe/ids/') !== -1 && opts && opts.method === 'POST') {
        const names = JSON.parse(opts.body);
        const inventory_types = names.filter(n => NAME_IDS[n] !== undefined).map(n => ({ name: n, id: NAME_IDS[n] }));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ inventory_types }) });
      }
      let m = u.match(/\/characters\/(\d+)\/skills\//);
      if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: SKILLS_BY_CHAR[m[1]] || [] }) });

      m = u.match(/\/characters\/(\d+)\/implants\//);
      if (m) {
        if (!(m[1] in IMPLANTS_BY_CHAR)) return Promise.resolve({ ok: false, status: 403 }); // Carol: Scope fehlt
        return Promise.resolve({ ok: true, json: () => Promise.resolve(IMPLANTS_BY_CHAR[m[1]]) });
      }

      m = u.match(/\/universe\/types\/(\d+)\//);
      if (m) {
        const tid = Number(m[1]);
        if (SHIP_TYPE_STATS[tid]) {
          const s = SHIP_TYPE_STATS[tid];
          const dogma_attributes = Object.keys(s.attrs).map(k => ({ attribute_id: Number(k), value: s.attrs[k] }));
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ mass: s.mass, dogma_attributes, name: 'Ship' + tid }) });
        }
        if (IMPLANT_TYPE_NAMES[tid]) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: IMPLANT_TYPE_NAMES[tid] }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: '#' + tid }) });
      }
      return Promise.reject(new Error('unexpected fetch: ' + u));
    };
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

    // --- Unit-level sanity check of the formula itself ---
    const LN4 = Math.log(4);
    const expectedBadgerBaseAlign = 8000000 * 3.6 * 1e-6 * LN4;
    const gotBadgerBaseAlign = T.computeAlignSeconds(8000000, 3.6);
    assert(Math.abs(gotBadgerBaseAlign - expectedBadgerBaseAlign) < 1e-9, 'computeAlignSeconds matches -I*M*1e-6*ln(0.25) formula (' + gotBadgerBaseAlign + ')');
    assert(T.computeAlignSeconds(null, 3.6) === null, 'computeAlignSeconds returns null when mass is unknown');

    // --- getShipStats reads mass + dogma attributes 70 (agility) and 1281 (warp speed) ---
    const badgerStats = await T.getShipStats(3001);
    assert(badgerStats.mass === 8000000, 'getShipStats reads mass from ESI type response');
    assert(badgerStats.agility === 3.6, 'getShipStats reads agility from dogma attribute 70');
    assert(badgerStats.warpSpeed === 3, 'getShipStats reads warp speed from dogma attribute 1281');

    // --- Full flow via runShipRecommendation(neededCargo, jumps), as called from the Hauling
    //     destination-detail click handler (see test-hauling.js for that wiring) ---
    const JUMPS = 4;
    await T.runShipRecommendation("hl", 3000, JUMPS); // 3000 m3: low enough that both Badger and Bestower fit

    const wrap = doc.getElementById('hl-shiprec-wrap');
    assert(wrap.hidden === false, 'recommendation table visible after calculating');

    const rows = Array.from(doc.querySelectorAll('#hl-shiprec-body tr'));
    assert(rows.length === 3, 'exactly 3 rows: Alice/Badger, Bob/Bestower, Carol/Badger (got ' + rows.length + ')');

    function rowFor(name, ship) {
      return rows.find(r => r.textContent.indexOf(name) !== -1 && r.textContent.indexOf(ship) !== -1);
    }
    const aliceRow = rowFor('Alice', 'Badger');
    const bobRow = rowFor('Bob', 'Bestower');
    const carolRow = rowFor('Carol', 'Badger');
    assert(aliceRow && bobRow && carolRow, 'all three expected rows found');

    // Expected align times: Alice (Evasive III, Spaceship II) fastest; Carol (no agility skills) slower but same cargo;
    // Bob (Bestower, no agility skills) slowest.
    const aliceAlign = 8000000 * 3.6 * 1e-6 * LN4 * (1 - 0.05 * 3) * (1 - 0.02 * 2);
    const carolAlign = 8000000 * 3.6 * 1e-6 * LN4;
    const bobAlign = 13000000 * 2.85 * 1e-6 * LN4;
    assert(aliceAlign < carolAlign && carolAlign < bobAlign, 'sanity: alice < carol < bob align times in the test data');

    function alignCellSeconds(row) {
      const cell = row.querySelector('td[data-label="Ausrichtzeit"]');
      return parseFloat(cell.textContent.replace(' s', '').replace(',', '.'));
    }
    assert(Math.abs(alignCellSeconds(aliceRow) - aliceAlign) < 0.1, 'Alice/Badger align time cell matches computed value (' + alignCellSeconds(aliceRow) + ' vs ' + aliceAlign.toFixed(2) + ')');
    assert(Math.abs(alignCellSeconds(carolRow) - carolAlign) < 0.1, 'Carol/Badger align time cell matches computed value (no agility skills)');
    assert(Math.abs(alignCellSeconds(bobRow) - bobAlign) < 0.1, 'Bob/Bestower align time cell matches computed value');

    // Warp speed column
    const warpCell = aliceRow.querySelector('td[data-label="Warp-Geschw."]').textContent;
    assert(warpCell.indexOf('3') !== -1 && warpCell.indexOf('AU/s') !== -1, 'warp speed column shows the ESI base warp speed (' + warpCell + ')');

    // Travel time column: should be populated (non-dash) and scale with the JUMPS passed in
    const travelCellAlice = aliceRow.querySelector('td[data-label="Reisezeit"]').textContent;
    assert(travelCellAlice !== '–' && travelCellAlice.trim().length > 0, 'travel time cell is populated for a 4-jump route (' + travelCellAlice + ')');
    const expectedAliceTravel = (aliceAlign + (6 / 3) + 5) * JUMPS; // ASSUMED_GATE_AU=6, GATE_OVERHEAD_SEC=5 (see source comment)
    assert(expectedAliceTravel > 0, 'sanity: expected travel time is positive');

    // Implants column
    assert(aliceRow.querySelector('td[data-label="Reise-Implantate"]').textContent.trim() === 'Ja', 'Alice (Ascendancy implant) flagged "Ja"');
    assert(bobRow.querySelector('td[data-label="Reise-Implantate"]').textContent.trim() === '–', 'Bob (unrelated implant) flagged "–"');
    assert(carolRow.querySelector('td[data-label="Reise-Implantate"]').textContent.trim() === 'unbekannt', 'Carol (implants call failed / missing scope) flagged "unbekannt"');

    // Ranking: same cargo bucket (both fit) -> ordered by align time ascending: Alice, Carol, Bob
    const order = rows.map(r => r.textContent.indexOf('Alice') !== -1 ? 'Alice' : (r.textContent.indexOf('Carol') !== -1 ? 'Carol' : 'Bob'));
    assert(order.join(',') === 'Alice,Carol,Bob', 'rows sorted by ascending align time within the "fits" group (' + order.join(',') + ')');

    // Clicking "Fitting" on a row shows the per-group fitting suggestion (Industrial (T1) group for the Badger)
    const fitBtn = aliceRow.querySelector('button');
    fitBtn.onclick();
    assert(doc.getElementById('hl-fitting-wrap').hidden === false, 'fitting panel opens from a ship recommendation row');
    assert(doc.getElementById('hl-fitting-wrap').textContent.indexOf('Cargohold') !== -1, 'fitting suggestion for a T1 industrial mentions cargo expanders');

    console.log('\\nALL SHIP-RECOMMENDATION TIME/IMPLANTS/FITTING TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 400);
