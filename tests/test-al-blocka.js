// AL Block A (19.10.2026): Einstellungen › Darstellung aufgeräumt (Symbolfarbe + OmniCom-Leiste im Bereich Farbschema, zwei Knöpfe statt Haken),
// „Overlay-Stil“ mit zwei Knöpfen im eigenen Aussehen, Regler/Auswahllisten nicht fensterbreit, Vor/Zurück + Bereichsname oben links.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const look = html.slice(html.indexOf('data-pane="look"'), html.indexOf('data-pane="overlay"'));
  const fs1 = look.indexOf('<div class="opt-h">Farbschema</div>'), sy = look.indexOf('<div class="opt-h">Symbolfarbe</div>'), om = look.indexOf('<div class="opt-h">OmniCom-Leiste</div>'), ov = look.indexOf('<h3 class="acc-h">Overlay-Stil</h3>');
  assert(fs1 > 0 && sy > fs1 && om > sy && ov > om && !/<h3 class="acc-h">Symbolfarbe<\/h3>/.test(look) && !/Aussehen der Overlays<\/h3>/.test(look), 'Symbolfarbe + OmniCom-Leiste im Bereich Farbschema, Abschnitt heißt „Overlay-Stil“');
  assert(/data-icm="1"[^>]*>wie Farbschema</.test(look) && /data-icm="0"[^>]*>eigene Farbe</.test(look) && /<input type="checkbox" id="ic-scheme" hidden>/.test(look), 'Symbolfarbe: zwei Knöpfe, Haken bleibt unsichtbar die Quelle');
  assert(/var own = document\.getElementById\("ic-own"\); if \(own\) own\.hidden = !!c\.scheme;/.test(html) && /if \(ics\.checked === on\) return; ics\.checked = on; ics\.onchange\(\);/.test(html), 'eigene Farben nur bei „eigene Farbe“ sichtbar');
  assert(/data-ovs="eve"[^>]*>EVE</.test(look) && /data-ovs="omni"[^>]*>EVE Omni</.test(look) && /<select id="ovs-style" hidden>/.test(look) && /sel\.value = b\.getAttribute\("data-ovs"\); sel\.onchange\(\);/.test(html), 'Overlay-Stil: zwei Knöpfe, Liste unsichtbar');
  assert(/\.ovs-sb-eve\{[^}]*border-radius:0/.test(html) && /\.ovs-sb-omni\{[^}]*border-radius:999px/.test(html), 'jeder Stil-Knopf im eigenen Aussehen');
  assert(/#set-pane-look #ic-mode \.btn\[aria-checked="true"\]\{/.test(html), 'gewählter Knopf sichtbar (stärker als AG4-Regel, live gefunden)');
  assert(/\.range-row input\[type=range\]\{flex:0 1 16rem/.test(html) && /#panel-settings \.field select, #panel-settings \.range-row select\{max-width:20rem\}/.test(html), 'Regler + Auswahllisten nicht fensterbreit');
  assert(/<div class="nav-hist" id="nav-hist"><button[^>]*id="nav-back"[^>]*disabled>[^<]*<\/button><button[^>]*id="nav-fwd"[^>]*disabled>[^<]*<\/button><span class="sec-title" id="sec-title"><\/span><\/div>/.test(html), 'Vor/Zurück + Bereichsname oben links');
  assert(/function switchTab\(which\)\{\n    navMark\(which\);/.test(html) && /ev\.altKey && \(ev\.key === "ArrowLeft"/.test(html) && /ev\.button === 3 \|\| ev\.button === 4/.test(html), 'Verlauf in switchTab, Alt+←/→, Maustasten');
  // navMark/navStep echt ausführen
  const a = html.indexOf('  var navHist = []'), b = html.indexOf('  (function(){\n    var b = document.getElementById("nav-back")');
  const els = { "nav-back": { disabled: true }, "nav-fwd": { disabled: true }, "sec-title": { textContent: "" } };
  ["station", "haul", "wallet", "settings"].forEach(k => { els["neo-btn-" + k] = { querySelector: () => ({ textContent: k === "settings" ? "Einstel\u00adlungen" : k.toUpperCase() }) }; });
  const ctx = { document: { getElementById: id => els[id] || null }, seen: [] };
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + '\nfunction switchTab(w){ navMark(w); seen.push(w); }\nthis.f = { navMark, navStep, switchTab };', ctx);
  ["station", "haul", "wallet", "settings"].forEach(w => ctx.f.switchTab(w));
  assert(els["nav-back"].disabled === false && els["nav-fwd"].disabled === true && els["sec-title"].textContent === "Einstellungen", 'nach 4 Seiten: zurück an, vor aus, Name ohne weichen Trennstrich');
  ctx.f.navStep(-1); ctx.f.navStep(-1);
  assert(ctx.seen.slice(-2).join() === 'wallet,haul' && els["nav-fwd"].disabled === false && els["sec-title"].textContent === "HAUL", 'zweimal zurück: Hauling, vor wieder an');
  ctx.f.navStep(1);
  assert(ctx.seen.slice(-1)[0] === 'wallet', 'vor: Wallet');
  ctx.f.switchTab("station");
  assert(els["nav-fwd"].disabled === true && (ctx.f.navStep(1), ctx.seen.slice(-1)[0] === 'station'), 'neue Seite nach Zurück verwirft den Vor-Verlauf');
  ctx.f.switchTab("station");
  ctx.f.navStep(-1);
  assert(ctx.seen.slice(-1)[0] === 'wallet', 'dieselbe Seite zweimal = ein Eintrag');
  // Englisch
  ['"wie Farbschema": "like colour scheme"', '"Farbe frei wählen": "Pick any colour"', '"Zurück (Alt+←, Maustaste zurück)": "Back', '"Uhrfarbe": "Clock colour"', '"Overlay-Stil": "Overlay style"'].forEach(t => assert(html.includes(t), 'EN: ' + t.split(':')[0]));
  console.log('\nALL AL BLOCK A TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
