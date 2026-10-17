// Fehler 04.10.2026: „Cannot read properties of undefined (reading 'vk') at cycleSend“ beim Start – in cycleCfg war „back: …“
// hinter einen Kommentar gerutscht. Prüft cycleCfg/cycleSend aus der echten main.js (normal und in der Demo).
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  const sent = [];
  const env = (demo, cyc) => new Function('S', 'DEFAULTS', 'fgWrite', 'demoOn', 'lastCycleLines',
    pick('cleanKey') + '\n' + pick('cycleCfg') + '\n' + pick('cycleSend') + '\nreturn { cycleCfg, cycleSend };')(
    { cycle: cyc }, { cycle: { fwd: { vk: 9, mods: 0, label: 'Tab' }, back: { vk: 9, mods: 2, label: 'Umschalt+Tab' } } }, l => sent.push(l), () => demo, '');
  let e = env(false, { on: true, order: ['A'] }), c = e.cycleCfg();
  assert(c.fwd && c.back && c.back.vk === 9 && c.back.mods === 2 && c.on === true && c.skipLogin === true && c.order[0] === 'A', 'cycleCfg liefert fwd, back, skipLogin, order (back fehlte vorher)');
  e.cycleSend();
  assert(sent.length && /^CYCLE 1 9 0 9 2 1/.test(sent[0]), 'cycleSend schreibt die CYCLE-Zeile ohne Fehler');
  e = env(true, { on: true }); assert(e.cycleCfg().on === false && e.cycleCfg().back, 'Demo: Umschalten aus, Einstellungen trotzdem vollständig');
  e = env(false, undefined); assert(e.cycleCfg().back.vk === 9, 'ohne gespeicherte Einstellung: Standardtasten');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
