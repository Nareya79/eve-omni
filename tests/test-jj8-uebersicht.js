// JJ8: Übersicht mit 6 Kacheln – Startseite nur bei Neuinstallation, Klick = passende Seite, auch als Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const mk = pre => new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ pre(w); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
const neu = mk(w => w.localStorage.setItem('eve-zentrale-welcome-v1', 'lang')), alt = mk(w => w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'));
setTimeout(() => { try{
  const d = neu.document, act = id => d.getElementById(id).classList.contains('active');
  assert(!act('panel-home'), 'Vor der Spielart-Wahl: noch keine Übersicht');
  d.querySelector('.welcome [data-wl=play]').click();
  assert(act('panel-home') && neu.localStorage.getItem('eve-zentrale-home-start-v1') === '1', 'Neuinstallation: Übersicht ist Startseite');
  const t = [...d.querySelectorAll('#home-page .home-t')].map(b => b.getAttribute('data-arg'));
  assert(t.join() === 'wallet,track,skills,pi,alarm,uhr', '6 Kacheln: Wallet, Trades, Skills, Planeten, Intel, Timer');
  d.querySelector('.home-welcome, .welcome') && d.querySelectorAll('.welcome').forEach(x => x.remove());
  d.querySelector('#home-page [data-arg=wallet]').click();
  assert(act('panel-wallet') && !act('panel-home'), 'Klick auf Wallet-Kachel öffnet Wallet');
  d.querySelector('#home-page') && d.getElementById('neo-btn-home').click(); d.querySelector('#home-page [data-arg=skills]').click();
  assert(act('panel-skills'), 'Klick auf Skills-Kachel öffnet Skills');
  assert(!alt.document.getElementById('panel-home').classList.contains('active') && alt.document.getElementById('panel-station').classList.contains('active'), 'Bestandsnutzer: Start bleibt Trading');
  assert(!/home: "Übersicht"/.test(html) && !/else if \(id === "home"\)/.test(html), '09.10.: Übersicht hat kein Overlay mehr (nur große Seite)');
  const en = JSON.parse(fs.readFileSync(require('path').join(process.env.EVEOMNI_ROOT || require('path').resolve(__dirname, '..'), 'Programm-Quellcode/i18n-en-4073-11.json'), 'utf8'));
  assert(Object.keys(en).every(k => html.includes(JSON.stringify(k) + ': ')), 'Alle neuen Texte im englischen Wörterbuch');
  console.log('\nALL JJ8 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } }, 800);
