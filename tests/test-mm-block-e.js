// MM Block E (10.10.2026): OmniCom oben mit Abstand; Streaming-Player im Jukebox-Overlay als Spiegel des Hauptfensters (nur einer spielt)
const html = require('fs').readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
assert(html.indexOf('.neocom > .neo-grp.neo-eve:first-child{margin-top:2px;padding-top:8px;') > 0, 'MM1: oberstes Gruppen-Symbol mit Abstand');
assert(html.indexOf('if (jbStOvOn()) box.appendChild(el("p", "note jb-st-ov"') > 0, 'MM2: Overlay offen = Hauptfenster ohne Player');
assert(html.indexOf('st: id === "musik" ? jbStPub() : undefined') > 0, 'MM2: Overlay bekommt den laufenden Player');
assert(html.indexOf('if (changed){ ovsRender(); ovPublishSatellites(); try{ jbStSync(); }catch(e){} }') > 0, 'MM2: Overlay auf/zu = Player zieht um');
assert(html.indexOf('if (view === "musik") satSt(d.st);') > 0 && html.indexOf('if (src !== stSrc){') > 0, 'MM2: Player wird beim Neuzeichnen nicht neu geladen');
assert(html.indexOf('html.jb-mini .sat-st iframe{height:var(--st-mh, 80px)}') > 0, 'MM2: Mini = kompakter Player');
assert(html.indexOf('if (cmd === "st:off")') > 0 && html.indexOf('"Spielt im Jukebox-Overlay – Overlay schließen, dann spielt es wieder hier.": "') > 0, 'MM2: Aus-Knopf + Text DE/EN');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
