// Verifies the new "Verkaufsscan" tab (ss-* ids): scans one character's assets at one location
// (station hangar + cargo of ships parked there, one level deep - reuses buildAssetGroups from the
// Assets tab unchanged) and, for each owned item type, finds the best-paying reachable NPC station
// in a Stargate-BFS radius (reuses bfsSystemsInRadius/buildReachableStations from the Hauling tab),
// matching owned quantity against multiple buy orders greedily (realistic, not a single-order fantasy
// price). Also verifies the ship-hangar cargo is folded into the station's asset group, the
// structure-origin resolution path (getStructureInfo), and that "Transport" reuses the now-
// parameterized runShipRecommendation("ss", ...)/renderFitting("ss", ...) with ss-* ids.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

// ---- Same synthetic 3-system universe as test-hauling.js: Alpha(9001, origin) -> Beta(9002) -> Gamma(9003) ----
const SYSTEMS = {
  9001: { name: 'Alpha', constellation_id: 8001, stations: [5001], stargates: [71] },
  9002: { name: 'Beta',  constellation_id: 8001, stations: [5002], stargates: [72, 73] },
  9003: { name: 'Gamma', constellation_id: 8001, stations: [5003], stargates: [] },
};
const STARGATES = {
  71: { destination: { system_id: 9002 } },
  72: { destination: { system_id: 9003 } },
  73: { destination: { system_id: 9001 } },
};
const CONSTELLATIONS = { 8001: { region_id: 7001 } };
const STATIONS = {
  5001: { name: 'Alpha Trade Post', system_id: 9001 },
  5002: { name: 'Beta Trade Post', system_id: 9002 },
  5003: { name: 'Gamma Trade Post', system_id: 9003 },
};
const STRUCTURE_ID = 1000000000123;
const STRUCTURES = { [STRUCTURE_ID]: { name: 'Test Citadel - Trade Hub', solar_system_id: 9002 } };

const TYPES = {
  555: { name: 'Test Ore', volume: 10 },
  777: { name: 'Cargo Widget', volume: 2 },
  888: { name: 'Rare Salvage', volume: 5 },
};
const SHIP_NAME_IDS = { 'Caldari Industrial': 2001, 'Evasive Maneuvering': 2002, 'Spaceship Command': 2003, 'Badger': 3001 };

// Dana's assets at Alpha Trade Post (5001): a Badger (item_id 9999) parked in the station hangar,
// loose Test Ore + Rare Salvage directly in the hangar, and a Cargo Widget sitting INSIDE the
// Badger's cargo hold (location_id = the Badger's own item_id, location_type "item") - this is the
// "Schiffshangar" case: it must be folded into location 5001's group by buildAssetGroups, unchanged
// from the Assets tab.
const ASSETS = [
  { item_id: 9999, location_id: 5001, location_type: 'station', location_flag: 'Hangar', type_id: 3001, quantity: 1 },
  { item_id: 9001001, location_id: 5001, location_type: 'station', location_flag: 'Hangar', type_id: 555, quantity: 100 },
  { item_id: 9001002, location_id: 5001, location_type: 'station', location_flag: 'Hangar', type_id: 888, quantity: 50 },
  { item_id: 9001003, location_id: 9999, location_type: 'item', location_flag: 'Cargo', type_id: 777, quantity: 20 },
];

// Buy orders across the region: Test Ore (555) sells best at Gamma once two orders are combined,
// Rare Salvage (888) only has a thin order at Beta (tests the partial-fill "nur X von Y" case),
// Cargo Widget (777, from the ship's cargo) only trades at Gamma. Alpha (origin) has its own,
// much worse, Test Ore buy order - used for the "sold locally" comparison.
const BUY_ORDERS = [
  { type_id: 555, location_id: 5001, price: 90, volume_remain: 1000 },
  { type_id: 555, location_id: 5002, price: 150, volume_remain: 60 },
  { type_id: 555, location_id: 5002, price: 140, volume_remain: 1000 },
  { type_id: 555, location_id: 5003, price: 200, volume_remain: 30 },
  { type_id: 555, location_id: 5003, price: 180, volume_remain: 1000 },
  { type_id: 888, location_id: 5002, price: 300, volume_remain: 10 },
  { type_id: 777, location_id: 5003, price: 50, volume_remain: 100 },
];

const CHARS = [
  { access_token: 'tokD', refresh_token: 'rD', expires_at: Date.now() + 3600000, character_id: '444', character_name: 'Dana' },
];
const SKILLS_BY_CHAR = { '444': [{ skill_id: SHIP_NAME_IDS['Caldari Industrial'], trained_skill_level: 3 }] };

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '444');
    window.fetch = function (url, opts) {
      const u = String(url);
      const auth = opts && opts.headers && opts.headers.Authorization;

      if (u.indexOf('/universe/ids/') !== -1 && opts && opts.method === 'POST') {
        const names = JSON.parse(opts.body);
        const inventory_types = names.filter(n => SHIP_NAME_IDS[n] !== undefined).map(n => ({ name: n, id: SHIP_NAME_IDS[n] }));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ inventory_types }) });
      }

      let m = u.match(/\/characters\/(\d+)\/assets\//);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 401 });
        return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(ASSETS) });
      }
      m = u.match(/\/characters\/(\d+)\/skills\//);
      if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: SKILLS_BY_CHAR[m[1]] || [] }) });
      m = u.match(/\/characters\/(\d+)\/implants\//);
      if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });

      m = u.match(/\/universe\/systems\/(\d+)\//);
      if (m) { const s = SYSTEMS[m[1]]; return s ? Promise.resolve({ ok: true, json: () => Promise.resolve(s) }) : Promise.resolve({ ok: false, status: 404 }); }
      m = u.match(/\/universe\/stargates\/(\d+)\//);
      if (m) { const g = STARGATES[m[1]]; return g ? Promise.resolve({ ok: true, json: () => Promise.resolve(g) }) : Promise.resolve({ ok: false, status: 404 }); }
      m = u.match(/\/universe\/constellations\/(\d+)\//);
      if (m) { const c = CONSTELLATIONS[m[1]]; return c ? Promise.resolve({ ok: true, json: () => Promise.resolve(c) }) : Promise.resolve({ ok: false, status: 404 }); }
      m = u.match(/\/universe\/stations\/(\d+)\//);
      if (m) { const st = STATIONS[m[1]]; return st ? Promise.resolve({ ok: true, json: () => Promise.resolve(st) }) : Promise.resolve({ ok: false, status: 404 }); }
      m = u.match(/\/universe\/structures\/(\d+)\//);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 403 });
        const st = STRUCTURES[m[1]];
        return st ? Promise.resolve({ ok: true, json: () => Promise.resolve(st) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/types\/(\d+)\//);
      if (m) {
        const tid = Number(m[1]);
        if (tid === 3001) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({
            name: 'Badger', mass: 8000000,
            dogma_attributes: [{ attribute_id: 70, value: 3.6 }, { attribute_id: 1281, value: 3 }]
          }) });
        }
        if (TYPES[tid]) return Promise.resolve({ ok: true, json: () => Promise.resolve(TYPES[tid]) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: '#' + tid }) });
      }

      m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=buy/);
      if (m) {
        return Promise.resolve({
          ok: true, headers: { get: () => '1' },
          json: () => Promise.resolve(BUY_ORDERS)
        });
      }
      m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=sell/);
      if (m) {
        // Sell-Scan verkauft nur bereits besessene Assets - es darf NIE nach Sell-Orders gefragt werden.
        return Promise.reject(new Error('Sell-Scan sollte keine Sell-Order-Abfrage auslösen: ' + u));
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
function near(a, b, eps) { return Math.abs(a - b) < (eps === undefined ? 0.01 : eps); }

setTimeout(async () => {
  try {
    const doc = window.document;
    const T = window.__test;

    // --- buildAssetGroups: Schiffshangar-Fracht wird in die Stationsgruppe gefaltet ---
    const groups = T.buildAssetGroups(ASSETS.map(a => Object.assign({ _charId: '444', _charName: 'Dana' }, a)));
    assert(groups[5001] !== undefined, 'buildAssetGroups gruppiert nach der Stations-location_id (5001)');
    const keys5001 = Object.keys(groups[5001]);
    assert(keys5001.some(k => k.startsWith('3001|')), 'die im Hangar geparkte Badger selbst zählt als Asset am Ort');
    assert(keys5001.some(k => k.startsWith('555|')), 'lose Test Ore im Stationshangar wird erfasst');
    assert(keys5001.some(k => k.startsWith('888|')), 'lose Rare Salvage im Stationshangar wird erfasst');
    assert(keys5001.some(k => k.startsWith('777|')), 'Cargo Widget IN der Badger-Fracht wird trotzdem der Station 5001 zugeordnet (Schiffshangar)');
    assert(groups[5001]['777|444'].qty === 20, 'Menge des Schiffsfracht-Items stimmt (20)');

    // --- getStructureInfo: Structure-Ursprungsort auflösen (für den "Eigene Struktur"-Fall) ---
    const sInfo = await T.getStructureInfo(STRUCTURE_ID, '444');
    assert(sInfo && sInfo.name === 'Test Citadel - Trade Hub', 'getStructureInfo liest den Namen der Structure');
    assert(sInfo && sInfo.system_id === 9002, 'getStructureInfo liest solar_system_id als System der Structure');

    // --- Voller Verkaufsscan-Flow über die UI ---
    doc.getElementById('ss-char').value = '444';
    await doc.getElementById('ss-load-assets').onclick();

    const locSel = doc.getElementById('ss-loc');
    assert(!locSel.disabled, 'Ort-Auswahl wird nach dem Laden der Assets aktiviert');
    const locOptTexts = Array.from(locSel.options).map(o => o.textContent);
    assert(locOptTexts.some(t => t.indexOf('Alpha Trade Post') !== -1 && t.indexOf('4 Artikel') !== -1),
      'Ort-Dropdown zeigt den aufgelösten Stationsnamen mit Artikelanzahl (' + locOptTexts.join(' | ') + ')');
    locSel.value = '5001';
    assert(!doc.getElementById('ss-scan-btn').disabled, '"Verkaufsanalyse starten" wird nach dem Laden aktiviert');

    doc.getElementById('ss-radius').value = '3';
    doc.getElementById('ss-tax').value = '3.375';
    await T.runSellScan();

    const rows = T.getSsResultRows();
    assert(rows.length === 3, 'genau 3 Artikel-Typen haben irgendwo im Umkreis ein Kaufgebot (555, 777, 888) (got ' + rows.length + ')');

    function rowFor(tid) { return rows.find(r => r.tid === tid); }
    const r555 = rowFor(555), r777 = rowFor(777), r888 = rowFor(888);
    assert(r555 && r777 && r888, 'alle drei erwarteten Zeilen vorhanden');

    assert(r555.stationId === 5003, 'Test Ore verkauft sich am besten in Gamma (zwei Kauforders kombiniert) (got ' + r555.stationId + ')');
    assert(near(r555.net, 18600 * (1 - 3.375 / 100)), 'Test-Ore-Erlös in Gamma korrekt berechnet (30@200 + 70@180, abzgl. Steuer) (' + r555.net + ')');
    assert(r555.filled === 100, 'Test Ore komplett verkäuflich in Gamma (100/100)');
    assert(r555.jumps === 2, 'Gamma ist 2 Jumps entfernt');

    assert(r888.stationId === 5002, 'Rare Salvage verkauft sich nur in Beta (einzige Order) (got ' + r888.stationId + ')');
    assert(r888.filled === 10 && r888.qty === 50, 'Rare Salvage nur teilweise abnehmbar (10 von 50, dünne Order)');
    assert(near(r888.net, 3000 * (1 - 3.375 / 100)), 'Rare-Salvage-Erlös korrekt (10@300, abzgl. Steuer) (' + r888.net + ')');

    assert(r777.stationId === 5003, 'Cargo Widget (aus der Schiffsfracht) verkauft sich nur in Gamma (got ' + r777.stationId + ')');
    assert(r777.filled === 20 && r777.qty === 20, 'Cargo Widget komplett verkäuflich (20/20) - bestätigt, dass die Schiffsfracht wirklich mitgescannt wurde');
    assert(near(r777.net, 1000 * (1 - 3.375 / 100)), 'Cargo-Widget-Erlös korrekt (20@50, abzgl. Steuer) (' + r777.net + ')');

    // Sortierung: höchster Erlös zuerst -> 555, 888, 777
    assert(rows.map(r => r.tid).join(',') === '555,888,777', 'Zeilen nach geschätztem Erlös absteigend sortiert (' + rows.map(r => r.tid).join(',') + ')');

    // --- Rendering ---
    const tableRows = Array.from(doc.querySelectorAll('#ss-body tr'));
    assert(tableRows.length === 3, 'Ergebnistabelle zeigt 3 Zeilen');
    assert(tableRows[0].textContent.indexOf('Test Ore') !== -1, 'erste Zeile ist Test Ore (bester Erlös)');
    assert(tableRows[1].textContent.indexOf('Rare Salvage') !== -1 && tableRows[1].textContent.indexOf('nur') !== -1 && tableRows[1].textContent.indexOf('10') !== -1,
      'Rare-Salvage-Zeile weist auf die Teilabnahme hin ("nur 10 von 50")');

    // --- Zusammenfassung: optimiert vs. nur lokal verkauft ---
    const summaryText = doc.getElementById('ss-summary').textContent;
    const expectedOptimized = 18600 * (1 - 3.375 / 100) + 3000 * (1 - 3.375 / 100) + 1000 * (1 - 3.375 / 100);
    const expectedLocal = 9000 * (1 - 3.375 / 100); // nur Test Ore hat lokal (Alpha) überhaupt ein Kaufgebot
    assert(summaryText.indexOf('Alpha Trade Post') !== -1, 'Zusammenfassung nennt den Ausgangsort');
    assert(!doc.getElementById('ss-summary').hidden, 'Zusammenfassungs-Box wird eingeblendet');
    assert(summaryText.indexOf('nicht ermittelbar') === -1, 'Vergleichswert "nur lokal" wird angezeigt, da Test Ore lokal ein Kaufgebot hat');

    // --- Transport-Button: reused, parameterized runShipRecommendation("ss", ...) ---
    const transportBtn = tableRows[0].querySelector('button');
    await transportBtn.onclick();
    assert(!doc.getElementById('ss-detail').hidden, 'Transport-Detailbereich öffnet sich');
    assert(doc.getElementById('ss-shiprec-title').textContent.indexOf('Gamma Trade Post') !== -1, 'Transport-Titel nennt die Zielstation');
    assert(!doc.getElementById('ss-shiprec-wrap').hidden, 'Schiffsempfehlung wird für den Transport-Vorschlag angezeigt');
    const shipRows = Array.from(doc.querySelectorAll('#ss-shiprec-body tr'));
    assert(shipRows.length === 1 && shipRows[0].textContent.indexOf('Badger') !== -1, 'Dana (Caldari Industrial III) bekommt den Badger empfohlen');
    assert(doc.getElementById('ss-shiprec-status').textContent.indexOf('2 Jump') !== -1, 'Schiffsempfehlungs-Status nennt die richtige Jump-Zahl (2, wie Test Ore -> Gamma)');

    const fitBtn = shipRows[0].querySelector('button');
    fitBtn.onclick();
    assert(!doc.getElementById('ss-fitting-wrap').hidden, 'Fitting-Vorschlag öffnet sich unter ss-fitting-wrap (parameterisiertes renderFitting)');
    assert(doc.getElementById('ss-fitting-wrap').textContent.indexOf('Cargohold') !== -1, 'Fitting-Vorschlag für Industrial (T1) nennt Cargo-Expander');

    // Die Hauling-eigenen hl-* Elemente dürfen vom Sell-Scan-Flow NICHT angefasst worden sein.
    assert(doc.getElementById('hl-shiprec-wrap').hidden, 'Hauling-Schiffsempfehlung bleibt unberührt vom Sell-Scan (hl-shiprec-wrap weiter hidden)');

    console.log('\\nALL SELL-SCAN TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 400);
