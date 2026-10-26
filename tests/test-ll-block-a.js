// LL Block A (10.10.2026): Pin je Fenster, Höhe beim Andocken nicht übernehmen, Strg+Mausrad, Demo-Leiste ziehbar
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8'), main = fs.readFileSync('/home/claude/main.js', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
// LL4: snapMatchBounds aus main.js – seitlich keine Höhe, übereinander weiter Breite
const a = main.indexOf('function snapMatchBounds('), b = main.indexOf('function snapMatch(w)');
const other = { getBounds: () => ({ x: 100, y: 100, width: 300, height: 500 }) };
const smb = new Function('S', 'overlayWindowsExcept', 'WIN_GAP', 'MATCH_TOL', main.slice(a, b) + '; return snapMatchBounds;')({}, () => [other], 1, 10);
assert(smb(null, { x: 401, y: 150, width: 200, height: 200 }) === null, 'LL4: rechts daneben, Höhe deutlich anders (200 zu 500) → Höhe bleibt');
const sd = smb(null, { x: 401, y: 130, width: 200, height: 492 });
assert(sd && sd.height === 500 && sd.y === 130 && sd.x === 401 && sd.width === 200, 'AR3: rechts daneben, fast gleich hoch (492 zu 500) → gleiche Höhe, obere Kante bleibt');
assert(smb(null, { x: 401, y: 130, width: 200, height: 485 }) === null, 'AR3: 15 px Unterschied → eigene Höhe (Toleranz 10 px)');
// AR3 Nachtrag (Nutzer): Größe ändern – unteren Rand fast auf die Unterkante des Nachbarn ziehen → gleiche Unterkante
const ra = main.indexOf('function resizeMatchBounds('), rb = main.indexOf('function resizeMatch(w)');
const rmb = new Function('S', 'overlayWindowsExcept', 'WIN_GAP', 'MATCH_TOL', main.slice(ra, rb) + '; return resizeMatchBounds;')({}, () => [other], 1, 10);
let rr = rmb(null, { x: 401, y: 100, width: 200, height: 493 });
assert(rr && rr.height === 500 && rr.y === 100 && rr.width === 200, 'AR3: rechts daneben, Rand 7 px über der Unterkante losgelassen → gleiche Höhe');
rr = rmb(null, { x: 401, y: 100, width: 200, height: 506 });
assert(rr && rr.height === 500, 'AR3: auch 6 px darunter → zurück auf die Unterkante');
assert(rmb(null, { x: 401, y: 100, width: 200, height: 470 }) === null, 'AR3: 30 px daneben → bleibt');
rr = rmb(null, { x: 100, y: 601, width: 294, height: 200 });
assert(rr && rr.width === 300 && rr.height === 200, 'AR3: darunter, rechter Rand fast bündig → gleiche rechte Kante');
rr = rmb(null, { x: 106, y: 601, width: 294, height: 200 });
assert(rr && rr.x === 100 && rr.width === 300, 'AR3: darunter, linker Rand fast bündig → gleiche linke Kante, gleiche Breite');
rr = rmb(null, { x: 95, y: 601, width: 310, height: 200 });
assert(rr && rr.x === 100 && rr.width === 300, 'AR3: darunter, beide Ränder etwas zu weit → genau so breit wie der Nachbar');
assert(rmb(null, { x: 100, y: 601, width: 250, height: 200 }) === null, 'AR3: darunter, deutlich schmaler → bleibt');
assert(/w\.on\('resized', \(\) => resizeMatch\(w\)\);/.test(main) && /if \(sid\)\{ resizeMatch\(sats\[sid\]\);/.test(main), 'AR3: nach dem Größe-Ändern (Rahmen und Griff ⤡)');
const st = smb(null, { x: 110, y: 601, width: 292, height: 200 });
assert(st && st.width === 300 && st.x === 100 && st.height === 200, 'LL4/SS4: darunter, fast gleich breit (292 zu 300) → gleiche Breite');
assert(smb(null, { x: 120, y: 601, width: 200, height: 200 }) === null, 'SS4: darunter, deutlich schmaler (200 zu 300) → eigene Breite bleibt');
assert(/const SNAP = 8;/.test(main) && /const BREAK = 25;/.test(main) && /const MATCH_TOL = 10;/.test(main), 'SS4/AR3: sanfter einrasten (8 px, lösen nach 25 px, Breite/Höhe ± 10 px)');
// LL2: Pin im Einzelfenster schaltet nur dieses Fenster
assert(/\$\("ov-pin"\)\.onclick = function\(\)\{ H\.getSettings\(\)\.then\(function\(s\)\{ var w = \{\}; w\[view\] = \{ top: !satTopOn\(s\) \}/.test(html), 'LL2: Pin setzt windows[view].top');
// LL3: Strg+Mausrad
assert(/w\[view\] = \{ zoom: satZoom \}/.test(html) && /ev\.target\.closest\("\.km canvas"\)\) return;/.test(html), 'LL3: Fenster-Zoom; auf der OmniMap regelt die Karte Strg+Mausrad selbst (Größe, 25.10.)');
assert(/if \(ev\.ctrlKey \|\| ev\.target !== cv\) return;/.test(html), 'LL3: Karte zoomt bei Strg nicht mit');
// LL7: Demo-Leiste zieht, Kopfzeile darunter
assert(/\.demo-bar\{[^}]*-webkit-app-region:drag/.test(html) && /html\.demo header\.top\{top:26px\}/.test(html), 'LL7: Demo-Leiste ziehbar');
// 14.10.: 1 px Abstand zum Nachbarfenster
assert(/const WIN_GAP = 1;/.test(main) && /cx\.push\(t\.x \+ t\.width \+ WIN_GAP, t\.x - W - WIN_GAP\)/.test(main) && /cy\.push\(t\.y \+ t\.height \+ WIN_GAP, t\.y - H - WIN_GAP\)/.test(main), 'Andocken: 1 px Abstand zum Nachbarn');
assert(smb(null, { x: 120, y: 600, width: 200, height: 200 }) === null, 'ohne Abstand zählt nicht als angedockt');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
