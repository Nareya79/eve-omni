// Login ohne Mail-Berechtigungen (12.10.2026, GitHub #1/#2): Der normale Login fragt die drei Mail-Berechtigungen nicht an
// (in der gemeinsamen Developer-App nicht freigeschaltet → EVE brach mit invalid_scope ab). „Mail aktivieren“ fragt sie extra an;
// lehnt EVE das ab, kommt eine verständliche deutsche Meldung statt der rohen EVE-Meldung.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
let ok = 0, bad = 0;
function assert(c, m){ if (c){ ok++; console.log('OK:', m); } else { bad++; console.log('FAIL:', m); } }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const MAIL = ['esi-mail.read_mail.v1', 'esi-mail.send_mail.v1', 'esi-mail.organize_mail.v1'];
const jwt = (id, name, scp) => 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name, scp })).toString('base64').replace(/=+$/, '') + '.y';
const scopesOf = u => decodeURIComponent((/[?&]scope=([^&]*)/.exec(u) || [])[1] || '').split(' ');
(async () => {
  const opened = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
      Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto });
      w.open = u => { opened.push(String(u)); return {}; };
      w.fetch = (u, o) => {
        u = String(u);
        if (/oauth\/token/.test(u)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: jwt(7, 'Pilot Sieben', w.__scp || []), refresh_token: 'r7', expires_in: 1200 }), text: () => Promise.resolve('') });
        return Promise.reject(new Error('offline'));
      };
    } }).window;
  await tick(700);
  const d = w.document, T = w.__test, status = () => d.getElementById('sso-status').textContent;
  // 1) normaler Login: keine Mail-Berechtigung in der Anfrage, alles andere wie bisher
  d.getElementById('sso-login-btn').onclick(); await tick(300);
  const sc = scopesOf(opened[0] || '');
  assert(opened.length === 1 && sc.length >= 20 && sc.includes('esi-skills.read_skills.v1') && sc.includes('esi-industry.read_corporation_mining.v1'), 'normaler Login fragt die freigeschalteten Berechtigungen an (' + sc.length + ')');
  assert(!sc.some(s => /^esi-mail\./.test(s)), 'normaler Login fragt KEINE Mail-Berechtigung an');
  // EVE lehnt trotzdem ab (z. B. eigene Client-ID ohne Freischaltung): verständliche Meldung
  d.getElementById('sso-paste-url').value = 'https://omni.nareya79.com/callback.html?error=invalid_scope&error_description=The+requested+scope+is+invalid'; d.getElementById('sso-paste-btn').onclick(); await tick();
  assert(/Login abgelehnt: EVE kennt eine der angefragten Berechtigungen nicht/.test(status()) && !/invalid_scope|requested scope/.test(status()), 'invalid_scope beim normalen Login: deutsche Meldung ohne rohe EVE-Meldung');
  // Login klappt ohne Mail-Berechtigungen: Konto zeigt „Login ok“ (fehlende Mail zählt dort nicht)
  w.__scp = sc; const st = w.sessionStorage.getItem('eve-sso-state');
  d.getElementById('sso-paste-url').value = 'https://omni.nareya79.com/callback.html?code=abc&state=' + st; d.getElementById('sso-paste-btn').onclick(); await tick(300);
  const toks = JSON.parse(w.localStorage.getItem('eve-zentrale-characters') || '[]');
  assert(toks.length === 1 && /eingeloggt/.test(status()), 'Login ohne Mail-Berechtigungen gelingt');
  T.switchTab('settings'); await tick(150);
  const acct = d.getElementById('set-pane-chars').textContent;
  assert(/Login ok/.test(acct) && !/Berechtigungen fehlen/.test(acct), 'Konto: „Login ok“, fehlende Mail zählt nicht als fehlende Berechtigung');
  // 2) Mail-Seite: Hinweis mit Knopf „Mail aktivieren“ – auch im Overlay
  const ob = d.createElement('div'); T.ovRenderMail(ob);
  const btn = ob.querySelector('.em-miss [data-ova="emLogin"]');
  assert(btn && /Mail aktivieren/.test(btn.textContent) && /Pilot Sieben/.test(ob.querySelector('.em-miss').textContent), 'Mail-Overlay: Hinweis mit Knopf „Mail aktivieren“');
  await T.emAction({ type: 'emLogin' }); await tick(300);
  const ms = scopesOf(opened[1] || '');
  assert(opened.length === 2 && MAIL.every(s => ms.includes(s)) && ms.includes('esi-skills.read_skills.v1'), '„Mail aktivieren“ fragt die drei Mail-Berechtigungen zusätzlich an');
  assert(!d.getElementById('set-pane-chars').hidden, 'dabei sind die Einstellungen › Konto (mit Statuszeile) offen');
  d.getElementById('sso-paste-url').value = 'https://omni.nareya79.com/callback.html?error=invalid_scope&error_description=The+requested+scope+is+invalid'; d.getElementById('sso-paste-btn').onclick(); await tick();
  assert(/Mail konnte nicht aktiviert werden: EVE hat die Mail-Berechtigungen abgelehnt/.test(status()) && /funktioniert normal weiter/.test(status()) && !/invalid_scope/.test(status()), 'invalid_scope bei „Mail aktivieren“: deutsche Meldung, Rest läuft weiter');
  assert(JSON.parse(w.localStorage.getItem('eve-zentrale-characters')).length === 1, 'bestehender Login bleibt erhalten');
  // danach wieder normaler Login: wieder ohne Mail
  d.getElementById('sso-login-btn').onclick(); await tick(300);
  assert(!scopesOf(opened[2] || '').some(s => /^esi-mail\./.test(s)), 'nächster normaler Login wieder ohne Mail-Berechtigungen');
  d.getElementById('sso-paste-url').value = 'https://omni.nareya79.com/callback.html?error=access_denied'; d.getElementById('sso-paste-btn').onclick(); await tick();
  assert(/nicht bestätigt/.test(status()), 'abgebrochen: verständliche Meldung');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})().catch(e => { console.error(e); console.log('FAILED'); process.exit(1); });
