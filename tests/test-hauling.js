// Verifies the new Hauling tab: Stargate-BFS radius search, reachable-station/region discovery,
// destination ranking (best-profit station wins), detail rendering wired to the ship recommendation
// (jumps passed through correctly), and the rough travel-time formula / fitting templates.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

// ---- Synthetic 3-system universe: Alpha(9001, origin) -> Beta(9002) -> Gamma(9003) ----
// All in one constellation/region to keep the buy-order region scan to a single call.
const SYSTEMS = {
  9001: { name: 'Alpha', constellation_id: 8001, stations: [5001], stargates: [71] },
  9002: { name: 'Beta',  constellation_id: 8001, stations: [5002], stargates: [72, 73] },
  9003: { name: 'Gamma', constellation_id: 8001, stations: [5003], stargates: [] },
};
const STARGATES = {
  71: { destination: { system_id: 9002 } }, // Alpha -> Beta
  72: { destination: { system_id: 9003 } }, // Beta -> Gamma
  73: { destination: { system_id: 9001 } }, // Beta -> Alpha (back-edge, must not break BFS)
};
const CONSTELLATIONS = { 8001: { region_id: 7001 } };
const STATIONS = {
  5001: { name: 'Alpha Trade Post', system_id: 9001 },
  5002: { name: 'Beta Trade Post', system_id: 9002 },
  5003: { name: 'Gamma Trade Post', system_id: 9003 },
};
const ITEM_TID = 555;
const ITEM_VOLUME = 10;
const ITEM_NAME = 'Test Ore';

const CHARS = [
  { access_token: 'tokA', refresh_token: 'rA', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Alice' },
];
const SHIP_NAME_IDS = { 'Caldari Industrial': 2001, 'Evasive Maneuvering': 2002, 'Spaceship Command': 2003, 'Badger': 3001 };
const SKILLS_BY_CHAR = { '111': [{ skill_id: 2001, trained_skill_level: 4 }] };

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
        // System-name resolution (Hauling "Eigene Eingabe" start point) vs. skill/ship-name resolution
        const sysMatch = Object.values(SYSTEMS).find(s => names.indexOf(s.name) !== -1);
        if (names.length === 1 && sysMatch) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ systems: [{ id: Number(Object.keys(SYSTEMS).find(k => SYSTEMS[k] === sysMatch)), name: sysMatch.name }] }) });
        }
        const inventory_types = names.filter(n => SHIP_NAME_IDS[n] !== undefined).map(n => ({ name: n, id: SHIP_NAME_IDS[n] }));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ inventory_types }) });
      }

      let m = u.match(/\/universe\/systems\/(\d+)\//);
      if (m) {
        const s = SYSTEMS[m[1]];
        return s ? Promise.resolve({ ok: true, json: () => Promise.resolve(s) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/stargates\/(\d+)\//);
      if (m) {
        const g = STARGATES[m[1]];
        return g ? Promise.resolve({ ok: true, json: () => Promise.resolve(g) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/constellations\/(\d+)\//);
      if (m) {
        const c = CONSTELLATIONS[m[1]];
        return c ? Promise.resolve({ ok: true, json: () => Promise.resolve(c) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/stations\/(\d+)\//);
      if (m) {
        const st = STATIONS[m[1]];
        return st ? Promise.resolve({ ok: true, json: () => Promise.resolve(st) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/types\/(\d+)\//);
      if (m) {
        const tid = Number(m[1]);
        if (tid === ITEM_TID) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: ITEM_NAME, volume: ITEM_VOLUME }) });
        }
        if (tid === 3001) { // Badger ship stats (mass + agility [attr 70] + base warp speed [attr 1281])
          return Promise.resolve({ ok: true, json: () => Promise.resolve({
            name: 'Badger', mass: 8000000,
            dogma_attributes: [{ attribute_id: 70, value: 3.6 }, { attribute_id: 1281, value: 3 }]
          }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: '#' + m[1] }) });
      }

      m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=sell/);
      if (m) {
        return Promise.resolve({
          ok: true, headers: { get: () => '1' },
          json: () => Promise.resolve([{ type_id: ITEM_TID, location_id: 5001, price: 100, volume_remain: 1000 }])
        });
      }
      m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=buy/);
      if (m) {
        return Promise.resolve({
          ok: true, headers: { get: () => '1' },
          json: () => Promise.resolve([
            { type_id: ITEM_TID, location_id: 5002, price: 150, volume_remain: 500 }, // Beta: lower margin
            { type_id: ITEM_TID, location_id: 5003, price: 200, volume_remain: 500 }, // Gamma: higher margin
          ])
        });
      }

      m = u.match(/\/characters\/(\d+)\/skills\//);
      if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: SKILLS_BY_CHAR[m[1]] || [] }) });
      m = u.match(/\/characters\/(\d+)\/implants\//);
      if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });

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

    // --- BFS unit test ---
    const depth = await T.bfsSystemsInRadius(9001, 3, () => {});
    assert(depth[9001] === 0 && depth[9002] === 1 && depth[9003] === 2, 'BFS depth correct: Alpha=0, Beta=1, Gamma=2 (' + JSON.stringify(depth) + ')');
    assert(Object.keys(depth).length === 3, 'BFS does not discover phantom systems (back-edge from Beta to Alpha handled)');

    const reach = await T.buildReachableStations(depth);
    assert(reach.stationDepth[5001] === 0 && reach.stationDepth[5002] === 1 && reach.stationDepth[5003] === 2, 'buildReachableStations maps each station to its system\'s jump depth');
    assert(reach.regionIds.length === 1 && reach.regionIds[0] === 7001, 'buildReachableStations dedupes to the single shared region (7001)');

    // --- Travel time unit test ---
    const t1 = T.computeTravelSeconds(30, 3, 2, false); // 2 jumps, normal ship
    assert(t1 !== null && t1 > 0, 'computeTravelSeconds returns a positive estimate for a normal ship');
    const t2 = T.computeTravelSeconds(30, 3, 2, true); // jump freighter
    assert(t2 === null, 'computeTravelSeconds returns null for Jump Freighters (travel via Jump Drive, not gates)');
    assert(T.computeTravelSeconds(30, 3, 0, false) === null, 'computeTravelSeconds returns null when jumps=0 (no route)');

    // --- Fitting templates sanity ---
    assert(/Cloak/i.test(T.FITTING_TEMPLATES['Blockade Runner'].high), 'Blockade Runner fitting template recommends a covert cloak in the high slot');
    assert(/Jump Drive/i.test(T.FITTING_TEMPLATES['Jump-Frachter (Jump Freighter)'].note), 'Jump Freighter fitting template notes the Jump Drive travel caveat');

    // --- Full search flow: Gamma (higher buy price) must outrank Beta ---
    doc.getElementById('hl-hub').value = ''; // "Eigene Eingabe"
    doc.getElementById('hl-hub').onchange();
    doc.getElementById('hl-start').value = 'Alpha';
    doc.getElementById('hl-radius').value = '3';
    doc.getElementById('hl-cargo').value = '5000';
    doc.getElementById('hl-budget').value = '1000000000';
    doc.getElementById('hl-tax').value = '3.375';

    await T.runHaulingSearch();

    const dests = T.getHlDestinations();
    assert(dests.length === 2, 'exactly 2 destination stations found (Beta and Gamma, Alpha itself excluded) (got ' + dests.length + ')');
    assert(dests[0].stationId === 5003, 'Gamma (higher buy price -> higher profit) ranks first (got station ' + dests[0].stationId + ')');
    assert(dests[1].stationId === 5002, 'Beta ranks second');
    assert(dests[0].jumps === 2, 'Gamma is correctly recorded as 2 jumps away');
    assert(dests[1].jumps === 1, 'Beta is correctly recorded as 1 jump away');

    const destRows = Array.from(doc.querySelectorAll('#hl-dest-body tr'));
    assert(destRows.length === 2, 'destination table renders 2 rows');
    assert(destRows[0].textContent.indexOf('Gamma') !== -1, 'best destination row shows the Gamma system name');

    // --- Click the best destination: shopping list + ship recommendation (with correct jumps) ---
    const detailBtn = destRows[0].querySelector('button:not(.tsc-cp-b)');
    await detailBtn.onclick();

    assert(doc.getElementById('hl-detail').hidden === false, 'detail section becomes visible after clicking a destination');
    const optionsText = doc.getElementById('hl-detail-options').textContent;
    assert(optionsText.indexOf(ITEM_NAME) !== -1, 'shopping list shows the traded item name');
    assert(optionsText.indexOf('Empfohlen') !== -1, 'best strategy option is marked as recommended');

    assert(doc.getElementById('hl-shiprec-wrap').hidden === false, 'ship recommendation table is shown after selecting a destination');
    const shipRows = Array.from(doc.querySelectorAll('#hl-shiprec-body tr'));
    assert(shipRows.length === 1, 'exactly one flyable ship/character row (Alice/Badger)');
    assert(shipRows[0].textContent.indexOf('Badger') !== -1, 'ship recommendation row is for the Badger');
    const travelCell = shipRows[0].querySelector('td[data-label="Reisezeit"]').textContent;
    assert(travelCell !== '–' && travelCell.trim().length > 0, 'travel time cell is populated using the destination\'s jump count (2) (' + travelCell + ')');
    assert(doc.getElementById('hl-shiprec-status').textContent.indexOf('2 Jumps') !== -1, 'ship recommendation status mentions the correct jump count for the selected destination');

    // --- Fitting button on the ship row shows the per-group fitting suggestion ---
    const fitBtn = shipRows[0].querySelector('button');
    fitBtn.onclick();
    assert(doc.getElementById('hl-fitting-wrap').hidden === false, 'fitting suggestion panel opens after clicking "Fitting"');
    assert(doc.getElementById('hl-fitting-wrap').textContent.indexOf('Cargohold') !== -1, 'fitting suggestion mentions cargo expanders for a T1 industrial');

    console.log('\\nALL HAULING TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 400);
