// BE (23.10.2026): „Markt in EVE“ kam nach dem Start erst nach Minuten – Token-Erneuerung lief je ESI-Abfrage parallel und ohne Zeitlimit.
// Prüft die echten Funktionen aus der HTML: 10 gleichzeitige Aufrufe → 1 Erneuerung; hängender Login → Fehler nach Zeitlimit, Charakter bleibt;
// 400 vom Login (wirklich abgelaufen) → Charakter wird wie bisher entfernt; gültiges Token → keine Anfrage.
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const i = html.indexOf('  var tokRefreshing = {};'), j = html.indexOf('  async function esiAuthGetJson');
assert(i > 0 && j > i, 'getValidAccessTokenFor + tokRefresh in der HTML gefunden');
const code = html.slice(i, j);
assert(/signal: AbortSignal\.timeout\(15000\)/.test(code), 'Erneuerung hat ein Zeitlimit von 15 s');
let store = [], calls = 0, mode = 'ok', removed = [];
const jwt = (id, name) => 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name })).toString('base64') + '.y';
const env = {
  loadAllTokens: () => JSON.parse(JSON.stringify(store)), saveAllTokens: a => { store = a; },
  SSO_TOKEN_URL: 'https://login.example/token', SSO_OLD_SHARED_ID: 'alt',
  decodeJwtPayload: t => JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()),
  ssoSetStatus(){}, renderCharacterChips(){}, removeCharacter: id => { removed.push(String(id)); store = store.filter(t => String(t.character_id) !== String(id)); },
  AbortSignal: { timeout: ms => { const c = new AbortController(); setTimeout(() => c.abort(Object.assign(new Error('t'), { name: 'TimeoutError' })), mode === 'hang' ? 50 : ms); return c.signal; } },
  fetch: (u, o) => { calls++;
    if (mode === 'hang') return new Promise((res, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason)));
    if (mode === '400') return Promise.resolve({ ok: false, status: 400 });
    return new Promise(res => setTimeout(() => res({ ok: true, json: async () => ({ access_token: jwt(1001, 'Pilot Alpha'), refresh_token: 'r2', expires_in: 1200 }) }), 30)); },
};
const { getValidAccessTokenFor } = new Function(...Object.keys(env), code + ';return { getValidAccessTokenFor };')(...Object.values(env));
const reset = exp => { store = [{ character_id: '1001', character_name: 'Pilot Alpha', access_token: 'alt', refresh_token: 'r1', expires_at: exp, client_id: 'c' }]; calls = 0; removed = []; };
(async () => {
  try{
    reset(Date.now() + 60000);
    assert(await getValidAccessTokenFor(1001) === 'alt' && calls === 0, 'gültiges Token: keine Anfrage');
    reset(Date.now() - 1000); mode = 'ok';
    const r = await Promise.all(Array.from({ length: 10 }, () => getValidAccessTokenFor(1001)));
    assert(calls === 1, '10 gleichzeitige Aufrufe → genau 1 Erneuerung (vorher 10)');
    assert(r.every(x => x === r[0]) && store[0].refresh_token === 'r2', 'alle bekommen dasselbe neue Token, gespeichert');
    assert(await getValidAccessTokenFor(1001) === r[0] && calls === 1, 'danach gilt das neue Token ohne neue Anfrage');
    reset(Date.now() - 1000); mode = 'hang';
    let err = null; try{ await getValidAccessTokenFor(1001); }catch(e){ err = e; }
    assert(err && /Zeitüberschreitung/.test(err.message), 'hängender Login → Fehler „Zeitüberschreitung“ statt endlos warten');
    assert(!removed.length && store.length === 1, 'Zeitüberschreitung: Charakter bleibt eingeloggt');
    mode = 'ok'; calls = 0;
    assert(typeof await getValidAccessTokenFor(1001) === 'string' && calls === 1, 'nächster Versuch erneuert wieder (nichts hängt fest)');
    reset(Date.now() - 1000); mode = '400';
    assert(await getValidAccessTokenFor(1001) === null && removed[0] === '1001', 'Login sagt 400 (wirklich abgelaufen) → Charakter entfernt wie bisher');
    assert(await getValidAccessTokenFor(999) === null, 'unbekannter Charakter → null');
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e.message); process.exitCode = 1; }
})();
