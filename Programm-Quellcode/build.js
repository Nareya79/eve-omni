// Baut den Windows-Ordner EVE-Omni-win32-x64 aus dem offiziellen Electron-Paket (Pruefsumme geprueft)
// und dem Programmcode in src/. Setzt Symbol und Versionsangaben der EVE-Omni.exe mit resedit (ohne Wine).
// Aufruf (im Ordner Programm-Quellcode): npm install resedit@3.1.0 && node build.js <entpacktes electron-win32-x64> <Ziel>
'use strict';
const fs = require('fs'), path = require('path');
const ResEdit = require('resedit');
const [,, SRC_ELECTRON, OUT] = process.argv;
const APP_SRC = path.join(__dirname, 'src');
const VERSION = require('./src/package.json').version;

function copyDir(a, b){
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })){
    const s = path.join(a, e.name), d = path.join(b, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
// Aktuelle EVE-Omni.html aus dem Projektordner (eine Ebene hoeher) mitliefern
const projectHtml = path.join(__dirname, '..', 'EVE-Omni.html');
if (fs.existsSync(projectHtml)){ fs.mkdirSync(path.join(APP_SRC, 'evecore'), { recursive: true }); fs.copyFileSync(projectHtml, path.join(APP_SRC, 'evecore', 'EVE-Omni.html')); }
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(SRC_ELECTRON, OUT);
fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'EVE-Omni.exe'));
try{ fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true }); }catch(e){}
// Nur deutsche und englische Sprachdateien (spart ~45 MB)
for (const f of fs.readdirSync(path.join(OUT, 'locales'))) if (!/^(de|en-US)\.pak$/.test(f)) fs.unlinkSync(path.join(OUT, 'locales', f));
copyDir(APP_SRC, path.join(OUT, 'resources', 'app'));

// Symbol + Versionsangaben
const exePath = path.join(OUT, 'EVE-Omni.exe');
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
const res = ResEdit.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(APP_SRC, 'icon.ico')));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const v = VERSION.split('.').map(Number);
vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, {
  FileDescription: 'EVE Omni', ProductName: 'EVE Omni', CompanyName: 'EVE Omni (privat)', InternalName: 'EVE Omni',
  OriginalFilename: 'EVE-Omni.exe', LegalCopyright: 'Privates Werkzeug für EVE Online. Enthält Electron (MIT) und Chromium.',
  FileVersion: VERSION, ProductVersion: VERSION
});
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('gebaut:', OUT);
