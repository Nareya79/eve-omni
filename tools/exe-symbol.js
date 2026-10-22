// AU3: Symbol + Versionsangaben der EVE-Omni.exe auf src/icon.ico und die Programmversion setzen (wie build.js, ohne Neubau) und prüfen.
//   node tools/exe-symbol.js <EVE-Omni.exe> <icon.ico> <version>          setzen (nur wenn nötig) + prüfen
//   node tools/exe-symbol.js <EVE-Omni.exe> <icon.ico> <version> --pruefen  nur prüfen
// Rückgabe 0 = exe trägt genau die Bilder aus icon.ico und die Version. Laufende exe: wird umbenannt (*.alt, kommt nicht ins Paket).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ResEdit = require(require.resolve('resedit', { paths: [path.join(__dirname, '..'), path.join(os.homedir(), '.evecore-tests', 'home'), __dirname] }));
const [,, exePath, icoPath, VERSION] = process.argv, onlyCheck = process.argv.includes('--pruefen');
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath)), want = ico.icons.map(i => Buffer.from(i.data.isIcon() ? i.data.generate() : i.data.bin));

function state(buf){
  const res = ResEdit.NtExecutableResource.from(ResEdit.NtExecutable.from(buf));
  const g = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  const have = g ? g.icons.map(ic => { const e = res.entries.find(x => x.type === 3 && x.id === ic.iconID); return e ? Buffer.from(e.bin) : null; }) : [];
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0], fv = vi ? vi.getStringValues({ lang: 1033, codepage: 1200 }).FileVersion : '';
  return { icon: have.length === want.length && have.every((b, i) => b && b.equals(want[i])), ver: fv === VERSION };
}

let s = state(fs.readFileSync(exePath));
if (!onlyCheck && !(s.icon && s.ver)){
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath)), res = ResEdit.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries), gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0], v = VERSION.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033); vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileVersion: VERSION, ProductVersion: VERSION });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  const tmp = exePath + '.neu'; fs.writeFileSync(tmp, Buffer.from(exe.generate()));
  try{ fs.unlinkSync(exePath); }catch(e){ fs.renameSync(exePath, exePath.replace(/\.exe$/i, '.' + Date.now() + '.alt')); }   // laufende exe darf umbenannt werden
  fs.renameSync(tmp, exePath);
  s = state(fs.readFileSync(exePath));
}
console.log((s.icon ? '  OK    ' : '  FEHLER ') + 'exe-Symbol = ' + path.basename(icoPath) + ' (' + path.basename(exePath) + ')');
console.log((s.ver ? '  OK    ' : '  FEHLER ') + 'exe-Version ' + VERSION);
process.exit(s.icon && s.ver ? 0 : 1);
