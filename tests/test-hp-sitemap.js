// Homepage-Regeln für Google (26.10.2026): sitemap.xml gültig, keine noindex-Seite darin, lastmod der Startseite nicht älter als index.html
const fs = require('fs'), path = require('path');
const H = (process.env.EVEOMNI_ROOT || '/dev/null') + '/EVE-Omni-Homepage';   // im Repo/CI gibt es die Homepage nicht
let ok = 0, bad = 0;
function assert(c, m) { if (c) { ok++; console.log('OK ' + m); } else { bad++; console.log('FEHLER ' + m); } }
if (fs.existsSync(H + '/sitemap.xml')) {
  const sm = fs.readFileSync(H + '/sitemap.xml', 'utf-8');
  assert(/^<\?xml [^>]*\?>\s*<urlset [^>]*>[\s\S]*<\/urlset>\s*$/.test(sm) && (sm.match(/<url>/g) || []).length === (sm.match(/<\/url>/g) || []).length && (sm.match(/<loc>/g) || []).length === (sm.match(/<\/loc>/g) || []).length, 'sitemap.xml ist gültiges XML (urlset, Tags paarweise)');
  const locs = [...sm.matchAll(/<loc>https:\/\/omni\.nareya79\.com\/([^<]*)<\/loc>/g)].map(m => m[1] || 'index.html');
  const noidx = locs.filter(f => fs.existsSync(H + '/' + f) && /<meta name="robots" content="noindex/.test(fs.readFileSync(H + '/' + f, 'utf-8')));
  assert(noidx.length === 0, 'keine noindex-Seite in der Sitemap' + (noidx.length ? ': ' + noidx.join(', ') : ''));
  const lm = (sm.match(/<loc>https:\/\/omni\.nareya79\.com\/<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/) || [])[1];
  const t = fs.statSync(H + '/index.html').mtime, ix = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  assert(lm && lm >= ix, 'lastmod der Startseite (' + lm + ') nicht älter als index.html (' + ix + ')');
} else console.log('OK keine Homepage im Ordner – übersprungen');
console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
