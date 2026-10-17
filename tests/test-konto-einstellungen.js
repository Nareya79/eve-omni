// Konto in Einstellungen › Konto, kein OmniCom-Symbol mehr; Liste der eingeloggten Charaktere nach Account (Zuordnung von Hand)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const jwt = (id, name, scp) => 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name, scp })).toString('base64url') + '.y';
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
    const all = ['esi-skills.read_skills.v1'];
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
      { access_token: jwt(111, 'Pilot Eins', all), refresh_token: 'r', expires_at: Date.now() + 1e9, character_id: '111', character_name: 'Pilot Eins' },
      { access_token: jwt(222, 'Pilot Zwei', all), refresh_token: 'r', expires_at: Date.now() + 1e9, character_id: '222', character_name: 'Pilot Zwei' }]));
    w.localStorage.setItem('eve-zentrale-acct-v1', JSON.stringify({ 111: 'Main' }));
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window, d = w.document, $ = id => d.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms || 100));
(async () => { try{
  await tick(700);
  assert(w.getComputedStyle($('neo-btn-account')).display === 'none' && !/data-neo="account"/.test(w.__test.neoOverlayHtml ? w.__test.neoOverlayHtml() : ''), 'Kein Konto-Symbol in der Leiste und im OmniCom-Overlay');
  assert(d.querySelector('[data-set=chars]').textContent === 'Konto' && $('set-pane-chars').contains($('sso-login-box')) && $('set-pane-chars').contains($('skills-panel')), 'Einstellungen › Konto enthält Login und Handelsskills');
  const cards = [...d.querySelectorAll('#acct-list .acct-card')];
  assert(cards.length === 2 && /^Main/.test(cards[0].textContent) && /1 von 3 Plätzen/.test(cards[0].textContent) && /Pilot Eins/.test(cards[0].textContent), 'Account „Main“ mit Pilot Eins');
  assert(/^Ohne Account/.test(cards[1].textContent) && /Pilot Zwei/.test(cards[1].textContent), 'Pilot Zwei ohne Account');
  assert(/neu einloggen \(\d+ Berechtigungen fehlen\)/.test(cards[0].textContent), 'Fehlende Berechtigungen werden angezeigt');
  const inp = d.querySelector('[data-acct="222"]'); inp.value = 'Main'; inp.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  const c2 = [...d.querySelectorAll('#acct-list .acct-card')];
  assert(c2.length === 1 && /2 von 3 Plätzen/.test(c2[0].textContent) && JSON.parse(w.localStorage.getItem('eve-zentrale-acct-v1'))['222'] === 'Main', 'Zuordnung wird gemerkt, beide unter „Main“');
  assert(/Handelscharakter/.test(c2[0].textContent), 'Rolle Handelscharakter steht am Charakter');
  $('neo-btn-account').onclick(); await tick(30);
  assert($('panel-settings').classList.contains('active') && !$('set-pane-chars').hidden, 'Alter Konto-Aufruf landet in Einstellungen › Konto');
  console.log('\nALL KONTO TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } })();
