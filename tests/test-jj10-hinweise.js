// JJ10: „Was ist das?“-Hinweis beim ersten Oeffnen einer Seite, wegklickbar, zuruecksetzbar, alle Texte mit Englisch
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window, d = w.document;
setTimeout(() => { try{
  const h = () => d.getElementById('jj-hint');
  assert(h() && h().getAttribute('data-hint') === 'station' && h().parentNode.id === 'panel-station', 'Start: Hinweis oben auf der ersten Seite');
  d.getElementById('neo-btn-wallet').click();
  assert(h() && h().getAttribute('data-hint') === 'wallet' && d.querySelectorAll('.jj-hint').length === 1, 'Seitenwechsel: Hinweis der neuen Seite, nur einer');
  h().querySelector('button').click();
  assert(!h() && JSON.parse(w.localStorage.getItem('eve-zentrale-hints-v1')).wallet === 1, 'Verstanden: weg und gemerkt');
  d.getElementById('neo-btn-station').click(); d.getElementById('neo-btn-wallet').click();
  assert(!h(), 'Weggeklickt bleibt weg');
  d.getElementById('hint-reset').click();
  assert(h() && h().getAttribute('data-hint') === 'wallet', 'Alle Hinweise wieder zeigen');
  const keys = JSON.parse(/HINTS = (\{.*?\});/.exec(html)[1]);
  const en = JSON.parse(fs.readFileSync(require('path').join(process.env.EVEOMNI_ROOT || require('path').resolve(__dirname, '..'), 'Programm-Quellcode/i18n-en-4073-9.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert(Object.keys(keys).length >= 20 && Object.values(keys).every(t => html.includes(JSON.stringify(t) + ': ' + JSON.stringify(en[t]))), 'Alle ' + Object.keys(keys).length + ' Hinweise haben einen ganzen englischen Satz im Wörterbuch');
  console.log('\nALL JJ10 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } }, 600);
