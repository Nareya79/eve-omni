// EVE-Client-Einstellungen sichern / als Profil speichern / wiederherstellen (Nutzer 04.10.2026).
// Quelle: <base>\settings_*\ (core_char_*.dat, core_user_*.dat, core_public__.yaml, prefs.ini) – Browser-Cache u. Ä. bleiben draußen.
// Ziel:   <ziel>\auto-<Zeit> (automatisch/„Jetzt sichern“, die letzten 10 bleiben), profil-<Name> (bleibt), vor-laden-<Zeit> (vor jedem Wiederherstellen)
'use strict';
const fs = require('fs');
const path = require('path');
const { stamp } = require('./sync');

const KEEP = /^(core_char_.*\.dat|core_user_.*\.dat|core_public_.*\.yaml|prefs\.ini)$/i;
const CHAR_RE = /^core_char_(\d+)\.dat$/;
const AUTO_KEEP = 10;

function profiles(base){
  try{ return fs.readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory() && /^settings_/i.test(e.name)).map(e => e.name); }catch(e){ return []; }
}
function list(base, dest){
  const prof = profiles(base), chars = {};
  prof.forEach(p => { try{ fs.readdirSync(path.join(base, p)).forEach(f => { const m = CHAR_RE.exec(f); if (m) (chars[m[1]] = chars[m[1]] || []).push(p); }); }catch(e){} });
  let saves = [];
  try{ saves = fs.readdirSync(dest, { withFileTypes: true }).filter(e => e.isDirectory() && /^(auto|profil|vor-laden)-/.test(e.name)).map(e => {
    let t = 0; try{ t = fs.statSync(path.join(dest, e.name)).mtimeMs; }catch(x){}
    const kind = e.name.split('-')[0];
    return { name: e.name, kind: kind, label: kind === 'profil' ? e.name.slice(7) : e.name, t: t };
  }).sort((a, b) => b.t - a.t); }catch(e){}
  return { base, dest, ok: prof.length > 0, profiles: prof, chars: Object.keys(chars).map(id => ({ id, profiles: chars[id] })), saves };
}
function copyProfiles(fromBase, toBase, filter){
  let n = 0;
  profiles(fromBase).forEach(p => {
    const src = path.join(fromBase, p), dst = path.join(toBase, p);
    fs.readdirSync(src).forEach(f => {
      if (!KEEP.test(f) || (filter && !filter(f))) return;
      const s = path.join(src, f); if (!fs.statSync(s).isFile()) return;
      fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, path.join(dst, f)); n++;
    });
  });
  return n;
}
function safeName(n){ return String(n || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
// kind: 'auto' | 'profil' | 'vor-laden'
function save(base, dest, kind, name){
  if (!profiles(base).length) throw new Error('Kein EVE-Einstellungsordner gefunden: ' + base);
  const folder = kind === 'profil' ? 'profil-' + (safeName(name) || 'ohne Name') : kind + '-' + stamp();
  const to = path.join(dest, folder);
  if (kind === 'profil') fs.rmSync(to, { recursive: true, force: true });   // gleicher Name = Profil überschreiben
  const n = copyProfiles(base, to);
  if (kind !== 'profil') prune(dest);
  return { folder, files: n };
}
function prune(dest){
  const old = list('', dest).saves.filter(s => s.kind !== 'profil');
  old.slice(AUTO_KEEP).forEach(s => fs.rmSync(path.join(dest, s.name), { recursive: true, force: true }));
}
// chars: null = alles; sonst nur core_char_<ID>.dat dieser Charaktere
function restore(base, dest, name, chars){
  const from = path.join(dest, name);
  if (!/^(auto|profil|vor-laden)-/.test(name) || !fs.existsSync(from)) throw new Error('Sicherung nicht gefunden: ' + name);
  const before = save(base, dest, 'vor-laden');
  const want = chars && chars.length ? chars.map(String) : null;
  const n = copyProfiles(from, base, want ? f => { const m = CHAR_RE.exec(f); return !!m && want.indexOf(m[1]) >= 0; } : null);
  return { files: n, before: before.folder };
}
function remove(dest, name){
  if (!/^(auto|profil|vor-laden)-/.test(name)) throw new Error('Ungültiger Name');
  fs.rmSync(path.join(dest, name), { recursive: true, force: true });
}
module.exports = { list, save, restore, remove, profiles, AUTO_KEEP };
