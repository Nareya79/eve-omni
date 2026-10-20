// AI Block A (18.10.2026): AI5 Titel im Overlay-Balken nie unterstrichen; AI3 Gank-Ampel der Läufe rechts (nicht im abgeschnittenen Namen),
// aufgeklappt Schiff + Fitting-Symbole; AI2 Browser zeichnet neue Tabs nach dem Zeigen neu.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const css = html.slice(0, html.indexOf('</style>'));
  assert(/html\.sat-win #ov-root \.ov-tab\.sat-title\[aria-selected\]\{border-bottom-color:transparent;box-shadow:none\}/.test(css) && /\.ov-tab\[aria-selected="true"\]:not\(\.sat-title\)\{border-bottom-color:color-mix/.test(css), 'AI5: Titel nie unterstrichen, auch nicht aktiv');
  assert(/h\.appendChild\(el\("span", "trk-r", \(x\.kind === "Lauf" && x\.state === "active" \? gkRunPillShort\(x\.id, ovRender\) \+ " " : ""\) \+ ovPfB\(x\.res\) \+ "" \+ \(x\.state === "active" \? " · " \+ fmtNum\(x\.bought\)/.test(html), 'AI3: Ampel rechts im Overlay, Rest der Zeile vollständig');
  assert(/'<span class="trk-r">' \+ \(x\.kind === "Lauf" && x\.state === "active" \? gkRunPillShort\(x\.id, tkRedraw\) \+ " " : ""\) \+ '<b title="' \+ TK_TIP \+ '">' \+ ovSigned\(x\.res\) \+ "<\/b> · " \+ fmtNum\(x\.bought\)/.test(html), 'AI3: Ampel rechts im Hauptfenster');
  assert(/if \(run\.ship\) card\.appendChild\(el\("div", "ov-l txt", "Schiff <b>"/.test(html) && /function runFitHtml\(run\)/.test(html), 'AI3: aufgeklappt Schiff + Fitting');
  const i = html.indexOf('function runFitHtml(run){'), j = html.indexOf('function fitIcons(ship){');
  const f = new Function('escapeHtml', 'fitIcons', html.slice(i, j) + '\nreturn runFitHtml;')(x => x, s => s.mods.map(m => m[1] + 'x' + m[0]).join(','));
  assert(f({ fit: '2× Expanded Cargohold II + 1× Reinforced Bulkheads II' }) === '2x1319,1x1335' && f({ fit: '3× Reinforced Bulkheads II' }) === '3x1335' && f({ fit: 'eigenes' }) === 'eigenes', 'Fitting-Text → Symbole');
  assert(/function browserRepaint\(\)\{[^\n]*invalidate\(\)/.test(main) && /bwin\.show\(\); bwin\.focus\(\);\s*browserRepaint\(\);/.test(main) && /w\.on\('show', browserRepaint\); w\.on\('restore', browserRepaint\);/.test(main), 'AI2: Browser zeichnet nach dem Zeigen neu');
  const k = html.indexOf('function gkRunPillShort(id, cb){'), short = new Function('gkRunPill', html.slice(k, html.indexOf('\n', k)) + '\nreturn gkRunPillShort;')(() => ' <span class="pill gk gk-warn" title="t">Gank: riskant 2.020 ISK/EHP</span>');
  assert(short(1) === ' <span class="pill gk gk-warn" title="t">Gank: riskant</span>', 'zugeklappt: Ampel kurz ohne ISK/EHP-Zahl');
  console.log('\nALL AI BLOCK A TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
