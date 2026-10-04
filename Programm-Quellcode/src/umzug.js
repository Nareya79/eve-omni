// BB0: EVECore heisst jetzt EVE Omni. Beim ersten Start die alten Daten einmal in den neuen Ordner kopieren
// (%APPDATA%\EVECore -> %APPDATA%\EVE Omni, Dokumente\EVECore-Sicherungen -> EVE-Omni-Sicherungen). Der alte Ordner bleibt als Sicherung.
'use strict';
const fs = require('fs'), path = require('path');
// Zwischenspeicher baut Chromium selbst neu auf – nicht mitkopieren (beim Nutzer ~400 MB)
const SKIP = /^(Cache|Code Cache|GPUCache|DawnCache|DawnGraphiteCache|DawnWebGPUCache|GrShaderCache|ShaderCache|Crashpad|blob_storage|lockfile|SingletonLock)$/i;
// Merker "Umzug fertig" im neuen Ordner. Nicht "gibt es den Ordner schon": ein Start ohne Umzug
// (Testlauf, Hinweis "EVECore laeuft noch") legt ihn leer an – dann muss der Umzug trotzdem kommen (2.0.37).
const MARK = 'umzug-von-evecore.txt';
function copyTree(from, to){
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })){
    if (SKIP.test(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    try{ if (e.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b); }catch(err){}   // gesperrte Einzeldatei: Rest trotzdem kopieren
  }
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
// true = kopiert. Nur wenn es den alten Ordner gibt und der neue noch keinen Merker hat.
function moveOnce(from, to){
  if (!fs.existsSync(from) || fs.existsSync(path.join(to, MARK))) return false;
  // schon angelegter Ordner ohne Umzug: zur Seite legen (nicht loeschen). Geht das nicht (EVE Omni laeuft), nichts tun.
  if (fs.existsSync(to)) try{ fs.renameSync(to, to + ' (vor Umzug ' + stamp() + ')'); }catch(e){ return false; }
  const tmp = to + '.neu';
  fs.rmSync(tmp, { recursive: true, force: true });
  copyTree(from, tmp);
  fs.writeFileSync(path.join(tmp, MARK), 'Daten aus ' + from + ' übernommen am ' + new Date().toLocaleString('de-DE') + '\r\n');
  fs.renameSync(tmp, to);   // erst am Ende umbenennen: ein abgebrochener Umzug wird beim naechsten Start wiederholt
  return true;
}
// Sicherungen bekommen dabei den neuen Namen (EVECore-Sicherung-… -> EVE-Omni-Sicherung-…); vorhandene bleiben
function moveBackups(from, to){
  if (!fs.existsSync(from) || fs.existsSync(path.join(to, MARK))) return false;
  fs.mkdirSync(to, { recursive: true });
  for (const n of fs.readdirSync(from)){
    const b = path.join(to, n.replace(/^EVECore-/, 'EVE-Omni-'));
    try{ if (/\.json$/i.test(n) && !fs.existsSync(b)) fs.copyFileSync(path.join(from, n), b); }catch(e){}
  }
  fs.writeFileSync(path.join(to, MARK), 'Sicherungen aus ' + from + ' übernommen\r\n');
  return true;
}
module.exports = { copyTree, moveOnce, moveBackups, MARK };
