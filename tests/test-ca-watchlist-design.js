// CA (25.10.2026): Watchlist-Zeile neu – Symbole statt Pills (⚔ Konkurrenz, ✋ von Hand offen, 🛡 Gank), rechts Kasten mit ISK oben und Stückzahl darunter,
// abgeschrägte Kante in Verlust-/Gewinnfarbe, Zeilen-Tönung + Balken in der Designfarbe (Hauptfenster + Overlay).
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
function fn(name, args, stubs){ const i = html.indexOf('function ' + name + '('), j = html.indexOf('\n  function ', i + 10); return new Function(...args, html.slice(i, j) + '\nreturn ' + name + ';')(...stubs); }
try{
  const css = html.slice(0, html.indexOf('</style>'));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const signed = n => (n >= 0 ? '+' : '') + (Math.abs(n) >= 1e5 ? (n / 1e6).toFixed(2).replace('.', ',') + ' Mio. ISK' : n.toFixed(2).replace('.', ',') + ' ISK');
  const box = fn('tkValBox', ['ovSigned', 'escapeHtml', 'TK_TIP'], [signed, esc, 'tip']);
  const l = box({ res: -2590000 }, '15/15'), w = box({ res: 12400000 }, '5/8'), z = box({ res: 0 }, '0/104.086'), u = box({ res: null }, '3/0'), s = box({ res: 450 }, '');
  assert(/class="trk-r tv-l"/.test(l) && /<b title="tip">-2,59 <span class="ov-u">Mio\.<\/span><\/b><span class="trk-q">15\/15<\/span>/.test(l), 'Verlust: Kasten rot, Zahl ohne „ISK“, Einheit klein, Stückzahl darunter');
  assert(/tv-w/.test(w) && /\+12,40 <span class="ov-u">Mio\./.test(w), 'Gewinn: Kasten grün');
  assert(/tv-z/.test(z) && /<b title="tip">\+0,00<\/b>/.test(z) && /tv-z/.test(u) && /<b title="tip">–<\/b>/.test(u), '±0 und unbekannt: Kasten grau');
  assert(/<b title="tip">\+450,00<\/b><\/span><\/span>$/.test(s), 'ohne Einheit und ohne zweite Zeile');
  const keep = fn('tkKeepIc', [], []), comp = fn('compIc', ['escapeHtml', 'compTitle'], [esc, c => 'Konkurrenz ' + c.level]);
  assert(/trk-ic tic-warn" title="Von Hand wieder geöffnet[^"]*">✋/.test(keep({ keepOpen: true })) && keep({}) === '', '✋ statt „von Hand offen“, Text im Tooltip');
  assert(/tic-ok" title="Konkurrenz ruhig">⚔/.test(comp({ level: 'ruhig' })) && /tic-warn/.test(comp({ level: 'mittel' })) && /tic-bad/.test(comp({ level: 'heiß' })) && comp(null) === '', '⚔ grün/gelb/rot statt Pill');
  const gk = fn('gkRunIc', ['hrLoad', 'gkRunCalc', 'gkTip', 'escapeHtml'], [() => [{ id: 'r1' }], (r, cb) => r.g, () => 'Gank-Check: x', esc]);
  assert(gk('r9') === '', 'ohne Lauf kein Schild');
  assert(/trk-ic tic-ok" title="Gank-Check: x">🛡/.test(fn('gkRunIc', ['hrLoad', 'gkRunCalc', 'gkTip', 'escapeHtml'], [() => [{ id: 'r1' }], () => ({ lvl: 'ok', q: 5 }), () => 'Gank-Check: x', esc])('r1')), '🛡 grün statt „Gank: sicher“');
  assert(/tic-unk" title="Gank-Check: EHP wird/.test(fn('gkRunIc', ['hrLoad', 'gkRunCalc', 'gkTip', 'escapeHtml'], [() => [{ id: 'r1' }], () => ({ busy: true }), () => '', esc])('r1')), '🛡 grau solange gerechnet wird');
  assert(/TR_ESI_TIP \+ '">↻ ' \+ fmtT\(/.test(html), '„neu: 11:10“ → „↻ 11:10“');
  assert(/tkKeepIc\(x\) \+ \(x\.kind === "Trade" \? compIc\(compTrade\(x\.id\)\) : x\.state === "active" \? gkRunIc\(x\.id, tkRedraw\) : ""\)/.test(html) && /tkValBox\(x, fmtNum\(x\.bought\)/.test(html), 'Hauptfenster-Zeile nutzt Symbole + Kasten');
  assert(/tkKeepIc\(x\) \+ \(x\.state !== "active" \? "" : x\.kind === "Trade" \? compIc\(compTrade\(x\.id\)\) : gkRunIc\(x\.id, ovRender\)\)/.test(html) && /h\.insertAdjacentHTML\("beforeend", tkValBox\(x, /.test(html), 'Overlay-Zeile nutzt Symbole + Kasten');
  assert(/fn\.insertAdjacentHTML\("beforeend", \(full\.classList\.contains\("tc-card"\) \? tkKeepIc\(x\) : tkKeepPill\(x\)\) \+ tkMuteBtn\(x\) \+ \(fn\.querySelector\("\.tk-next"\) \? "" : tkNextHtml\(x\)\)\)/.test(html), 'aufgeklappt: ✋ an der Kachel-Karte, „↻“ nur einmal');
  // CB (25.10.): aufgeklappte Trade-Karte als drei Kacheln
  assert(/var tb = tile\("Kaufen"\), ts = tile\("Verkaufen"\), tg = tile\("Ergebnis"\);/.test(html) && /tl\.appendChild\(tb\); tl\.appendChild\(ts\); tl\.appendChild\(tg\);/.test(html), 'CB: Kacheln Kaufen · Verkaufen · Ergebnis, Kauf immer links');
  assert((html.match(/\.classList\.add\("cp-hot"\)/g) || []).length === 6, 'CB/CC (+ HL/G1 Multibuy): neuer Preis (überboten/unterboten), setzen zu und einstellen zu gelb hervorgehoben');
  assert(/trPendCp\(ovCp\(tscFmtPrice\(ev\.buyCheck\.newPrice\)[^\n]*"buy", ev\.buyCheck\.newPrice\)\)\.classList\.add\("cp-hot"\)/.test(html) && /"sell", ev\.sellCheck\.newPrice\)\)\.classList\.add\("cp-hot"\)/.test(html), 'CB: Kopieren merkt sich weiter den gesetzten Preis (trPendCp)');
  assert(/twPlanHtml\(ev, t, ovSigned\)\.split\(" · <span>Gewinn netto"\)\[0\]/.test(html), 'CB: Plan-Warnung ohne doppelten Gewinn');
  assert(/nm\.lastChild\.appendChild\(mkBtn\(t\.tid\)\);/.test(html.slice(html.indexOf('function ovTradeCard('))), 'CB: „Markt in EVE“ bleibt als Symbol am Namen');
  assert(/\.tc-t::before\{content:"";position:absolute;inset:1px;background:var\(--tc-f\);clip-path:polygon\(10\.6px 0,/.test(css) && /\.tc-tiles \.tsc-cp::before\{content:"";position:absolute;inset:1px;/.test(css), 'CB: Kacheln + Kopier-Kästchen mit durchgehender schräger Kante');
  assert(/@container \(max-width: 470px\)\{ \.tc-tiles\{grid-template-columns:1fr 1fr\}/.test(css), 'CB: schmales Overlay – Ergebnis unter Kauf/Verkauf');
  // CC (25.10.): Lauf-Karte B – Schritt-Leiste, Kacheln Kaufen · Transport · Verkaufen, Route + Ziel in EVE an beiden Stationen
  // 25.10. (Nutzer: blinkt/leuchtet zu viel): aufgeklappte Karte ruhig, Kacheln neutral, nur Aufgabe gelb; Rest angeglichen
  assert(/html :is\(#ov-root, \.trk-list, \.tc-main\) \.ov-card\.tc-card\{animation:none;box-shadow:none;/.test(css), 'aufgeklappte Karte blinkt und leuchtet nicht');
  assert(/\.tc-t\{--tc-e:color-mix\(in srgb, var\(--text\) 18%, transparent\)/.test(css) && /\.tc-t\.tc-hot\{--tc-e:var\(--warn\)/.test(css), 'Kacheln neutral, nur die mit Aufgabe gelb');
  assert(/\(trkOpen\[k\] && \(x\.kind === "Trade" \|\| x\.kind === "Lauf"\) \? /.test(html) && /card\.classList\.add\("tc-done"\)/.test(html), 'erledigte/abgebrochene aufgeklappt = Kachel-Karte mit Wieder öffnen · Prüfen · Löschen');
  assert(/var lx = ovLine\("tc-lim"\); lx\.appendChild\(el\("span", "", "nicht über"\)\);/.test(html) && /var ln = ovLine\("tc-lim"\);\s*ln\.appendChild\(el\("span", "", "nicht unter"\)\);/.test(html) && /\.tc-t > \.tc-lim\{order:9;margin-top:auto;/.test(css), '„nicht über/unter“ dezent unten in der Kachel');
  assert(/\.tc-tiles \.tsc-cp\.cp-hot::after\{content:\"\";position:absolute;inset:3px;/.test(css), 'gelber Knopf mit Rahmen außen herum (Linie, Abstand, Knopf)');
  // 25.10.: zugeklappt „aus Lauf …“ / „nur Verkauf“ / „n Verkaufs-Trades“ nur als Symbol
  const runIc = fn('tkRunIc', ['escapeHtml'], [esc]);
  const ic1 = runIc(' <span class="pill tr-run-tag" title="Verkaufs-Trade aus dem Hauling-Lauf X">⇄ aus Lauf Jita IV → Onnamon IV</span>');
  assert(/^ <span class="trk-ic tic-unk" title="Verkaufs-Trade aus dem Hauling-Lauf X – ⇄ aus Lauf Jita IV → Onnamon IV">⇄<\/span>$/.test(ic1), 'zugeklappt: ⇄ statt „aus Lauf …“, Text im Tooltip');
  assert(/>⇢<\/span>$/.test(runIc(' <span class="pill tr-run-tag" title="t">⇢ nur Verkauf, ohne Einkauf</span>')) && /title="t – ⇄ 2 Verkaufs-Trades">⇄/.test(runIc(' <span class="pill tr-run-tag" title="t">⇄ 2 Verkaufs-Trades</span>')) && runIc('') === '', '⇢ nur Verkauf, ⇄ Verkaufs-Trades, leer bleibt leer');
  assert((html.match(/hcBtnHtml\(x\.items\[0\]\.tid\) \+ tkRunIc\(trRunTag\(x\)\) : tkRunIc\(trRunPill\(x\)\)/g) || []).length === 2, 'Overlay- und Hauptfenster-Zeile nutzen das Symbol');
  assert(/el\("div", "tc-steps", \["Kaufen", "Unterwegs", "Verkaufen"\]/.test(html) && /var tb = tile\("Kaufen", 1\), tw = tile\("Transport", 2\), ts = tile\("Verkaufen", 3\);/.test(html), 'CC: Schritt-Leiste + drei Kacheln');
  assert(/stTile\(tb, run\.fromName, "a"\);/.test(html) && /stTile\(ts, run\.toName, "b"\);/.test(html) && /data-ova="runRt"/.test(html) && /data-ova="runDest"/.test(html), 'CC: Route + Ziel in EVE an Start- und Zielstation');
  assert(/if \(a\.type === "runRt" \|\| a\.type === "runDest"\)\{ runStAction\(a\.type, String\(a\.arg\)\); return; \}/.test(html), 'CC: Aktionen im Overlay und Hauptfenster');
  const rsa = html.slice(html.indexOf('async function runStAction('), html.indexOf('  function ovRunCard(run){'));
  assert(/sid = p\[1\] === "a" \? run\.from : run\.to/.test(rsa) && /rtApDest\(cid, sid, /.test(rsa), 'CC: Ziel = genau die Station (Stations-ID), nicht nur das System');
  assert(/myLocSys\(lc\)/.test(rsa) && /haulRoute\(from, to, false, true\)/.test(rsa), 'CC: Route von deinem Standort');
  assert(/ovMultibuy\(run\.items\)\)\.querySelector\("\.tsc-cp"\)\.classList\.add\("cp-hot"\)/.test(html), 'CC: Einkaufsliste (Multibuy) gelb im Schritt Kaufen');
  // H2: Hauptfenster nutzt dieselben Karten, Läufe mit Warenliste
  assert(/x\.kind === "Trade" \|\| x\.kind === "Lauf"\) \? '<div class="tc-main" data-tc-main="'/.test(html) && /var card = kind === "Trade" \? ovTradeCard\(m, null\) : ovRunCard\(m\); tcDecorate\(card, x, true\);/.test(html), 'H2: aufgeklappt = Kachel-Karte im Hauptfenster');
  assert(/if \(kind === "Lauf"\) card\.appendChild\(hrDetail\(m\)\);/.test(html) && /ovFormWire\(p, function\(a\)\{ ovSatAction\("track", a\); \}\);/.test(html), 'H2: Warenliste bei Läufen, Knöpfe über ovSatAction');
  assert(/f\.appendChild\(b\); f\.appendChild\(el\("span", "", hcBtnHtml\(tid\)\)\.firstChild\);/.test(html) && !/hcBtnHtml\(t\.tid\) \+ compIc\(/.test(html), 'H2: Preisverlauf ∿ kommt einmal mit dem Markt-Knopf (mkBtn)');
  assert(/html :is\(#ov-root,\.trk-list,\.hl-cards\) \.ov-card\.trk-sm:has\(\.trk-rb\)\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;[^}]*background-image:linear-gradient\(90deg, color-mix\(in srgb, var\(--accent\) 20%/.test(css), 'Zeile in der Designfarbe getönt, schlägt den EVE-Hintergrund');
  assert(css.indexOf('html :is(#ov-root,.trk-list,.hl-cards) .ov-card.trk-sm:has(.trk-rb){') > css.indexOf('html.ov-eve #ov-root .ov-card{background:'), 'Tönung steht nach der EVE-Regel');
  assert(/\.ov-bar-mini:not\(\.dn\) > span\{background:linear-gradient\(90deg, color-mix\(in srgb, var\(--accent\) 55%, #000\), color-mix\(in srgb, var\(--accent\) 80%, #fff\)\);box-shadow/.test(css), 'Balken: Verlauf + Schein in der Designfarbe');
  assert(/\.trk-r:has\(\.trk-rb\)\{[^}]*padding-left:2px;background:var\(--tv-e\);clip-path:polygon\(9px 0,/.test(css) && /\.trk-rb\{[^}]*background:var\(--tv-b\);clip-path:polygon\(10px 0,/.test(css), 'Kante links + Schräge durchgehend (äußere Fläche = Kantenfarbe, innere versetzt)');
  assert(/\.trk-r\.tv-l\{--tv-e:var\(--loss\)/.test(css) && /\.trk-r\.tv-w\{--tv-e:var\(--profit\)/.test(css) && /\.trk-r\.tv-z\{--tv-e:color-mix\(in srgb, var\(--accent\)/.test(css), 'Kantenfarbe rot/grün/Designfarbe');
  assert(/\.ov-name > \.trk-nm\{flex:0 1 auto;min-width:4em;max-width:none\}/.test(css), 'Name nicht mehr bei 13em abgeschnitten');
  console.log('\nALL CA WATCHLIST DESIGN TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
