// X7 (27.09.2026): Industrie-Overlay (Jobs mit Restzeit/Balken, fertige oben) + Blaupausen wie im EVE-Industriefenster;
// Assets: Struktur-Orte ueber andere Charaktere aufloesen, Ort ohne System zeigt "?" statt ewig "…"
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), H = 3600000;
function jwt(scopes, id){ const b = s => Buffer.from(JSON.stringify(s)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b({ alg: 'none' }) + '.' + b({ scp: scopes, sub: 'CHARACTER:EVE:' + id }) + '.x'; }
const CHARS = [
  { access_token: jwt(['esi-universe.read_structures.v1'], 111), refresh_token: 'r', expires_at: NOW + H, character_id: '111', character_name: 'Orvan' },
  { access_token: jwt(['esi-universe.read_structures.v1'], 222), refresh_token: 'r', expires_at: NOW + H, character_id: '222', character_name: 'Builder' }
];
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const ASSETS = { v: 0, v2: 1, n: 1, g: [{ cid: '111', name: 'Orvan', locs: [{ id: '1000000000001', name: 'Unbekannter Ort', sys: null, st: null, rows: [{ tid: 34, name: 'Tritanium', qty: 5, estValue: null, vol: 0.05 }] }] }] };
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.localStorage.setItem('eve-zentrale-listcache-v1', JSON.stringify({ assets: { t: NOW, d: ASSETS } }));
    w.fetch = (u, o) => { u = String(u); const auth = JSON.stringify((o && o.headers) || {});
      if (/universe\/structures\/1035000000001/.test(u)) return auth.indexOf(CHARS[1].access_token) >= 0 ? json({ name: 'Perimeter - Tranquility Trading Tower', solar_system_id: 30000144, type_id: 35833 }) : Promise.resolve({ ok: false, status: 403, headers: { get: () => null }, json: () => Promise.resolve({ error: 'Forbidden' }) });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    // Assets-Fix
    const ab = d.createElement('div'); T.ovRenderViewInto('assets', ab);
    assert(ab.querySelector('.as-j') && ab.querySelector('.as-j').textContent === '?', 'Assets: Ort ohne System zeigt ? statt …');
    const hd = [...ab.querySelectorAll('.as-hd span')].map(x => x.className).join(' ');
    assert(hd === 'sec sy stn n v m j', 'Assets: Kopfzeile hat dieselben Spalten-Klassen wie die Zeilen (Overlay blendet System/m³ in beiden aus): ' + hd);
    const nm = await T.resolveLocationName('1035000000001', true, '111');
    assert(nm === 'Perimeter - Tranquility Trading Tower', 'Assets: Struktur über zweiten Charakter aufgelöst (Besitzer hat keinen Zugriff)');
    // Registrierung
    assert(/industrie: "Industrie"/.test(d.documentElement.innerHTML) && /industry: "industrie"/.test(d.documentElement.innerHTML), 'X7: Ansicht registriert (OV_VIEWS + OmniCom)');
    // Daten
    T.inStore({
      sl: { 111: { n: 'Orvan', m: 6, r: 8, x: 0 }, 222: { n: 'Builder', m: 11, r: 1, x: 3 } },
      jobs: [
        { c: '111', cn: 'Orvan', a: 1, bp: 691, bpn: 'Rifter Blueprint', pn: 'Rifter', r: 10, s: NOW - H, e: NOW + 3 * H, st: 'active' },
        { c: '111', cn: 'Orvan', a: 4, bp: 692, bpn: 'Slasher Blueprint', pn: null, r: 1, s: NOW - 2 * H, e: NOW - 60000, st: 'active' },
        { c: '222', cn: 'Builder', a: 9, bp: 46166, bpn: 'Ferrogel Reaction Formula', pn: 'Ferrogel', r: 5, s: NOW, e: NOW + H, st: 'active' }
      ],
      bps: [
        { i: '1', c: '111', cn: 'Orvan', t: 691, n: 'Rifter Blueprint', g: 'Frigate Blueprint', q: -1, me: 10, te: 20, r: -1, loc: 'Jita IV - Moon 4', sys: null },
        { i: '2', c: '222', cn: 'Builder', t: 691, n: 'Rifter Blueprint', g: 'Frigate Blueprint', q: -2, me: 2, te: 4, r: 10, loc: 'Amarr VIII', sys: null },
        { i: '3', c: '222', cn: 'Builder', t: 46166, n: 'Ferrogel Reaction Formula', g: 'Composite Reaction Formulas', q: -1, me: 0, te: 0, r: -1, loc: 'Amarr VIII', sys: null }
      ]
    });
    const R = () => { const b = d.createElement('div'); T.ovRenderViewInto('industrie', b); return b; };
    T.inAction({ type: 'inTab', arg: 'jobs' });
    let b = R();
    const jobs = [...b.querySelectorAll('.in-j')];
    assert(jobs.length === 3 && jobs[0].classList.contains('ready') && /Slasher Blueprint/.test(jobs[0].textContent) && /fertig/.test(jobs[0].textContent), 'X7: fertiger Job oben und hervorgehoben');
    assert(/Ferrogel/.test(jobs[1].textContent) && /Rifter/.test(jobs[2].textContent) && jobs[2].querySelector('[data-ov-until]'), 'X7: laufende Jobs nach Restzeit, Countdown');
    const w2 = parseFloat(jobs[2].querySelector('.ov-bar-mini span').style.width);
    assert(w2 >= 24 && w2 <= 26, 'X7: Fortschrittsbalken 1 von 4 Std ≈ 25 %: ' + w2);
    assert(/\/bp\?size=32/.test(jobs[0].querySelector('img:not(.in-ow)').src), 'X7: Blaupausen-Icon aus dem EVE-Bildserver');
    const sl = [...b.querySelectorAll('.in-sl')].map(x => x.textContent);
    assert(sl.length === 2 && /Orvan.*Produktion 1\/6.*Forschung 1\/8/.test(sl[0]) && !/Reaktionen/.test(sl[0]) && /Builder.*Reaktionen 1\/3/.test(sl[1]), 'X7: Slots je Charakter wie im EVE-Kopf: ' + sl.join(' | '));
    T.inAction({ type: 'inOwn', arg: '222' });
    b = R();
    assert(b.querySelectorAll('.in-j').length === 1 && b.querySelectorAll('.in-sl').length === 1, 'X7: Filter Charakter');
    T.inAction({ type: 'inOwn', arg: 'all' });
    // Blaupausen
    T.inAction({ type: 'inTab', arg: 'bp' });
    b = R();
    let rows = [...b.querySelectorAll('.in-b')];
    assert(rows.length === 3 && /Ferrogel/.test(rows[0].textContent) && /\/bpc\?/.test(rows[2].querySelector('img:not(.in-ow)').src), 'X7: Blaupausen nach Name, Original vor Kopie');
    assert(/3 \/ 3 Blaupausen/.test(b.textContent), 'X7: Fußzeile wie in EVE');
    const acts = el => [...el.querySelectorAll('.in-act i')].map(i => i.classList.contains('on') ? 1 : 0).join('');
    assert(acts(rows[0]) === '000001', 'X7: Reaktionsformel → nur Reaktion');
    const orig = rows.find(r => /\/bp\?/.test(r.querySelector('img:not(.in-ow)').src) && /Rifter/.test(r.textContent)), copy = rows.find(r => /\/bpc\?/.test(r.querySelector('img:not(.in-ow)').src));
    assert(acts(orig) === '100100' && acts(copy) === '100010', 'X7: Original 10/20 → Bauen + Kopieren; Kopie → Bauen + Erfindung');
    T.inAction({ type: 'inKind', arg: 'copy' });
    b = R(); rows = [...b.querySelectorAll('.in-b')];
    assert(rows.length === 1 && /1 \/ 3/.test(b.textContent) && rows[0].querySelector('.in-bd'), 'X7: nur Kopien; einzelne Zeile ist aufgeklappt');
    assert(/Besitzer\s*Builder/.test(rows[0].textContent) && /Kopie/.test(rows[0].textContent) && /Produkt\s*Rifter/.test(rows[0].textContent) && /Ort\s*Amarr VIII/.test(rows[0].textContent) && /Sprünge\s*\?/.test(rows[0].textContent), 'X7: Details (Besitzer, Art, Produkt, Ort, Sprünge)');
    T.inAction({ type: 'inKind', arg: 'all' }); T.inAction({ type: 'inFind', form: { q: 'frigate' } });
    b = R(); assert(b.querySelectorAll('.in-b').length === 2, 'X7: Suche nach Gruppe');
    T.inAction({ type: 'inFind', form: { q: '' } });
    b = R(); assert(!b.querySelector('.in-bd'), 'X7: zu');
    T.inAction({ type: 'inBp', arg: '1' });
    b = R(); assert(b.querySelectorAll('.in-bd').length === 1, 'X7: Klick auf Name klappt auf');
    // Y11: Sortieren per Spaltenkopf + Besitzer-Porträt bei „Alle“
    assert(b.querySelectorAll('.in-b .in-ow').length === 3 && /characters\/222\/portrait/.test(b.querySelector('.in-b .in-ow').src), 'Y11: Mini-Porträt des Besitzers bei Alle');
    const names = () => [...R().querySelectorAll('.in-b')].map(r => r.querySelector('img:not(.in-ow)').src.includes('/bpc') ? 'K' : r.textContent.includes('Ferrogel') ? 'F' : 'O').join('');
    T.inAction({ type: 'inSort', arg: 'me' });
    assert(names() === 'OKF' && /ME ▼/.test(R().querySelector('.as-hd').textContent), 'Y11: ME absteigend: ' + names());
    T.inAction({ type: 'inSort', arg: 'me' });
    assert(names() === 'FKO', 'Y11: zweiter Klick dreht um: ' + names());
    T.inAction({ type: 'inSort', arg: 'r' });
    assert(names()[2] === 'K', 'Y11: Läufe, ∞ vor Zahl: ' + names());
    T.inAction({ type: 'inSort', arg: 'act' });
    assert(names()[2] === 'F', 'Y11: Aktivitäten (Reaktion hat nur 1): ' + names());
    T.inAction({ type: 'inSort', arg: 'n' });
    assert(names() === 'FOK', 'Y11: zurück nach Name');
    T.inAction({ type: 'inOwn', arg: '111' });
    assert(!R().querySelector('.in-ow'), 'Y11: ein Charakter gewählt → kein Porträt');
    T.inAction({ type: 'inOwn', arg: 'all' });
    // grosse Seite: gleiche Ansicht, nur Blaupausen
    assert(d.querySelectorAll('#in-bp-page .in-b').length === 3 && !d.querySelector('#in-bp-page .as-tabs'), 'X7: große Seite zeigt dieselben Blaupausen');
    const lc = JSON.parse(w.localStorage.getItem('eve-zentrale-listcache-v1'));
    assert(lc.industry && lc.industry.d.jobs.length === 3, 'X7: gespeichert für Overlay-Fenster');
    console.log('\nALL X7 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
