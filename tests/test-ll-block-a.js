// LL Block A (10.10.2026): Pin je Fenster, Höhe beim Andocken nicht übernehmen, Strg+Mausrad, Demo-Leiste ziehbar
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8'), main = fs.readFileSync('/home/claude/main.js', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
// LL4: snapMatchBounds aus main.js – seitlich keine Höhe, übereinander weiter Breite
const a = main.indexOf('function snapMatchBounds('), b = main.indexOf('function snapMatch(w)');
const other = { getBounds: () => ({ x: 100, y: 100, width: 300, height: 500 }) };
const smb = new Function('S', 'overlayWindowsExcept', 'WIN_GAP', 'MATCH_TOL', main.slice(a, b) + '; return snapMatchBounds;')({}, () => [other], 1, 20);
assert(smb(null, { x: 401, y: 150, width: 200, height: 200 }) === null, 'LL4: rechts daneben → Höhe bleibt');
const st = smb(null, { x: 110, y: 601, width: 285, height: 200 });
assert(st && st.width === 300 && st.x === 100 && st.height === 200, 'LL4/SS4: darunter, fast gleich breit (285 zu 300) → gleiche Breite');
assert(smb(null, { x: 120, y: 601, width: 200, height: 200 }) === null, 'SS4: darunter, deutlich schmaler (200 zu 300) → eigene Breite bleibt');
assert(/const SNAP = 8;/.test(main) && /const BREAK = 25;/.test(main) && /const MATCH_TOL = 20;/.test(main), 'SS4: sanfter einrasten (8 px, lösen nach 25 px, Breite ± 20 px)');
// LL2: Pin im Einzelfenster schaltet nur dieses Fenster
assert(/\$\("ov-pin"\)\.onclick = function\(\)\{ H\.getSettings\(\)\.then\(function\(s\)\{ var w = \{\}; w\[view\] = \{ top: !satTopOn\(s\) \}/.test(html), 'LL2: Pin setzt windows[view].top');
// LL3: Strg+Mausrad
assert(/w\[view\] = \{ zoom: satZoom \}/.test(html) && /type: "mapFont", arg: up \? "1" : "-1"/.test(html), 'LL3: Fenster-Zoom + Kartenschrift');
assert(/if \(!svg \|\| ev\.ctrlKey\) return;/.test(html), 'LL3: Karte zoomt bei Strg nicht mit');
// LL7: Demo-Leiste zieht, Kopfzeile darunter
assert(/\.demo-bar\{[^}]*-webkit-app-region:drag/.test(html) && /html\.demo header\.top\{top:26px\}/.test(html), 'LL7: Demo-Leiste ziehbar');
// 14.10.: 1 px Abstand zum Nachbarfenster
assert(/const WIN_GAP = 1;/.test(main) && /cx\.push\(t\.x \+ t\.width \+ WIN_GAP, t\.x - W - WIN_GAP\)/.test(main) && /cy\.push\(t\.y \+ t\.height \+ WIN_GAP, t\.y - H - WIN_GAP\)/.test(main), 'Andocken: 1 px Abstand zum Nachbarn');
assert(smb(null, { x: 120, y: 600, width: 200, height: 200 }) === null, 'ohne Abstand zählt nicht als angedockt');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
