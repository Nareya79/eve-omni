// 4.0.73: Englisch auch in main.js – Tray, Rechtsklick-Menüs, Dialoge, Vorschau-Beschriftung. Prüft die echte main.js:
// jedes label/title/message/detail/buttons-Literal ist im Englisch-Modus übersetzt, Deutsch bleibt Deutsch, Windows-Sprache als Vorgabe.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
const block = n => { const i = main.indexOf('const ' + n + ' = '); const e = main.indexOf('\n};', i) > 0 && n === 'MAIN_EN' ? main.indexOf('\n};', i) + 3 : main.indexOf(']];', i) + 3; return main.slice(i, e); };
const DE = /[äöüÄÖÜß]|\b(und|nicht|oder|für|wird|Fenster|Einstellungen|Ordner|Alle|alle|Beenden|Sperren|Deckkraft|Durchklicken|Hintergrund|immer|Startseite|Löschen|Schließen|Umschalt|Strg|Wirklich|Abbrechen|Karte|Handel|Planeten|Kurier|Charaktere)\b/;
try{
  const env = (lang, loc) => new Function('S', 'app', block('MAIN_EN') + '\n' + block('MAIN_EN_PH') + '\n' + pick('uiLang') + '\n' + pick('T') + '\n' + pick('tMenu') + '\n' + pick('tDlg') + '\nreturn { T, tMenu, tDlg, uiLang };')(
    { lang }, { getLocale: () => loc });
  const en = env('en', 'en-US'), de = env('de', 'en-US');
  // alle Texte, die main.js in Menüs/Dialogen zeigt
  const lits = new Set();
  for (const m of main.matchAll(/\b(label|sublabel|title|message|detail|buttonLabel): *'([^']+)'/g)) lits.add(m[2]);
  for (const m of main.matchAll(/buttons: *\[([^\]]+)\]/g)) for (const b of m[1].matchAll(/'([^']+)'/g)) lits.add(b[1]);
  const viewsSrc = main.slice(main.indexOf('const VIEWS = {'), main.indexOf('};', main.indexOf('const VIEWS = {')));
  for (const m of viewsSrc.matchAll(/: '([^']+)'/g)) lits.add(m[1]);
  ['Wirklich alle 3 EVE-Clients beenden?', 'Wirklich den EVE-Client beenden?', '2 nicht eingeloggt', 'EVE Omni Beta 4.0.73 – Durchklicken aktiv', 'EVE-Clients umschalten mit Umschalt+Tab', 'Strg+Umschalt+L',
    'Ordner „EVE“ mit 3 Lesezeichen löschen?', 'Ordner „Aus Chrome“ gibt es schon.', '12 Lesezeichen importiert.', 'In Chrome – Privat sind keine Lesezeichen.', 'Alle 5 in Tabs öffnen', 'Chrome – Privat (Konto)',
    'Ordner „Aus Chrome“ in der Lesezeichen-Leiste – sortieren unter „Lesezeichen verwalten“.'].forEach(x => lits.add(x));   // BM: zusammengesetzte Texte ganz
  const left = [...lits].filter(x => !/[\s„]$/.test(x) && DE.test(en.T(x)));   // BM: „'Ordner „' + name …“ ebenso   // „'Wirklich ' + …“ = Anfang eines zusammengesetzten Texts, steht unten ganz
  assert(!left.length, lits.size + ' Menü-/Dialogtexte auf Englisch' + (left.length ? ' – noch deutsch: ' + left.join(' | ') : ''));
  assert(en.T('Wirklich alle 3 EVE-Clients beenden?') === 'Really quit all 3 EVE clients?' && en.T('Strg+Umschalt+L') === 'Ctrl+Shift+L', 'zusammengesetzte Texte (Anzahl, Tastenkürzel)');
  assert(de.T('Beenden') === 'Beenden' && de.T('Wirklich alle 3 EVE-Clients beenden?') === 'Wirklich alle 3 EVE-Clients beenden?', 'Deutsch bleibt unverändert');
  const m = en.tMenu([{ label: 'Overlays', submenu: [{ label: 'Karte' }, { label: 'Uhr & Timer' }] }, { type: 'separator' }, { label: 'Beenden', sublabel: 'Strg+Q' }]);
  assert(m[0].submenu[0].label === 'Map' && m[0].submenu[1].label === 'Clock & timers' && m[2].label === 'Quit' && m[2].sublabel === 'Ctrl+Q' && m[1].type === 'separator', 'tMenu übersetzt auch Untermenüs und sublabel');
  const d = en.tDlg({ type: 'warning', buttons: ['Alle beenden', 'Abbrechen'], title: 'EVE Omni', message: 'Es läuft kein EVE-Client.' });
  assert(d.buttons[0] === 'Quit all' && d.buttons[1] === 'Cancel' && d.message === 'No EVE client is running.', 'tDlg übersetzt Knöpfe und Meldung');
  assert(env(undefined, 'de-DE').uiLang() === 'de' && env(undefined, 'en-GB').uiLang() === 'en' && env(undefined, 'fr').uiLang() === 'en' && env('de', 'en-US').uiLang() === 'de', 'ohne Meldung der Seite: Windows-Sprache (Deutsch → DE, sonst EN); gemeldete Sprache gewinnt');
  assert(/const allowed = \['lang', /.test(main), 'setSettings nimmt die Sprache an');
  assert(/try\{ const bft = Menu\.buildFromTemplate\.bind\(Menu\); Menu\.buildFromTemplate = tpl => bft\(tMenu\(tpl\)\)/.test(main), 'alle Menüs laufen über tMenu (abgesichert mit try)');
  // Overlays laden unter file:// nicht von selbst neu (kein storage-Ereignis zwischen Fenstern) → main.js muss sie beim Sprachwechsel neu laden
  assert(/if \('lang' in patch && before\.lang && S\.lang !== before\.lang\)\{[^\n]*satSpare\.destroy\(\);[^\n]*recreateSats/.test(main) && /lang: S\.lang \}/.test(main.replace(/const before = \{ transparent: S\.transparent, htmlPath: S\.htmlPath, lang: S\.lang \}/, 'lang: S.lang }')), 'Sprachwechsel lädt alle Overlay-Fenster und das Reservefenster neu');
  assert(/function satKey\(\)\{ return [^\n]*demoOn\(\) \+ '\|' \+ S\.lang; \}/.test(main) && (main.match(/__key [!=]== satKey\(\)/g) || []).length === 2, 'Reservefenster gilt nur für die Sprache, mit der es geladen wurde');
  const page = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
  assert(/HOSTL = window\.evecoreHost;[\s\S]{0,2000}HOSTL\.setSettings\(\{ lang: lang \}\)/.test(page) && !/window\.EVH && EVH\.setSettings && !\//.test(page), 'Seite meldet die Sprache über window.evecoreHost (nicht EVH – das gibt es dort noch nicht)');
  assert(/evecoreHost\.setSettings\(\{ lang: sel\.value \}\)\.then\(go, go\)/.test(page), 'Sprachwahl meldet den Wechsel an das Programm, bevor die Seite neu lädt');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
