// MM Block F (10.10.2026): Browser-Klappmenüs + Rückfragen im EVE-Omni-Stil, Ordner-Symbol statt 📁; MM2b: im Jukebox-Overlay nur ein Player
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8'), main = fs.readFileSync('/home/claude/main.js', 'utf8'), br = fs.readFileSync('/home/claude/browser.html', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const b0 = main.indexOf('E1: eigenes Browser-Fenster (Adresszeile'), bs = main.slice(b0, main.indexOf('// DD5: offiziellen EVE-Launcher', b0));
assert(!/Menu\.buildFromTemplate|dialog\.showMessageBox/.test(bs), 'F: Browser ohne Windows-Menü/-Dialog');
assert((main.match(/eoMenu\(bwin/g) || []).length === 5 && (main.match(/eoAsk\(bwin/g) || []).length === 5, 'F: 5 Menüs + 5 Rückfragen im EVE-Omni-Stil');
const js = /const EO_POP_JS = `([\s\S]*?)`;/.exec(main)[1];
new Function(js); ok++;
assert(/function eoConv\(tpl, fns\)\{[\s\S]*?return conv\(tMenu\(tpl\)\);/.test(main) && /function eoMenu\(parent, tpl\)\{\s*const fns = \{\}, items = eoConv\(tpl, fns\)/.test(main) && /function eoAskP\(o\)\{\s*o = tDlg\(o\);/.test(main) && /function eoAsk\(parent, o\)\{\s*const p = eoAskP\(o\);/.test(main), 'F: Texte DE/EN wie bei den Windows-Menüs');
assert(!/📁/.test(main) && !/📁/.test(br) && br.indexOf('var FOLDER_SVG = ') > 0, 'F: Ordner-Symbol statt 📁');
assert(br.indexOf('"Neuer Ordner": "New folder"') > 0, 'F: Neuer Ordner auf Englisch');
// MM2b
assert(html.indexOf('var stOn = jbStOvOn() && !!d.stOpen && !!jbStCur();') > 0 && html.indexOf('if (stOn) return;') > 0, 'MM2b: Streaming im Overlay = MP3-Player ausgeblendet');
assert(html.indexOf('if (cmd === "src:st")') > 0 && html.indexOf('if (cmd === "src:mp3") cmd = "st:off";') > 0, 'MM2b: Umschalter Meine Musik / Streaming');
assert(html.indexOf('"Meine Musik": "My music"') > 0, 'MM2b: Englisch');
// Nachbesserung 10.10.: oberstes Gruppen-Symbol mit ganzem Rahmen; Ordner im Browser in der Symbolfarbe
assert(html.indexOf('.neocom > .neo-grp.neo-eve:first-child{margin-top:2px;padding-top:8px;border-top:1px solid') > 0, 'OmniCom: oberer Rahmen');
assert(html.indexOf('EVH.setSettings({ icColor: c })') > 0 && main.indexOf("'deck', 'icColor'") > 0 && main.indexOf("ic: S.icColor || ''") > 0 && br.indexOf('.bm.fd{border-radius:4px;color:var(--ic, #e0b84a)}') > 0, 'Browser: Ordner in der Symbolfarbe');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
