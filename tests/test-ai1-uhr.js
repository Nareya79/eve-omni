// AI1 (18.10.2026): Timer mit Wochentagen (keiner = täglich, einer = wöchentlich), Stoppuhr, OmniCom-Uhr: Linksklick = Timer, Rechtsklick = Uhrzeit umschalten.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const i = html.indexOf('function tmNextAt(hm, utc, now, days){'), j = html.indexOf('function tmWhen(t){');
  const pre = 'var TM_DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];';
  const env = new Function(pre + html.slice(i, j) + ' return { next: tmNextAt, calc: tmCalc, txt: tmDaysTxt };')();
  const mon = Date.UTC(2026, 9, 19, 10, 0);   // Montag 19.10.2026 10:00 UTC
  assert(env.next('18:00', true, mon, []) === Date.UTC(2026, 9, 19, 18, 0), 'täglich: heute 18:00');
  assert(env.next('18:00', true, mon, [3]) === Date.UTC(2026, 9, 21, 18, 0), 'wöchentlich Mittwoch: Mi 21.10.');
  assert(env.next('09:00', true, mon, [1]) === Date.UTC(2026, 9, 26, 9, 0), 'Montag 9:00 schon vorbei → nächster Montag');
  assert(env.next('18:00', true, mon, [6, 0]) === Date.UTC(2026, 9, 24, 18, 0), 'Wochenende: Sa 24.10.');
  assert(env.calc({ mode: 'deve', v: '18:00', days: [3] }, mon) === Date.UTC(2026, 9, 21, 18, 0) && env.calc({ mode: 'eve', v: '18:00', days: [3] }, mon) === Date.UTC(2026, 9, 19, 18, 0), 'Wochentage nur bei „wiederholen“');
  assert(env.txt([]) === 'täglich' && env.txt([3]) === 'jeden Mittwoch' && env.txt([0, 1, 6]) === 'Mo, Sa, So', 'Anzeige der Wiederholung');
  assert(/if \(mode\[0\] === "d"\)\{ n\.days = \[\]; for \(var wd = 0; wd < 7; wd\+\+\) if \(f\["tmD" \+ wd\]\) n\.days\.push\(wd\); \}/.test(html), 'Anlegen übernimmt die Wochentage');
  assert(/a\.type === "tmSwGo"\)\{ d\.sw = d\.sw \|\| \{ acc: 0 \}; if \(d\.sw\.run\)\{ d\.sw\.acc \+= now - d\.sw\.run; d\.sw\.run = 0; \} else d\.sw\.run = now; \}/.test(html) && /a\.type === "tmSwReset"\) d\.sw = \{ acc: 0 \}/.test(html), 'Stoppuhr Start/Pause/Zurück');
  assert(/if \(target === "clock"\) target = "timer";/.test(html) && /target: "clockMode"/.test(html) && /b\.id !== "neo-btn-timer"/.test(html), 'Uhr: Linksklick Timer, Rechtsklick Uhrzeit, Timer-Kachel weg');
  console.log('\nALL AI1 TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
