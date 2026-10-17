// LL Block B (10.10.2026): Route-Klick = Ziel in EVE (aktiver Client), Vorschau-Haken → Clients beim Umschalten auslassen
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8'), main = fs.readFileSync('/home/claude/main.js', 'utf8'), cs = fs.readFileSync('/home/claude/helfer.cs', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
// LL6: cycleCfg + cycleSend schicken SKIP an den Helfer
const a = main.indexOf('function cycleCfg('), b = main.indexOf('function cycleSend('), e = main.indexOf('let pushSoonTimer');
const sent = [], S = { cycle: { on: true, order: ['Aria'], skip: ['Kael', '', 'No\tva'] } };
const f = new Function('S', 'DEFAULTS', 'cleanKey', 'demoOn', 'fgWrite', main.slice(a, e).replace('function fgWrite(', 'function fgWriteOrig(') + '; return { cycleCfg, cycleSend };')
  (S, { cycle: { fwd: {}, back: {} } }, () => ({ vk: 9, mods: 0 }), () => false, l => sent.push(l));
f.cycleSend();
assert(sent.some(l => l === 'SKIP Kael\tNo va'), 'LL6: SKIP-Zeile mit bereinigten Namen');
assert(f.cycleCfg().skip.length === 2, 'LL6: leere Namen raus');
assert(/if \(p\[0\] == "SKIP"\)/.test(cs) && /offs\.ContainsKey\(c\.Name\)\) continue;/.test(cs), 'LL6: Helfer lässt Clients aus');
assert(!/HashSet/.test(cs.replace(/kein HashSet[^\n]*/g, '')), 'LL6: kein HashSet im Helfer (System.Core)');
assert(/page-title-updated', \(ev, t\) => \{ if \(\/\^\[01\]-\/\.test\(t\)\) pvSkipSet/.test(main), 'LL6: Haken-Fenster meldet Klick');
assert(/if \(patch\.cycle\)\{ S\.cycle = cycleCfg\(\); cycleSend\(\); pvSync\(\); \}/.test(main), 'LL6: Einstellungen ziehen Vorschau-Haken nach');
assert(html.indexOf('el("label", "chk cy-tab"') >= 0, 'LL6: Tab-Haken in Einstellungen');
// LL5: Systemnamen in der Route
assert(/data-dest="' \+ Number\(id\)/.test(html), 'LL5: sysDest');
assert(html.indexOf(`function sysDest(id, name){ return '<a href="https://zkillboard.com/system/' + Number(id)`) >= 0 && html.indexOf(`icMini("ziel") + "</button>"; }   // LL5: Name = zKillboard`) >= 0, 'LL5: Name = zKillboard, Ziel-Symbol dahinter');
assert((html.match(/sysDest\(id, x\.n\)/g) || []).length === 2, 'LL5: große Seite + Overlay');
assert(/cid = await mkChar\("esi-ui\.write_waypoint\.v1"\)/.test(html), 'LL5: aktiver Client mit Autopilot-Berechtigung');
assert(/\[data-demo-cl\],\[data-dest\]/.test(html), 'LL5: in der Demo gesperrt');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
