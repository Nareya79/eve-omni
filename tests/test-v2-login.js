// V2 (03.10.2026): Login für alle – gemeinsame App (Standard-Client-ID + omni-Rücksprung), eigene Client-ID + eigene Rücksprung-Adresse,
// Refresh mit der am Token gespeicherten Client-ID, Migration alter Einträge, Erststart-Assistent nur bei leerem Zustand, Programm fängt beide Rücksprünge ab
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const DEF = '26b3d504aaa6443daed268d2cea52bc7', OMNI = 'https://omni.nareya79.com/callback.html', OLD = 'https://claude.ai/artifact/SCXYB3dGYr' + 'Vf9XaTZcQW7U';
const jwt = (id, name) => 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name, scp: [] })).toString('base64').replace(/=+$/, '') + '.y';
function mk(pre){
  const calls = [], opened = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ pre && pre(w.localStorage); Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto });
      w.open = u => { opened.push(String(u)); return {}; };
      w.fetch = (u, o) => { u = String(u);
        if (/oauth\/token/.test(u)){ calls.push(o.body); const id = /refresh_token=r2/.test(o.body) ? 2 : 1;
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: jwt(id, 'Pilot ' + id), refresh_token: 'r' + id, expires_in: 1200 }), text: () => Promise.resolve('') }); }
        return Promise.reject(new Error('offline')); }; } }).window;
  return { w, calls, opened };
}
(async () => {
  try{
    // 1) leerer Zustand: gemeinsame App, Assistent erscheint
    let { w, calls, opened } = mk();
    await tick(700);
    let d = w.document, T = w.__test;
    assert(T.ssoClient().id === DEF && T.ssoClient().redirect === OMNI, 'V2: ohne eigene Client-ID → gemeinsame App + omni-Rücksprung');
    assert(d.querySelector('.welcome'), 'V2: Erststart-Assistent bei leerem Zustand');
    d.querySelector('[data-wl="de"]').click(); await tick(); d.querySelector('[data-wl="play"]').click(); await tick(); d.querySelector('[data-wl="wz-std"]').click(); await tick();   // JJ6: Spielart; VV2: Schritt 3
    assert(/Mit EVE einloggen/.test(d.querySelector('.welcome').textContent), 'V2: nach der Sprache Schritt 2 (einloggen / umsehen)');
d.querySelector('[data-wl="login"]').click(); await tick(300);
    assert(!d.querySelector('.welcome') && opened.length === 1 && opened[0].includes('client_id=' + DEF) && opened[0].includes('redirect_uri=' + encodeURIComponent(OMNI)), 'V2: „Mit EVE einloggen“ → Login-URL mit Standard-ID und omni-Adresse');
    // callback.html-Format: ?code=…&state=… über „Code übernehmen“
    const st = w.sessionStorage.getItem('eve-sso-state');
    d.getElementById('sso-paste-url').value = OMNI + '?code=abc&state=' + st; d.getElementById('sso-paste-btn').onclick(); await tick(300);
    let toks = JSON.parse(w.localStorage.getItem('eve-zentrale-characters'));
    assert(calls[0].includes('code=abc') && calls[0].includes('client_id=' + DEF) && toks[0].client_id === DEF, 'V2: callback.html-Adresse wird gelesen, Token merkt sich die Client-ID');
    assert(w.localStorage.getItem('eve-zentrale-welcome-v1') === 'done' && !T.welcomeShow(), 'V2: Assistent danach nie wieder');
    w.close();

    // 2) eigene Client-ID (wie beim Nutzer): kein Assistent, eigene ID + eigene Adresse, alter Eintrag wird migriert
    ({ w, calls, opened } = mk(ls => { ls.setItem('eve-zentrale-client-id', '0123456789abcdef0123456789abcdef');
      ls.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r1', expires_at: 0, character_id: '1', character_name: 'Alt' },
        { access_token: 'b', refresh_token: 'r2', expires_at: 0, character_id: '2', character_name: 'Neu', client_id: DEF }])); }));
    await tick(700); d = w.document; T = w.__test;
    assert(!d.querySelector('.welcome'), 'V2: mit Charakter/eigener ID kein Assistent');
    assert(T.ssoClient().id === '0123456789abcdef0123456789abcdef' && T.ssoClient().redirect === OLD && d.getElementById('sso-redirect').value === OLD, 'V2: eigene ID + bisherige Rücksprung-Adresse vorbelegt');
    toks = T.loadAllTokens2();
    assert(toks[0].client_id === '0123456789abcdef0123456789abcdef' && toks[1].client_id === DEF, 'V2: Migration – alter Eintrag ohne client_id bekommt die eingetragene ID, andere bleiben');
    await T.getValidAccessTokenFor2('1'); await T.getValidAccessTokenFor2('2');
    const c1 = calls.filter(c => /refresh_token=r1/.test(c)), c2 = calls.filter(c => /refresh_token=r2/.test(c));
    assert(c1.length && c2.length && c1.every(c => c.includes('client_id=0123456789abcdef0123456789abcdef')) && c2.every(c => c.includes('client_id=' + DEF)), 'V2: Refresh nimmt je Charakter die gespeicherte Client-ID');
    d.getElementById('sso-login-btn').onclick(); await tick(300);
    assert(opened[0].includes('client_id=0123456789abcdef0123456789abcdef') && opened[0].includes('redirect_uri=' + encodeURIComponent(OLD)), 'V2: Login mit eigener ID + eigener Rücksprung-Adresse');
        // 13.10.: neue gemeinsame App – alter Login ohne client_id erneuert sich mit der ALTEN gemeinsamen ID, gespeicherte alte ID bleibt
    ({ w, calls, opened } = mk(ls => ls.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'x', refresh_token: 'r1', expires_at: 0, character_id: '1', character_name: 'Alt' },
      { access_token: 'y', refresh_token: 'r2', expires_at: 0, character_id: '2', character_name: 'Alt2', client_id: 'aa3a93ff84e84013967e34b5e35b5267' }]))));
    await tick(700); T = w.__test;
    await T.getValidAccessTokenFor2('1'); await T.getValidAccessTokenFor2('2');
    const r12 = calls.filter(c => /refresh_token=r[12]/.test(c));
    assert(r12.some(c => /r1/.test(c)) && r12.some(c => /r2/.test(c)) && r12.every(c => c.includes('client_id=aa3a93ff84e84013967e34b5e35b5267')), 'Neue App: alte Logins (mit und ohne gespeicherte ID) erneuern sich mit der alten gemeinsamen App');
    assert(T.ssoClient().id === DEF, 'neue Logins nutzen die neue gemeinsame App');
    w.close();

    // 3) Programm: beide Rücksprünge werden abgefangen
    const f = new Function(main.match(/const SSO_REDIRECTS = [^\n]*\nconst isSsoReturn = [^\n]*/)[0] + '\nreturn isSsoReturn;')();
    assert(f(OMNI + '?code=1&state=2') && f(OLD + '?code=1') && !f('https://login.eveonline.com/x'), 'V2: Programm fängt omni- und alte Rücksprung-Adresse ab');
    assert((main.match(/isSsoReturn\(/g) || []).length >= 2, 'V2: Login-Fenster und Zwischenablage nutzen beide Adressen');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
