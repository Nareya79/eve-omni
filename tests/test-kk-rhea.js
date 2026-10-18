// KK: Auto-Schiffsvorschläge nur aus dem Hangar des aktiven Charakters, Jump-Frachter nie automatisch (Nutzer 07.10.: „Rhea vorgeschlagen, die der Charakter nicht hat“)
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8').replace(/\r\n/g, '\n');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const i = html.indexOf('  var SHIPS = ['), SHIPS = eval(html.slice(html.indexOf('[', i), html.indexOf('];', i) + 1));
const fn = /function shipAutoOk\(nm\)\{[^\n]*\}/.exec(html)[0], shipAutoOk = new Function('SHIPS', fn + '; return shipAutoOk;')(SHIPS);
assert(['Rhea (Caldari)', 'Anshar (Gallente)', 'Ark (Amarr)', 'Nomad (Minmatar)'].every(n => !shipAutoOk(n)), 'Alle vier Jump-Frachter fallen aus der Auto-Auswahl');
assert(shipAutoOk('Charon (Caldari)') && shipAutoOk('Badger (Caldari)'), 'Frachter und Industrials bleiben');
const body = name => { const s = html.indexOf('function ' + name + '('); return html.slice(s, html.indexOf('\n  }\n', s)); };
assert(/gkCharShips\(getActiveCharId\(\)\)/.test(body('isAutoShips')) && /shipAutoOk/.test(body('isAutoShips')), 'Eigene Schiffe: nur Hangar des aktiven Charakters, ohne Jump-Frachter');
assert(/shipAutoOk/.test(body('isBuyShips')), 'Kaufvorschlag ohne Jump-Frachter');
assert(/names\.filter\(shipAutoOk\)/.test(body('gkFleet')), 'Automatisch (gank-sicher) ohne Jump-Frachter');
const gkFitTxt = new Function(/function gkFitTxt\(c, b\)\{[^\n]*\}/.exec(html)[0] + '; return gkFitTxt;')();
assert(gkFitTxt(2, 1) === '2× Expanded Cargohold II + 1× Reinforced Bulkheads II' && gkFitTxt(0, 0) === 'Low-Slots leer', 'Fitting mit vollen Modulnamen');
const fitIcons = new Function('escapeHtml', 'shipFitName', body('fitIcons') + '\n  }; return fitIcons;')(s => s, () => 'wie im Hangar');
const ic = fitIcons({ mods: [[1319, 2], [1335, 1]] });
assert(/2×<img[^>]*types\/1319\/icon/.test(ic) && /1×<img[^>]*types\/1335\/icon/.test(ic) && /title="1× Reinforced Bulkheads II"/.test(ic), 'Overlay: Modul-Symbole mit Anzahl, Name im Tooltip');
assert(fitIcons({ mods: [[1319, 3], [0, 0]] }).split('<img').length === 2 && fitIcons({ name: 'x' }) === 'wie im Hangar', 'Nur gefittete Module als Symbol, sonst Text');
assert(/fit: best\.v\.fit, mods: best\.v\.mods/.test(html) && /fitIcons\(H\.ship\)/.test(html) && /rows: d\.items \|\| \[\], ship: d\.ship/.test(html) && /shipFitHtml\(opt\.ship\) \+ gkFleetCmp\(opt\)/.test(html), 'Fitting in Hub-Handel, Hauling und beiden Overlays');
console.log('\nALL KK-RHEA TESTS PASSED');
