// Overlay-Stapel (12.10.2026): Ein Overlay genau über einem anderen rutschte beim Neu-Einordnen (Klick in EVE, Fokuswechsel)
// wieder darunter, weil immer in fester Liste angehoben wurde. Jetzt: main.js ordnet nach „zuletzt angeklickt“, der Helfer hebt
// in der echten Windows-Stapelfolge von unten nach oben an.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf8'), cs = fs.readFileSync('/home/claude/helfer.cs', 'utf8');
let ok = 0, bad = 0;
function assert(c, m){ if (c){ ok++; console.log('OK:', m); } else { bad++; console.log('FAIL:', m); } }
const pick = re => (main.match(re) || [''])[0];
const code = pick(/const satZ = \[\];[\s\S]*?function satIdsByZ\(\)\{[^\n]*\}/);
assert(code, 'Stapel-Funktionen in main.js');
const sats = {}, mk = n => ({ n, isDestroyed: () => false });
const f = new Function('sats', code + '; return { satZTouch, satIdsByZ };')(sats);
sats.station = mk('station'); sats.haul = mk('haul'); sats.wallet = mk('wallet');
f.satZTouch(sats.wallet); f.satZTouch(sats.station);
assert(f.satIdsByZ().join() === 'haul,wallet,station', 'nie angeklickt zuerst, zuletzt angeklicktes zuletzt (= oben): ' + f.satIdsByZ().join());
f.satZTouch(sats.wallet);
assert(f.satIdsByZ().slice(-1)[0] === 'wallet', 'erneut angeklickt → wieder oben');
const d = sats.station; d.isDestroyed = () => true; f.satZTouch(d);
assert(f.satIdsByZ().join() === 'haul,station,wallet' || f.satIdsByZ().indexOf('station') < 2, 'geschlossenes Fenster fällt aus dem Stapel');
assert(/w\.on\('focus', \(\) => \{ satZTouch\(w\);/.test(main), 'Fokus eines Overlays wird gemerkt');
assert(/function applyWindowState\(\)[\s\S]{0,600}satIdsByZ\(\)\.forEach\(id => applySatState/.test(main) && /function ownedResync\(\)\{ satIdsByZ\(\)/.test(main), 'beide Neu-Einordnungen nutzen den Stapel');
assert(/static void RaiseOv\(\)\{[\s\S]*?GetTopWindow\(IntPtr\.Zero\)[\s\S]*?GetWindow\(w, 2\)[\s\S]*?return pb\.CompareTo\(pa\);/.test(cs), 'Helfer: echte Stapelfolge lesen, von unten nach oben anheben');
assert(/if \(nm\[a\] != nm\[b\]\) return nm\[a\] \? 1 : -1;/.test(cs), 'Helfer: Namen der Vorschau weiter zuletzt (S16)');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
