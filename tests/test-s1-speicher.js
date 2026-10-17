// S1 (10.10.2026): Speicher-Netz – ist localStorage voll, gibt EVE Omni Zwischenspeicher frei (größte zuerst) und schreibt dann; echte Daten bleiben
const { JSDOM } = require('jsdom');
const html = require('fs').readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
setTimeout(() => {
  const w = dom.window, ls = w.localStorage;
  ls.setItem('eve-zentrale-haulruns-v1', '[]');   // echte Daten
  let i = 0; try{ for (; i < 400; i++) ls.setItem('s1-fuell-' + i, 'x'.repeat(50000)); }catch(e){}   // jsdom: 5 Mio. Zeichen – Rest füllen
  for (let j = 0; j < 12 && j < i; j++) ls.removeItem('s1-fuell-' + j);   // Platz für zwei Zwischenspeicher
  ls.setItem('eve-zentrale-mapsnap-v1', 'm'.repeat(300000)); ls.setItem('eve-zentrale-zkcache-v1', 'z'.repeat(200000));
  let err = '';
  try{ ls.setItem('eve-zentrale-trades-v1', 't'.repeat(250000)); }catch(e){ err = e.name; }
  assert(!err && ls.getItem('eve-zentrale-trades-v1').length === 250000, 'S1: voller Speicher – Trades trotzdem gespeichert (' + err + ')');
  assert(ls.getItem('eve-zentrale-mapsnap-v1') === null, 'S1: größter Zwischenspeicher freigegeben');
  assert(ls.getItem('eve-zentrale-haulruns-v1') === '[]', 'S1: echte Daten bleiben');
  let err2 = ''; try{ ls.setItem('eve-zentrale-trades-v1', 't'.repeat(4900000)); }catch(e){ err2 = e.name; }
  assert(err2 === 'QuotaExceededError', 'S1: passt es auch ohne Zwischenspeicher nicht, kommt der Fehler wie vorher');
  for (let j = 0; j < 400; j++) ls.removeItem('s1-fuell-' + j);
  const e = w.document.getElementById('dx-ls');
  assert(e && /^Speicher: [\d,]+ von 10 MB belegt \(\d+ %\)\./.test(e.textContent), 'S1: Speicherstand in Einstellungen › Konto (' + (e && e.textContent) + ')');
  assert(/Speicher: \(\[\\d,\]\+\) von \(\\d\+\) MB belegt/.test(html) && html.indexOf('"Storage: " + a.replace') > 0, 'S1: Text auf Englisch');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
}, 1500);
