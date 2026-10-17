// Verifies two new Hauling-Tab features added after user feedback:
// 1. "Maximalschiff"-Dropdown: befüllt "Verfügbarer Laderaum (m³)" automatisch mit dem besten real
//    erreichbaren effektiven Laderaum (Skill-Bonus + echte gefittete Cargo-Module, über alle eingeloggten
//    Charaktere hinweg das Maximum) - dieselbe Datenquelle/Logik wie die Schiffsempfehlung, nur als
//    eigenständiger Vorab-Schritt VOR dem Klick auf "Hauling-Suche starten" (siehe test-cargo-modules.js
//    für die Schiffsempfehlungs-Seite derselben zugrundeliegenden Cargo-Modul-Logik).
// 2. Laderaum- und Budget-Feld zeigen beim Tippen live deutsche Tausenderpunkte (z.B. "5.000.000"), ohne
//    Kommastellen - reine Lese-/Tipp-Hilfe, ausgelesen wird über parseGroupedInt() wieder die reine Ganzzahl.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const NAME_IDS = {
  'Caldari Freighter': 2001,
  'Charon': 3001,
  'Iteron Mark V': 3002,
  'Expanded Cargohold II': 4001, // Dogma 149 = 1.275 (+27.5%)
};
const SHIP_TYPE_STATS = {
  3002: { mass: 13000000, attrs: { 12: 5 } },   // BB2: Schiff mit 5 Low-Slots
  3001: { mass: 1200000000, attrs: { 70: 0.18, 1281: 1.5, 12: 3 } }, // Charon (Werte hier irrelevant für diesen Test)
};
const MODULE_CARGO_MULT = { 4001: 1.275 };

// Eve: eine gefittete Charon (zwei Expanded Cargohold II in den Low-Slots).
const ASSETS_EVE = [
  { item_id: 9001, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', type_id: 3001, quantity: 1 }, // Charon-Hülle
  { item_id: 9101, location_id: 9001, location_type: 'other', location_flag: 'LoSlot0', type_id: 4001, quantity: 1 },
  { item_id: 9102, location_id: 9001, location_type: 'other', location_flag: 'LoSlot1', type_id: 4001, quantity: 1 },
];
const SKILLS_EVE = [
  { skill_id: NAME_IDS['Caldari Freighter'], trained_skill_level: 5 },
];

const CHARS = [
  { access_token: 'tokE', refresh_token: 'rE', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Eve' },
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
    if (m) return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(ASSETS_EVE) });
    m = u.match(/\/characters\/(\d+)\/skills\//);
    if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: SKILLS_EVE }) });
    m = u.match(/\/universe\/types\/(\d+)\//);
    if (m) {
      const tid = Number(m[1]);
      if (SHIP_TYPE_STATS[tid]) {
        const s = SHIP_TYPE_STATS[tid];
        const dogma_attributes = Object.keys(s.attrs).map(k => ({ attribute_id: Number(k), value: s.attrs[k] }));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ mass: s.mass, dogma_attributes, name: 'Charon' }) });
      }
      if (MODULE_CARGO_MULT[tid] !== undefined) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Expanded Cargohold II', dogma_attributes: [{ attribute_id: 149, value: MODULE_CARGO_MULT[tid] }] }) });
      }
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
    window.localStorage.setItem('eve-zentrale-owned-ships-v1', JSON.stringify(['Charon (Caldari)']));
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
    assert(T && T.formatIntGroups && T.parseGroupedInt && T.computeBestOwnCargo, '__test hook exposes formatIntGroups/parseGroupedInt/computeBestOwnCargo');

    // --- Unit: formatIntGroups fügt deutsche Tausenderpunkte ein, ohne Kommastellen ---
    assert(T.formatIntGroups('5000000') === '5.000.000', 'formatIntGroups("5000000") === "5.000.000"');
    assert(T.formatIntGroups('999') === '999', 'formatIntGroups lässt Zahlen unter 1000 unverändert');
    assert(T.formatIntGroups('1234567890') === '1.234.567.890', 'formatIntGroups funktioniert auch bei sehr großen Zahlen');

    // --- Felder wurden beim Laden bereits initial formatiert (Startwerte aus dem HTML) ---
    const cargoInput = doc.getElementById('hl-cargo');
    const budgetInput = doc.getElementById('hl-budget');
    assert(cargoInput.type === 'text' && budgetInput.type === 'text', 'Laderaum- und Budget-Feld sind text-Inputs (kein type=number, das erlaubt keine Tausenderpunkte)');
    assert(budgetInput.value === '100.000.000', 'Budget-Feld zeigt beim Laden bereits Tausenderpunkte (' + budgetInput.value + ')');

    // --- Tippen ins Budget-Feld formatiert live nach, parseGroupedInt liefert die reine Zahl zurück ---
    budgetInput.value = '5000000';
    budgetInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert(budgetInput.value === '5.000.000', 'Budget-Feld formatiert beim Tippen live nach (' + budgetInput.value + ')');
    assert(T.parseGroupedInt('hl-budget') === 5000000, 'parseGroupedInt liest aus dem formatierten Feld wieder die korrekte Ganzzahl 5000000 (got ' + T.parseGroupedInt('hl-budget') + ')');

    // Tippt der Nutzer selbst schon Punkte/andere Zeichen, werden die einfach ignoriert/neu gesetzt (robust)
    budgetInput.value = '12.3ab4.000';
    budgetInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert(T.parseGroupedInt('hl-budget') === 1234000, 'nicht-numerische Zeichen werden beim Tippen ignoriert, nur die Ziffern zählen (' + T.parseGroupedInt('hl-budget') + ')');

    // --- computeBestOwnCargo: Unit-Ebene direkt ---
    const best = await T.computeBestOwnCargo('Charon (Caldari)');
    assert(best && !best.error, 'computeBestOwnCargo("Charon (Caldari)") liefert ein Ergebnis (Eve kann es fliegen)');
    const expectedSkillCap = 465000 * (1 + 5*0.05); // Caldari Freighter V
    const expectedModMult = 1.275 * 1.275; // O3: zwei ECH II, keine Stacking-Penalty (ESI stackable)
    const expectedCap = expectedSkillCap * expectedModMult;
    assert(Math.abs(best.value - expectedCap) < 1, 'computeBestOwnCargo liefert Skill-Basis * echten Modul-Bonus ohne Stacking-Penalty (' + best.value + ' vs ' + expectedCap.toFixed(1) + ')');
    assert(best.charName === 'Eve' && best.level === 5, 'computeBestOwnCargo nennt den richtigen Charakter und Skill-Level');
    assert(best.moduleBonusPct !== null && best.moduleBonusPct > 0, 'computeBestOwnCargo meldet einen positiven echten Modul-Bonus');

    // --- End-to-End über das Dropdown: Auswahl von "Charon (Caldari)" befüllt hl-cargo automatisch ---
    const hlMaxShip = doc.getElementById('hl-max-ship');
    assert(hlMaxShip, 'hl-max-ship Dropdown existiert im Hauling-Tab');
    const charonOption = Array.from(hlMaxShip.options).find(o => o.value === 'Charon (Caldari)');
    assert(charonOption, 'Charon (Caldari) ist eine Option im Maximalschiff-Dropdown');
    hlMaxShip.value = 'Charon (Caldari)';
    await hlMaxShip.onchange();
    // 5.0 (GitHub #3): das Feld bleibt der eingetippte Wert („Nur Laderaum“); gerechnet wird mit dem Schiffs-Laderaum (sbCargoEff)
    const eff = doc.defaultView.__sbCargoEff('hl');
    assert(eff === Math.floor(expectedCap), 'Suche rechnet mit dem echten effektiven Laderaum des Schiffs (' + eff + ', erwartet ' + Math.floor(expectedCap) + ')');
    const grouped = String(Math.floor(expectedCap)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    assert(doc.getElementById('hl-calc').textContent.indexOf(grouped) !== -1, '„Gerechnet wird mit“ nennt den Schiffs-Laderaum mit Tausenderpunkten (' + doc.getElementById('hl-calc').textContent + ')');
    const statusText = doc.getElementById('hl-cargo-info').textContent;
    assert(statusText.indexOf('Eve') !== -1 && statusText.indexOf('Skill 5') !== -1, 'KK8: Laderaum-Zeile nennt Charakter und Skill-Level (' + statusText + ')');
    assert(!doc.getElementById('hl-cargo-info').closest('.field').hidden && doc.getElementById('hl-cargo').closest('.field').hidden, 'KK8: Laderaum als Wert sichtbar, Eingabefeld versteckt');

    // --- O3: Fitting je Schiff waehlbar und gemerkt ---
    const fit = doc.getElementById('hl-fit');
    assert(!fit.disabled && fit.value === 'auto', 'O3: Fitting-Auswahl aktiv, Standard „wie im Hangar“');
    await new Promise(r => setTimeout(r, 300));
    assert(fit.querySelector('option[value="3"]').hidden === false && fit.querySelector('option[value="4"]').hidden && fit.querySelector('option[value="5"]').hidden, 'Q3: Charon hat 3 Low-Slots – 4×/5× Expanded Cargohold II ausgeblendet');
    fit.value = '3'; fit.onchange(); await new Promise(r => setTimeout(r, 300));
    assert(doc.defaultView.__sbCargoEff('hl') === Math.floor(465000 * 1.25 * Math.pow(1.275, 3)), 'O3: 3× ECH II mit Caldari Freighter V = ' + doc.defaultView.__sbCargoEff('hl'));
    assert(JSON.parse(window.localStorage.getItem('eve-zentrale-shipfit-v1'))['Charon (Caldari)'].mode === '3', 'O3: Fitting für die Charon gemerkt');
    fit.value = 'manual'; fit.onchange(); await new Promise(r => setTimeout(r, 300));
    cargoInput.value = '1.100.000'; cargoInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    hlMaxShip.value = ''; await hlMaxShip.onchange();
    assert(fit.disabled, 'O3: ohne Schiff keine Fitting-Auswahl');
    hlMaxShip.value = 'Charon (Caldari)'; await hlMaxShip.onchange();
    assert(fit.value === 'manual' && T.parseGroupedInt('hl-cargo') === 1100000, 'O3: eigener Wert je Schiff gemerkt und wieder eingesetzt');
    // --- BB2: alte gemerkte 5× wird 3×, Hinweis, Overlay bietet 4×/5× nicht an ---
    const sf = JSON.parse(window.localStorage.getItem('eve-zentrale-shipfit-v1')); sf['Charon (Caldari)'] = { mode: '5' };
    window.localStorage.setItem('eve-zentrale-shipfit-v1', JSON.stringify(sf));
    hlMaxShip.value = ''; await hlMaxShip.onchange(); hlMaxShip.value = 'Charon (Caldari)'; await hlMaxShip.onchange();
    await new Promise(r => setTimeout(r, 300));
    assert(fit.value === '3' && JSON.parse(window.localStorage.getItem('eve-zentrale-shipfit-v1'))['Charon (Caldari)'].mode === '3', 'BB2: gemerkte 5× bei der Charon wird auf 3× gesetzt');
    const note = doc.querySelector('label[for="hl-fit"] .fit-note');
    assert(note && note.textContent === ' · auf 3× gesetzt' && note.title === 'Charon (Caldari) hat nur 3 Low-Slots', 'BB2: kurzer Hinweis am Feld „Fitting“');
    assert(/Maximum, 3 Low-Slots/.test(fit.querySelector('option[value="3"]').textContent), 'BB2: 3× als Maximum beschriftet');
    const ovf = T.ovMirrorFields('haul-run');
    assert(/data-ovf="hl-fit"/.test(ovf) && /value="3"[^>]*>3× Expanded Cargohold II \(Maximum, 3 Low-Slots\)/.test(ovf) && !/value="4"/.test(ovf.slice(ovf.indexOf('data-ovf="hl-fit"'))) && /Fitting · auf 3× gesetzt/.test(ovf), 'BB2: Overlay-Auswahl ohne 4×/5×, Maximum beschriftet');
    hlMaxShip.value = 'Iteron Mark V (Gallente)'; await hlMaxShip.onchange(); await new Promise(r => setTimeout(r, 300));
    assert(!fit.querySelector('option[value="5"]').hidden && /Maximum, 5 Low-Slots/.test(fit.querySelector('option[value="5"]').textContent) && !doc.querySelector('.fit-note'), 'BB2: Schiff mit 5 Low-Slots bietet bis 5× an, Hinweis weg');
    hlMaxShip.value = 'Charon (Caldari)'; await hlMaxShip.onchange();
    fit.value = 'auto'; fit.onchange(); await new Promise(r => setTimeout(r, 300));

    // --- Kein eingeloggter Charakter kann ein anderes Schiff fliegen -> Laderaum bleibt unverändert, klare Meldung ---
    const cargoBefore = cargoInput.value;
    hlMaxShip.value = 'Fenrir (Minmatar)'; // Eve hat keinen Minmatar-Freighter-Skill
    await hlMaxShip.onchange();
    assert(cargoInput.value === cargoBefore, 'Laderaum-Feld bleibt unverändert, wenn niemand das gewählte Schiff fliegen kann');
    assert(doc.getElementById('hl-cargo-info').textContent.indexOf('Kein eingeloggter Charakter') !== -1, 'klare Meldung beim Laderaum statt eines erfundenen Werts');

    console.log('\\nALL MAX-SHIP / GROUPED-NUMBER-INPUT TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 500);
