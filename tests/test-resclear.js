// 18.10.2026: Neue Hauling-/Hub-Suche leert alte Ergebnisse sofort (auch wenn sie nichts findet); Knopf „Ergebnis verwerfen“ im Overlay.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/hlLotsByStation = \{\}; hlDestinations = \[\]; ovHaulLast = null; setTimeout\(ovRender, 0\);/.test(html), 'Hauling-Suche leert das alte Ergebnis beim Start');
  assert(/isRunning = true; ovHubLast = null; setTimeout\(ovRender, 0\);/.test(html), 'Hub-Suche leert das alte Ergebnis beim Start');
  assert(/ovResClearBtn\("haul", L\.t\)/.test(html) && /ovResClearBtn\("hub", H\.t\)/.test(html), 'Knopf „Ergebnis verwerfen“ in Hauling- und Hub-Overlay');
  assert(/if \(a\.type === "resClear"\)\{ resClear\(a\.arg\); return; \}/.test(html) && /function resClear\(k\)\{\s*if \(k === "haul"\)\{ ovHaulLast = null;/.test(html), 'Klick verwirft das Ergebnis (Overlay + Hauptfenster)');
  assert(/old = t && Date\.now\(\) - t > 3600000/.test(html), 'Alter steht dabei, ab 1 Std. gelb');
  console.log('\nALL RESCLEAR TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
