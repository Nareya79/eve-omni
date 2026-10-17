// LL Block C (10.10.2026): geteilte Kurzlinks (Deezer „Teilen“, Spotify-App) in der Jukebox auflösen, sonst klare Meldung am Feld
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8'), main = fs.readFileSync('/home/claude/main.js', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const a = main.indexOf("ipcMain.handle('evecore:resolveLink'");
assert(a > 0, 'C: resolveLink im Programm');
const body = main.slice(a, main.indexOf('\n});', a));
assert(body.indexOf('link\\.deezer\\.com') > 0 && body.indexOf("x.protocol !== 'https:'") > 0, 'C: nur https + bekannte Kurzlink-Hosts');
const src = /const ok = \/(.+)\/;/.exec(body)[1], re = new RegExp(src);
assert(re.exec('https://www.deezer.com/de/playlist/908622995?utm=x')[0] === 'https://www.deezer.com/de/playlist/908622995', 'C: Deezer-Playlist aus Zieladresse');
assert(!re.test('https://www.deezer.com/deezer-links-404'), 'C: kaputter Kurzlink = kein Treffer');
assert(html.indexOf('EVH.resolveLink(u)') > 0 && html.indexOf('id="jb-sp-msg"') > 0, 'C: Seite löst Kurzlink auf, Meldung am Feld');
assert(html.indexOf('"Der geteilte Link ließ sich nicht auflösen. Öffne ihn im Browser und kopiere die Adresse aus der Adresszeile.": "') > 0, 'C: Meldung auf Englisch');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
