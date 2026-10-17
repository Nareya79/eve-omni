// 13.10.2026 (Discord): Nutzer tippte den Charakternamen ins Feld „Eigene Client-ID“ → EVE: „Client could not be found“.
// Jetzt: Felder der eigenen App eingeklappt, Fokus auf dem Login-Knopf, nur echte IDs (32 Hex) gehen an EVE, alte falsche ID wird entfernt.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
let ok = 0, bad = 0;
function assert(c, m){ if (c){ ok++; console.log('OK:', m); } else { bad++; console.log('FAIL:', m); } }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const DEF = '26b3d504aaa6443daed268d2cea52bc7';
function mk(pre){
  const opened = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); pre && pre(w.localStorage);
      Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto }); w.open = u => { opened.push(String(u)); return {}; }; w.fetch = () => Promise.reject(new Error('offline')); } }).window;
  return { w, opened };
}
(async () => {
  // 1) frisch: eigene-App-Felder versteckt, Knopf zum Aufklappen da
  let { w, opened } = mk(); await tick(700); let d = w.document;
  assert(d.getElementById('sso-clientid-field').hidden && d.getElementById('sso-redirect-field').hidden && !d.getElementById('sso-own-toggle').hidden, 'Felder der eigenen App eingeklappt, Knopf „Eigene Developer-App …“ sichtbar');
  // 2) Name ins Feld getippt → kein Login, deutlicher Hinweis, nichts gespeichert
  d.getElementById('sso-own-toggle').onclick(); d.getElementById('sso-client-id').value = 'Agate West';
  await d.getElementById('sso-login-btn').onclick(); await tick(200);
  assert(opened.length === 0, 'mit Charakternamen im Feld wird KEIN Login geöffnet');
  assert(/bitte leer lassen/.test(d.getElementById('sso-status').textContent) && /nicht der Charaktername/.test(d.getElementById('sso-status').textContent), 'Hinweis: Feld leer lassen, nicht der Charaktername');
  assert(!w.localStorage.getItem('eve-zentrale-client-id'), 'falscher Wert wird nicht gespeichert');
  // 3) Feld leer → gemeinsame App
  d.getElementById('sso-client-id').value = ''; await d.getElementById('sso-login-btn').onclick(); await tick(200);
  assert(opened.length === 1 && opened[0].includes('client_id=' + DEF), 'leer → Login mit der gemeinsamen App');
  // EVE meldet „Client could not be found“ → verständlich
  d.getElementById('sso-paste-url').value = 'https://omni.nareya79.com/callback.html?error=invalid_request&error_description=Client+could+not+be+found.'; d.getElementById('sso-paste-btn').onclick(); await tick();
  assert(/EVE kennt die eingetragene Client-ID nicht/.test(d.getElementById('sso-status').textContent), '„Client could not be found“ → deutsche Erklärung');
  w.close();
  // 4) früher gespeicherter Name als Client-ID wird beim Start entfernt; echte ID bleibt und zeigt die Felder
  ({ w, opened } = mk(ls => ls.setItem('eve-zentrale-client-id', 'Agate West'))); await tick(700); d = w.document;
  assert(!w.localStorage.getItem('eve-zentrale-client-id') && w.__test.ssoClient().id === DEF && d.getElementById('sso-client-id').value === '', 'gespeicherter Charaktername als Client-ID wird beim Start entfernt');
  w.close();
  const OWN = '0123456789abcdef0123456789abcdef';
  ({ w, opened } = mk(ls => ls.setItem('eve-zentrale-client-id', OWN))); await tick(700); d = w.document;
  assert(w.__test.ssoClient().id === OWN && !d.getElementById('sso-clientid-field').hidden && d.getElementById('sso-client-id').value === OWN, 'echte eigene ID bleibt, Felder sichtbar');
  w.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})().catch(e => { console.error(e); console.log('FAILED'); process.exit(1); });
