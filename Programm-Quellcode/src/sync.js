// Einstellungs-Sync direkt im Programm - dieselben Regeln wie die .bat aus dem Sync-Tab:
//  * Quelle = die NEUESTE core_char_<Quelle>.dat ueber alle Profile settings_*
//  * Ziele  = alle anderen core_char_<ID>.dat (Modus ALL) oder die ausgewaehlten IDs (Modus LIST), in ALLEN Profilen
//  * optional Account-Datei: core_user_<Account>.dat, die zuletzt gespeicherte im Profil der Quelle,
//    auf alle anderen core_user_*.dat in allen Profilen (mit Warnung, wenn zuletzt ein anderer Charakter gespeichert hat)
//  * vorher Backup nach _backup_settings_sync_<Zeit>\<Profil>\ inkl. wiederherstellen.bat, danach Byte-Vergleich
//  * bricht ab, wenn EVE laeuft
'use strict';
const fs = require('fs');
const path = require('path');

const CHAR_RE = /^core_char_(\d+)\.dat$/;
const USER_RE = /^core_user_(\d+)\.dat$/;

function stamp(d){
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function listProfiles(base){
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^settings_/i.test(e.name))
    .map(e => ({ name: e.name, dir: path.join(base, e.name) }));
}
function filesIn(dir, re){
  let out = [];
  try{ out = fs.readdirSync(dir).filter(n => re.test(n)).map(n => ({ name: n, id: n.match(re)[1], full: path.join(dir, n), mtime: fs.statSync(path.join(dir, n)).mtimeMs })); }catch(e){}
  return out;
}
function sameBytes(a, b){
  try{ return Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0; }catch(e){ return false; }
}
function fmtTime(ms){ return new Date(ms).toLocaleString('de-DE'); }

const RESTORE_BAT = [
  '@echo off',
  'title EVE Einstellungs-Sync - Wiederherstellen',
  'tasklist /FI "IMAGENAME eq exefile.exe" 2>nul | findstr /I /C:"exefile.exe" >nul',
  'if not errorlevel 1 (echo EVE laeuft noch - bitte alle Clients schliessen und erneut starten. & pause & exit /b 1)',
  'pushd "%~dp0"',
  'for /D %%P in (settings_*) do xcopy "%%P\\*" "..\\%%P\\" /Y /I /Q',
  'popd',
  'echo Wiederherstellung abgeschlossen.',
  'pause',
  ''
].join('\r\n');

// opts: { sourceId, sourceName, mode:'ALL'|'LIST', targetIds:[], account:bool, dryRun:bool, accountConfirmed:bool }
// env:  { base, eveRunning: () => Promise<bool>, now?: Date }
async function run(opts, env){
  const lines = [];
  const L = s => lines.push(s);
  const src = String(opts.sourceId || '');
  if (!/^\d+$/.test(src)) return { ok: false, lines: ['Ungültiger Quell-Charakter.'] };
  const base = env.base;
  L('Quelle: ' + (opts.sourceName || '') + ' [' + src + ']');
  if (!base || !fs.existsSync(base)){ L('EVE-Einstellungsordner nicht gefunden:'); L(String(base)); return { ok: false, lines }; }
  if (await env.eveRunning()){
    L('EVE läuft noch. Bitte alle EVE-Clients schließen und dann erneut auf „Direkt übertragen“ klicken.');
    L('Es wurde nichts verändert.');
    return { ok: false, lines, eveRunning: true };
  }
  const profiles = listProfiles(base);
  if (!profiles.length){ L('Keine Profilordner settings_… gefunden.'); return { ok: false, lines }; }

  // 1) neueste Quelldatei
  let newest = null;
  profiles.forEach(p => { const f = path.join(p.dir, 'core_char_' + src + '.dat'); if (fs.existsSync(f)){ const m = fs.statSync(f).mtimeMs; if (!newest || m > newest.mtime) newest = { profile: p, full: f, mtime: m }; } });
  if (!newest){
    L('Für den Quell-Charakter gibt es in keinem Profil eine Einstellungsdatei.');
    L('Einmal mit diesem Charakter in EVE einloggen, EVE schließen, dann erneut versuchen.');
    return { ok: false, lines };
  }
  L('Neueste Einstellungen des Quell-Charakters: ' + newest.profile.name + ', Stand ' + fmtTime(newest.mtime));

  // 2) Ziele
  let targets;
  if (opts.mode === 'LIST') targets = (opts.targetIds || []).map(String).filter(t => /^\d+$/.test(t) && t !== src);
  else {
    const seen = {};
    targets = [];
    profiles.forEach(p => filesIn(p.dir, CHAR_RE).forEach(f => { if (f.id !== src && !seen[f.id]){ seen[f.id] = 1; targets.push(f.id); } }));
  }
  targets = Array.from(new Set(targets)).sort((a, b) => Number(a) - Number(b));
  if (!targets.length){ L('Keine Ziel-Charaktere gefunden.'); return { ok: false, lines }; }
  L('Ziele: ' + targets.join(' '));

  // 3) Account-Datei
  let acct = opts.account !== false, sacc = null, accountWarning = null, accounts = [];
  if (acct){
    const chars = filesIn(newest.profile.dir, CHAR_RE).sort((a, b) => b.mtime - a.mtime);
    const users = filesIn(newest.profile.dir, USER_RE).sort((a, b) => b.mtime - a.mtime);
    if (!users.length){ L('Hinweis: keine Account-Datei gefunden, Account-Einstellungen werden nicht angeglichen.'); acct = false; }
    else {
      sacc = users[0];
      L('Account-Einstellungen: Quelle core_user_' + sacc.id + ' aus ' + newest.profile.name + ' (zuletzt gespeicherte Account-Datei)');
      if (chars.length && chars[0].id !== src){
        accountWarning = 'Zuletzt gespeichert wurde nicht der Quell-Charakter, sondern Charakter ' + chars[0].id +
          '. Die Account-Datei gehört dann wahrscheinlich zu einem anderen Account. Sicher geht es so: EVE mit NUR dem Quell-Charakter starten, einloggen, EVE schließen, dann erneut versuchen.';
        L('ACHTUNG: ' + accountWarning);
        if (!opts.dryRun && !opts.accountConfirmed){ acct = false; L('Account-Einstellungen werden NICHT angeglichen, nur die Charakter-Einstellungen.'); }
      }
      const seenA = {};
      profiles.forEach(p => filesIn(p.dir, USER_RE).forEach(f => { if (!seenA[f.id]){ seenA[f.id] = 1; accounts.push(f.id); } }));
      accounts.sort((a, b) => Number(a) - Number(b));
      if (acct) L('Accounts: ' + accounts.join(' '));
    }
  } else L('Account-Einstellungen werden nicht angeglichen (Häkchen aus).');

  if (opts.dryRun){
    L('');
    L('Profile: ' + profiles.map(p => p.name).join(', '));
    L('Noch nichts verändert. Vorher wird automatisch ein Backup angelegt. EVE muss dabei geschlossen bleiben.');
    return { ok: true, lines, accountWarning, targets, accounts: acct ? accounts : [], profiles: profiles.map(p => p.name) };
  }

  // 4) Kopieren mit Backup
  const bk = path.join(base, '_backup_settings_sync_' + stamp(env.now));
  const srcBuf = fs.readFileSync(newest.full);
  const usrBuf = acct && sacc ? fs.readFileSync(sacc.full) : null;
  let ok = 0, neu = 0, err = 0, qok = 0, aok = 0;
  function backup(pName, file){
    const d = path.join(bk, pName);
    fs.mkdirSync(d, { recursive: true });
    fs.copyFileSync(file, path.join(d, path.basename(file)));
  }
  function put(p, fileName, buf, role){
    const dest = path.join(p.dir, fileName);
    const existed = fs.existsSync(dest);
    if (existed && dest === newest.full) { qok++; return; }            // Quelle selbst nicht ueberschreiben
    if (existed && sacc && dest === sacc.full) { aok++; return; }
    try{ if (existed) backup(p.name, dest); }
    catch(e){ L('FEHLER [' + p.name + '] Backup von ' + fileName + ' fehlgeschlagen, Datei nicht angefasst'); err++; return; }
    try{ fs.writeFileSync(dest, buf); }
    catch(e){ L('FEHLER [' + p.name + '] ' + fileName + ' konnte nicht geschrieben werden'); err++; return; }
    if (Buffer.compare(fs.readFileSync(dest), buf) !== 0){ L('FEHLER [' + p.name + '] ' + fileName + ' weicht nach dem Kopieren von der Quelle ab'); err++; return; }
    if (role === 'Q'){ qok++; return; }
    if (role === 'A'){ aok++; return; }
    ok++;
    if (!existed){ neu++; L('NEU    [' + p.name + '] ' + fileName); } else L('OK     [' + p.name + '] ' + fileName);
  }
  profiles.forEach(p => {
    put(p, 'core_char_' + src + '.dat', srcBuf, 'Q');
    targets.forEach(t => put(p, 'core_char_' + t + '.dat', srcBuf, 'T'));
    if (usrBuf) accounts.forEach(a => put(p, 'core_user_' + a + '.dat', usrBuf, 'A'));
  });
  L('');
  L('Fertig: ' + ok + ' Ziel-Datei(en) übertragen, davon ' + neu + ' neu angelegt, ' + err + ' Fehler.');
  L('Quell-Charakter in ' + qok + ' Profil(en) auf dem neuesten Stand.');
  L(usrBuf ? 'Account-Einstellungen: ' + aok + ' Account-Datei(en) von core_user_' + sacc.id + ' angeglichen.' : 'Account-Einstellungen wurden nicht angeglichen.');
  if (fs.existsSync(bk)){
    fs.writeFileSync(path.join(bk, 'wiederherstellen.bat'), RESTORE_BAT);
    L('');
    L('Backup der vorherigen Dateien:');
    L(bk);
    L('Rückgängig machen: dort wiederherstellen.bat doppelklicken.');
  }
  return { ok: err === 0, lines, backupDir: fs.existsSync(bk) ? bk : null, counts: { ok, neu, err, qok, aok } };
}

module.exports = { run, stamp, RESTORE_BAT, sameBytes };
