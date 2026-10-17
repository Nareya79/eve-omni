// Verifies the new "Meine Schiffe auswählen" feature in the Hauling tab, added after user feedback
// that the ship recommendation only ever showed Caldari ships (because it silently only lists ships
// whose racial skill the character has actually trained) and that there was no way to pre-select
// which ships to even consider:
// - a persistent per-browser checklist (localStorage key eve-zentrale-owned-ships-v1) of all ships
//   from SHIPS (4 races x 5 categories); null stored = no restriction yet, all ships considered
//   (preserves old behaviour for anyone who never opens the new panel)
// - on the very first page load ever (key still null) with characters already logged in, the app
//   auto-scans all characters' assets for known ship types and pre-checks only what it actually found
//   (falling back to "leave everything checked" if nothing matched, so a fresh account isn't left
//   with an empty, all-excluding selection)
// - "Aus meinem Hangar erkennen" can be re-run any time and only ADDS matches (union), never unchecks
//   a box the user set manually
// - "Alle auswählen" / "Keine auswählen" bulk controls
// - runShipRecommendation only considers ships that are both (a) checked in this list and (b) actually
//   flyable per trained skill level - owning-but-not-trained a ship must not produce a row, and a
//   skill-eligible-but-unselected ship must not produce a row either
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const NAME_IDS = {
  'Caldari Industrial': 2001,
  'Minmatar Industrial': 2002,
  'Amarr Industrial': 2003,
  'Evasive Maneuvering': 2010,
  'Spaceship Command': 2011,
  'Badger': 3001,
  'Mammoth': 3002,
  'Bestower': 3003,
  'Charon': 3004,
};
const SHIP_TYPE_STATS = {
  3001: { mass: 8000000, attrs: { 70: 3.6, 1281: 3 } },     // Badger
  3002: { mass: 9000000, attrs: { 70: 3.2, 1281: 3 } },     // Mammoth
  3003: { mass: 9500000, attrs: { 70: 3.0, 1281: 3 } },     // Bestower
  3004: { mass: 1200000000, attrs: { 70: 0.18, 1281: 1.5 } } // Charon
};

// Alice besitzt laut Assets nur eine Badger und eine Mammoth (im Stationshangar) - sonst nichts.
const ASSETS_BY_CHAR = {
  '111': [
    { item_id: 9001, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 3001, quantity: 1 }, // Badger
    { item_id: 9002, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 3002, quantity: 1 }, // Mammoth
    { item_id: 9003, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 34, quantity: 500 }, // Tritanium, kein Schiff
  ],
};
// Alice hat sowohl Caldari Industrial (Badger) als auch Minmatar Industrial (Mammoth) UND Amarr
// Industrial (Bestower) trainiert - Bestower besitzt sie laut Assets aber gar nicht.
const SKILLS_BY_CHAR = {
  '111': [
    { skill_id: NAME_IDS['Caldari Industrial'], trained_skill_level: 3 },
    { skill_id: NAME_IDS['Minmatar Industrial'], trained_skill_level: 3 },
    { skill_id: NAME_IDS['Amarr Industrial'], trained_skill_level: 3 },
  ],
};

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
      const list = ASSETS_BY_CHAR[m[1]] || [];
      return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(list) });
    }
    m = u.match(/\/characters\/(\d+)\/skills\//);
    if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: SKILLS_BY_CHAR[m[1]] || [] }) });
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
      if (tid === 34) return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Tritanium' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: '#' + tid }) });
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
    assert(T && T.SHIPS, '__test hook exposes SHIPS');

    // --- Checklist DOM: alle 20 Schiffe (4 Rassen x 5 Kategorien) als Checkboxen vorhanden ---
    const totalShipCount = T.SHIPS.reduce((n, g) => n + g.items.length, 0);
    const boxesNow = Array.from(doc.querySelectorAll('#hl-ships-list input[type=checkbox]'));
    assert(boxesNow.length === totalShipCount, 'Checkliste zeigt alle ' + totalShipCount + ' Schiffe (got ' + boxesNow.length + ')');

    // --- Der stille Auto-Scan beim allerersten Laden (Charakter mit Badger+Mammoth im Hangar,
    // localStorage-Key noch nie gesetzt) muss inzwischen durchgelaufen sein und NUR diese zwei
    // Schiffe angehakt haben, alle anderen 18 müssen abgehakt sein. ---
    await new Promise(r => setTimeout(r, 250)); // dem fire-and-forget Auto-Scan Zeit zum Fertigwerden geben
    let owned = T.loadOwnedShipNames();
    assert(Array.isArray(owned), 'nach dem ersten automatischen Scan ist eine konkrete Auswahl gespeichert (nicht mehr null)');
    assert(owned.length === 2 && owned.indexOf('Badger (Caldari)') !== -1 && owned.indexOf('Mammoth (Minmatar)') !== -1,
      'automatischer Scan hat genau Badger und Mammoth erkannt und angehakt (' + JSON.stringify(owned) + ')');
    const badgerBox = boxesNow.find(b => b.value === 'Badger (Caldari)');
    const mammothBox = boxesNow.find(b => b.value === 'Mammoth (Minmatar)');
    const bestowerBox = boxesNow.find(b => b.value === 'Bestower (Amarr)');
    assert(badgerBox.checked && mammothBox.checked, 'Badger- und Mammoth-Checkbox sind angehakt');
    assert(!bestowerBox.checked, 'Bestower-Checkbox ist NICHT angehakt (nicht im Hangar gefunden)');

    // --- Filterwirkung: Bestower ist skill-berechtigt (Amarr Industrial III), aber NICHT ausgewählt
    // -> darf trotzdem nicht in der Empfehlung auftauchen. Mammoth ist ausgewählt UND skill-berechtigt
    // -> muss auftauchen. ---
    await T.runShipRecommendation('hl', 3000, 2);
    let rows = Array.from(doc.querySelectorAll('#hl-shiprec-body tr'));
    assert(rows.some(r => r.textContent.indexOf('Badger') !== -1), 'Badger (ausgewählt + skill-berechtigt) erscheint in der Empfehlung');
    assert(rows.some(r => r.textContent.indexOf('Mammoth') !== -1), 'Mammoth (ausgewählt + skill-berechtigt) erscheint in der Empfehlung');
    assert(!rows.some(r => r.textContent.indexOf('Bestower') !== -1), 'Bestower (skill-berechtigt, aber NICHT ausgewählt) erscheint NICHT in der Empfehlung');

    // --- Manuelles Zusätzlich-Ankreuzen (Charon) bleibt nach einem erneuten Auto-Scan erhalten (Union,
    // kein Abhaken durch den erneuten Scan) ---
    const charonBox = boxesNow.find(b => b.value === 'Charon (Caldari)');
    charonBox.checked = true;
    charonBox.onchange();
    owned = T.loadOwnedShipNames();
    assert(owned.indexOf('Charon (Caldari)') !== -1, 'manuell zusätzlich angehaktes Charon ist gespeichert');

    await T.autoDetectOwnedShips({});
    owned = T.loadOwnedShipNames();
    assert(owned.indexOf('Charon (Caldari)') !== -1 && owned.indexOf('Badger (Caldari)') !== -1 && owned.indexOf('Mammoth (Minmatar)') !== -1,
      'erneutes "Aus meinem Hangar erkennen" hakt das manuell gesetzte Charon nicht wieder ab (Union) (' + JSON.stringify(owned) + ')');

    // --- "Alle auswählen" ---
    doc.getElementById('hl-ships-all').onclick();
    owned = T.loadOwnedShipNames();
    assert(owned.length === totalShipCount, '"Alle auswählen" hakt wieder alle ' + totalShipCount + ' Schiffe an (got ' + owned.length + ')');

    // --- "Keine auswählen" -> runShipRecommendation zeigt klare Meldung statt leerer Tabelle ---
    doc.getElementById('hl-ships-none').onclick();
    owned = T.loadOwnedShipNames();
    assert(owned.length === 0, '"Keine auswählen" hakt alle Schiffe ab');
    await T.runShipRecommendation('hl', 3000, 2);
    const status = doc.getElementById('hl-shiprec-status').textContent;
    assert(status.indexOf('Keine Schiffe ausgewählt') !== -1, 'ohne ausgewählte Schiffe erscheint eine klare Statusmeldung statt einer leeren Tabelle (' + status + ')');
    assert(doc.getElementById('hl-shiprec-wrap').hidden === true, 'Empfehlungstabelle bleibt versteckt, wenn keine Schiffe ausgewählt sind');

    console.log('\\nALL OWNED-SHIPS TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 500);
