// CC4 (01.10.2026): Kurieraufträge in der Watchlist – „＋ Merken“ im Scanner, gemerkte werden „angenommen“, sobald EVE sie meldet,
// angenommene und selbst ausgestellte kommen von selbst dazu, Status/Frist/Belohnung, → EVE / Ziel / ✕, Seite + Overlay, Art-Filter „Kurier“
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JWT = scopes => 'x.' + Buffer.from(JSON.stringify({ scp: scopes })).toString('base64') + '.y';
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: k => /x-pages/i.test(k) ? '1' : null }, json: () => Promise.resolve(x) });
const C = (id, o) => Object.assign({ contract_id: id, type: 'courier', issuer_id: 999, acceptor_id: 0, status: 'outstanding', start_location_id: 60003760, end_location_id: 60008494,
  reward: 10e6, collateral: 200e6, volume: 12000, days_to_complete: 3, date_issued: iso(now - 864e5), date_expired: iso(now + 5 * 864e5) }, o);
let contracts = [
  C(1, { acceptor_id: 111, status: 'in_progress', date_accepted: iso(now - 3600e3) }),             // ich fliege
  C(2, { issuer_id: 111, status: 'outstanding', reward: 25e6 }),                                      // selbst ausgestellt
  C(3, { acceptor_id: 111, status: 'finished', date_accepted: iso(now - 3 * 864e5), date_completed: iso(now - 2 * 864e5) }),
  { contract_id: 4, type: 'item_exchange', issuer_id: 111, status: 'outstanding' },
  C(5, { acceptor_id: 111, status: 'in_progress', date_accepted: iso(now - 600e3), reward: 7e6 })   // war gemerkt
];
const posts = [];
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
    { access_token: JWT(['esi-contracts.read_character_contracts.v1', 'esi-ui.open_window.v1', 'esi-ui.write_waypoint.v1']), refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]));
  x.localStorage.setItem('eve-zentrale-kurier-v1', JSON.stringify([
    { id: 5, src: 'merk', st: 'gemerkt', from: 'Jita IV - Moon 4', to: 'Amarr VIII', fl: 60003760, tl: 60008494, rew: 7e6, col: 1e8, vol: 5000, days: 3, exp: now + 864e5, t: now - 7200e3 },
    { id: 6, src: 'merk', st: 'gemerkt', from: 'Dodixie', to: 'Rens', fl: 1, tl: 2, rew: 1e6, col: 0, vol: 100, days: 1, exp: now - 60e3, t: now - 864e5 }]));
  x.fetch = (u, o) => { u = String(u); let m;
    if (/characters\/111\/contracts\//.test(u)) return json(contracts);
    if ((m = /universe\/stations\/(\d+)/.exec(u))) return json({ name: m[1] === '60003760' ? 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' : 'Amarr VIII (Oris) - Emperor Family Academy', system_id: 30000142 });
    if (/ui\/(openwindow|autopilot)/.test(u)){ posts.push(u); return Promise.resolve({ ok: true, status: 204, headers: { get: () => null }, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); }
    return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    await T.ckSync(true);
    const L = T.ckLoad(), by = id => L.find(x => String(x.id) === String(id));
    assert(by(1) && by(1).src === 'acc' && by(1).st === 'angenommen' && by(1).due > now && /Jita/.test(by(1).from) && /Amarr/.test(by(1).to), 'CC4: angenommener Kurier kommt von selbst (ich fliege, Frist, Orte aus EVE)');
    assert(by(2) && by(2).src === 'own' && by(2).st === 'offen', 'CC4: selbst ausgestellter Kurier kommt dazu (eigene Art)');
    assert(by(3) && by(3).st === 'abgeliefert' && by(3).end, 'CC4: abgelieferter Kurier mit Zeitpunkt');
    assert(!by(4), 'CC4: andere Vertragsarten bleiben draußen');
    assert(by(5).src === 'acc' && by(5).st === 'angenommen' && by(5).from === 'Jita IV - Moon 4', 'CC4: gemerkter Kurier wird „angenommen“, sobald EVE ihn meldet (Name bleibt)');
    assert(by(6).st === 'abgelaufen', 'CC4: gemerkter, nicht angenommener Kurier nach Ablauf „abgelaufen“');
    // Watchlist-Seite
    T.trkRender(); const body = d.getElementById('trk-body');
    let rows = body.querySelectorAll('.trk-ck');
    assert(rows.length === 3 && /Kurier/.test(body.textContent) && /fliege ich/.test(body.textContent) && /ausgestellt/.test(body.textContent) && /Frist/.test(body.textContent), 'CC4: Watchlist › Aktiv zeigt 3 Kurierverträge mit Art, Status und Frist');
    // Art-Filter „nur Kurier“ blendet Trades/Läufe aus und zeigt trotzdem die Kuriere
    T.trkSetKind('Kurier'); T.trkRender();
    assert(body.querySelectorAll('.trk-ck').length === 3 && d.getElementById('trk-kind').value === 'Kurier', 'CC4: Art „nur Kurier“');
    // Overlay
    const ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
    assert(ob.querySelectorAll('.trk-ck').length === 3 && ob.querySelector('[data-ova="trkKind"][data-arg="Kurier"][aria-pressed="true"]') && ob.querySelector('[data-ova="ckEve"][data-arg="1"]') && ob.querySelector('[data-ova="ckDest"][data-arg="1"]'), 'CC4: Watchlist-Overlay mit Kurier-Gruppe, → EVE und Ziel');
    // → EVE / Ziel (angenommen → Ziel des Vertrags)
    T.ovSatAction('track', { type: 'ckEve', arg: '1' }); await tick(100);
    T.ovSatAction('track', { type: 'ckDest', arg: '1' }); await tick(100);
    assert(posts.some(u => /openwindow\/contract\/\?contract_id=1/.test(u)) && posts.some(u => /autopilot\/waypoint.*destination_id=60008494/.test(u)), 'CC4: → EVE öffnet den Vertrag, Ziel setzt das Vertragsziel: ' + posts.join(' | '));
    // ✕: automatische nur ausblenden (kommen beim nächsten Abgleich nicht wieder), gemerkte löschen
    T.ckAction({ type: 'ckDel', arg: '2' }); await T.ckSync(true);
    assert(T.ckLoad().find(x => x.id === 2).hid && !d.querySelector('#trk-body [data-ckrow="2"]'), 'CC4: ✕ blendet einen automatischen Kurier dauerhaft aus');
    // Erledigt-Ansicht
    d.querySelector('[data-trk="done"]').click(); await tick(20);
    assert(body.querySelectorAll('.trk-ck').length === 1 && /abgeliefert/.test(body.textContent), 'CC4: Erledigt zeigt den abgelieferten Kurier');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.stack || e.message); process.exit(1); }
  process.exit(0);
})();
