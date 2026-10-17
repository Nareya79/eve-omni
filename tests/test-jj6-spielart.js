// JJ6: Erststart „Was spielst du hauptsächlich?“ – gewählte Gruppen oben + offen, Rest eingeklappt; Knopf in Einstellungen › OmniCom
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window, d = w.document;
const grp = () => JSON.parse(w.localStorage.getItem('eve-zentrale-neocom-groups-v1') || '{}');
const firstGroups = () => [...d.querySelectorAll('#neocom > .neo-grp:not([hidden])')].map(h => h.getAttribute('data-neo-grp'));
setTimeout(() => { try{
  d.querySelector('.welcome [data-wl=de]').click();
  const box = d.querySelector('.welcome');
  assert(box && box.querySelectorAll('[data-play]').length === 6, 'Nach der Sprache: Frage mit 6 Spielarten');
  box.querySelector('[data-play=mine]').checked = true; box.querySelector('[data-play=pvp]').checked = true;
  box.querySelector('[data-wl=play]').click();
  assert(grp().fold.sort().join() === 'handel,misc', 'Mining + PvP: Handel und Sonstiges eingeklappt, Charaktere offen');
  assert(firstGroups().slice(0, 3).join() === 'besitz,nav,chars', 'Gewählte Gruppen stehen oben, dann Charaktere');
  assert(w.localStorage.getItem('eve-zentrale-welcome-v1') === 'play' && d.querySelector('.welcome [data-wl=wz-ok]'), 'VV2: danach Schritt 3 (Overlays, Alarme, Farbe)');
    d.querySelector('.welcome [data-wl=wz-std]').click();
    assert(w.localStorage.getItem('eve-zentrale-welcome-v1') === 'setup' && d.querySelector('.welcome [data-wl=login]'), 'Danach Login-Schritt');
  d.querySelector('.welcome [data-wl=skip]') && d.querySelector('.welcome').remove();
  d.getElementById('setup-again').click(); d.querySelector('.welcome [data-wl=de]').click();   // VV2: Spielart neu wählen = Einrichtung erneut starten
  const b2 = d.querySelector('.welcome');
  b2.querySelector('[data-play=all]').checked = true; b2.querySelector('[data-wl=play]').click();
  assert(!grp().fold.length && d.querySelector('.welcome [data-wl=wz-ok]'), 'Einrichtung erneut: „Alles“ klappt alles auf, weiter mit Schritt 3');
  const en = JSON.parse(fs.readFileSync(require('path').join(process.env.EVEOMNI_ROOT || require('path').resolve(__dirname, '..'), 'Programm-Quellcode/i18n-en-4073-11.json'), 'utf8'));
  assert(Object.keys(en).every(k => html.includes(JSON.stringify(k) + ': ')), 'Alle neuen Texte im englischen Wörterbuch');
  console.log('\nALL JJ6 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } }, 600);
