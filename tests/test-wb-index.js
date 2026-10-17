// WBI (14.10.2026): Workbench-Index im echten Browser (IndexedDB) – Aufbau seriell mit Pause, Abbruch/Fortsetzen ohne Doppelte, 429, Aktualisieren,
// Suche aus dem Index, Rückfall ohne IndexedDB, nicht im Export, Löschen, DE/EN. API nachgestellt (5 Seiten). Screenshot /tmp/wbi-*.png
const { chromium } = require('playwright');
const FILE = 'file:///tmp/eve-zentrale-test14.html';
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 5 Seiten zu je 4 Fits: Hulk (22544) auf Seite 2 und 5, Gila (17715) überall, Retriever (17478) nie
const mkPage = (n, extra) => { const f = []; for (let i = 0; i < 4; i++){ const id = 1000 - (n - 1) * 4 - i; f.push({ Id: id, Name: 'Fit ' + id + ' mit einem sehr langen Namen, der auf sechzig Zeichen gekürzt werden muss', ShipId: (n === 2 || n === 5) && i === 0 ? 22544 : 17715, ShipName: (n === 2 || n === 5) && i === 0 ? 'Hulk' : 'Gila', CharacterName: 'Pilot ' + id, DateAdded: '2026-10-' + String(20 - n).padStart(2, '0') + 'T10:00:00', TotalDps: i ? 300 + i : 0 }); } return { Fits: (extra || []).concat(f), NumberOfPages: 5 }; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    let calls = [], mode = { fail429At: 0, newOnTop: 0 };
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'de'); });
    await ctx.route(/^https?:\/\//, r => { const u = r.request().url(); const H = { 'access-control-allow-origin': '*' };
      const m = /api\.eveworkbench\.com\/v1\/fits\/public\?page=(\d+)/.exec(u);
      if (m){ const n = +m[1]; calls.push({ n, t: Date.now(), hdr: r.request().headers() });
        if (mode.fail429At === n){ mode.fail429At = 0; return r.fulfill({ status: 429, headers: Object.assign({ 'retry-after': '30' }, H, mode.expose ? { 'access-control-expose-headers': 'Retry-After' } : {}), body: '' }); }
        const extra = n === 1 && mode.newOnTop ? Array.from({ length: mode.newOnTop }, (_, i) => ({ Id: 2000 + i, Name: 'Neu ' + i, ShipId: 22544, ShipName: 'Hulk', DateAdded: '2026-10-25T10:00:00', TotalDps: 0 })) : [];
        return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(mkPage(n, extra)) }); }
      if (/\/universe\/ids\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ inventory_types: [{ id: 22544, name: 'Hulk' }, { id: 17715, name: 'Gila' }, { id: 17478, name: 'Retriever' }] }) });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '[]' }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(1200);
    const T = (fn, ...a) => p.evaluate(([fn, a]) => window.__test[fn](...a), [fn, a]);
    await p.evaluate(() => { window.__test.wbIPause(150); window.__test.switchTab('assets'); });
    const wait = async () => { for (let i = 0; i < 200 && await T('wbIRunning'); i++) await sleep(50); };
    // a) Aufbau seriell mit Pause, Fortschritt
    calls = []; const pr = T('wbIBuild', false); await sleep(60);
    const busy1 = await T('wbBusyGet');
    await pr; await wait();
    let I = await T('wbIGet');
    assert(calls.map(c => c.n).join() === '1,2,3,4,5', 'a) Aufbau lädt Seite 1–5 nacheinander');
    assert(calls.slice(1).every((c, i) => c.t - calls[i].t >= 140), 'a) Pause zwischen den Seiten eingehalten (' + calls.slice(1).map((c, i) => c.t - calls[i].t).join(', ') + ' ms)');
    assert(/^Index: Seite 1 von \? …$/.test(busy1), 'a) Fortschritt sichtbar: ' + busy1);
    assert(I.full && I.pg === 5 && Object.keys(I.f).length === 20 && I.sh[22544] === 'Hulk', 'a) 20 Fits, fertig, Schiffsnamen als Nachschlagetabelle');
    const one = I.f['996'];
    assert(one[0].length === 60 && one[1] === 22544 && one[2] === '2026-10-18' && one[3] === 0 && one[4] === 'Pilot 996' && Object.keys(I.f).every(k => I.f[k].length === 5), 'a) kompakt: Name ≤ 60, ShipId, Datum, DPS nur > 0, Ersteller');
    assert(calls.every(c => !c.hdr['x-api-key'] && !c.hdr.authorization), 'Regeln: kein Token bei der öffentlichen Liste');
    // e) Suche aus dem Index
    calls = [];
    await T('wbAction', { type: 'wbGo', form: { wbship: 'Hulk' } });
    let S = await T('wbGetS');
    assert(S.idx && S.hits.length === 2 && S.hits.every(h => h[2] === 22544) && S.hits[0][5] >= S.hits[1][5] && !calls.length, 'e) Hulk: 2 Treffer aus dem Index, neueste zuerst, kein Abruf');
    await p.evaluate(() => window.__test.wbView(document.body.appendChild(document.createElement('div')), true));
    let txt = await p.evaluate(() => { const d = document.createElement('div'); window.__test.wbView(d, true); return d.textContent; });
    assert(/2 Fits für Hulk \(Index vom \d\d\.\d\d\.\d{4}, 20 Fits insgesamt\)/.test(txt) && /Index löschen \(0,0 MB\)/.test(txt), 'e) Anzeige „N Fits für Hulk (Index vom …, X Fits insgesamt)“ + Löschen mit Größe');
    await T('wbAction', { type: 'wbGo', form: { wbship: 'Gila' } }); S = await T('wbGetS');
    txt = await p.evaluate(() => { const d = document.createElement('div'); window.__test.wbView(d, true); return d.textContent; });
    assert(S.hits.length === 18 && /Mehr anzeigen \(/.test(txt) === false, 'e) Gila: 18 Treffer (unter 20, kein „Mehr“)');
    await T('wbAction', { type: 'wbGo', form: { wbship: 'Retriever' } });
    txt = await p.evaluate(() => { const d = document.createElement('div'); window.__test.wbView(d, true); return d.textContent; });
    assert(/Keine öffentlichen Fits für Retriever auf EVE Workbench\./.test(txt), 'e) Schiff ohne Treffer → klare Meldung');
    // d) Aktualisieren: 3 neue Fits oben → Seite 1 neu, Seite 2 nur bekannt → Stopp
    mode.newOnTop = 3; calls = [];
    await T('wbIUpdate'); await wait();
    I = await T('wbIGet');
    assert(calls.map(c => c.n).join() === '1,2' && Object.keys(I.f).length === 23 && /^Index aktualisiert: 3 neue Fits \(2 Abrufe\)\.$/.test(await T('wbMsgGet')), 'd) Aktualisieren stoppt nach der ersten Seite ohne Neues, 3 neue dazu');
    await T('wbAction', { type: 'wbGo', form: { wbship: 'Hulk' } }); S = await T('wbGetS');
    assert(S.hits.length === 5 && S.hits[0][1].startsWith('Neu'), 'd) neue Hulk-Fits stehen oben');
    mode.newOnTop = 0;
    // b) Abbruch + Fortsetzen ohne Verlust/Doppelte
    await T('wbIBuild', true); await wait();   // frisch, aber nach Seite 2 anhalten:
    await T('wbIDelete');
    calls = []; const pb = T('wbIBuild', false);
    for (let i = 0; i < 100 && calls.length < 2; i++) await sleep(20);
    await T('wbIStopNow'); await pb; await wait();
    I = await T('wbIGet');
    const stoppedAt = I.pg, n1 = Object.keys(I.f).length;
    assert(!I.full && stoppedAt >= 2 && stoppedAt < 5 && n1 === stoppedAt * 4 && /angehalten bei Seite/.test(await T('wbMsgGet')), 'b) Abbrechen: angehalten bei Seite ' + stoppedAt + ', ' + n1 + ' Fits gespeichert');
    await T('wbIReset'); await T('wbILoad'); I = await T('wbIGet');
    assert(I && I.pg === stoppedAt && Object.keys(I.f).length === n1, 'b) Stand übersteht Neuladen (IndexedDB)');
    mode.newOnTop = 2;   // Seiten verschieben sich: 2 neue Fits oben
    calls = []; await T('wbIBuild', false); await wait(); I = await T('wbIGet');
    assert(calls[0].n === stoppedAt + 1 && I.full && Object.keys(I.f).length === 20 && !I.f['2000'], 'b) Fortsetzen ab Seite ' + (stoppedAt + 1) + ', keine Doppelten (20 Fits)');
    mode.newOnTop = 0;
    // c) 429 mit Retry-After: Abbruch mit Meldung, kein Dauer-Neuversuch
    // ohne Freigabe (Access-Control-Expose-Headers) darf die Seite Retry-After nicht lesen → 60 s
    await T('wbIDelete'); mode.fail429At = 1; await T('wbIBuild', false); await wait();
    assert(/Bitte in 60 s/.test(await T('wbErrGet')), 'c) Retry-After nicht freigegeben → 60 s Pause');
    await T('wbSetWait', 0); mode.expose = true;
    await T('wbIDelete'); mode.fail429At = 3; calls = [];
    await T('wbIBuild', false); await wait(); I = await T('wbIGet');
    const e429 = await T('wbErrGet');
    assert(calls.map(c => c.n).join() === '1,2,3' && I.pg === 2 && /^EVE Workbench bittet um eine Pause – später fortsetzen\. \(.*30 s/.test(e429), 'c) 429: Abbruch nach Seite 2 mit Meldung, kein Neuversuch (' + e429 + ')');
    calls = []; await T('wbIBuild', false); await wait();
    assert(!calls.length && /bremst gerade/.test(await T('wbErrGet')), 'c) während Retry-After kein Abruf');
    await T('wbSetWait', 0); calls = []; await T('wbIBuild', false); await wait(); I = await T('wbIGet');
    assert(calls[0].n === 3 && I.full && Object.keys(I.f).length === 20, 'c) danach fortsetzbar ab Seite 3');
    // g) nicht im Export; Löschen leert
    const ex = await T('dxBuildJson', false);
    assert(!/wbindex|Pilot 996/.test(ex), 'g) Index nicht im Export/Sync (liegt nicht in localStorage)');
    await T('wbIDelete'); await T('wbIReset'); await T('wbILoad');
    assert(!(await T('wbIGet')), 'g) „Index löschen“ leert IndexedDB');
    // h) Oberfläche DE + EN, Tooltips
    await T('wbIBuild', false); await wait();
    await T('wbAction', { type: 'wbGo', form: { wbship: 'Hulk' } });
    await p.evaluate(() => window.__test.ovRender && window.__test.ovRender());
    const ui = await p.evaluate(() => { const d = document.createElement('div'); window.__test.wbView(d, true); return [...d.querySelectorAll('.wb-ibox button')].map(b => b.textContent + '|' + (b.title || '')); });
    assert(ui.length && ui.every(x => /\|.+/.test(x)), 'h) neue Knöpfe haben Tooltips: ' + ui.join(' ; '));
    const small = await p.evaluate(() => { const d = document.createElement('div'); window.__test.wbView(d, false); return d.querySelectorAll('.wb-ibox button').length; });
    assert(small === 0, 'Overlay: keine Aufbau-/Lösch-Knöpfe, nur Hinweis');
    console.log(errs.length ? 'Seitenfehler: ' + errs.join(' | ') : 'OK: keine Seitenfehler');
    if (errs.length) throw new Error('Seitenfehler');
    await ctx.close();
    // f) ohne IndexedDB: alter Weg + Hinweis, auch auf Englisch
    const c2 = await b.newContext({ viewport: { width: 1200, height: 900 } });
    await c2.addInitScript(() => { try{ Object.defineProperty(window, 'indexedDB', { value: undefined }); }catch(e){} localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'en'); });
    let c2calls = 0;
    await c2.route(/^https?:\/\//, r => { const u = r.request().url(); const H = { 'access-control-allow-origin': '*' };
      if (/fits\/public/.test(u)){ c2calls++; return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(mkPage(+/page=(\d+)/.exec(u)[1])) }); }
      if (/\/universe\/ids\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ inventory_types: [{ id: 22544, name: 'Hulk' }] }) });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '[]' }); });
    const p2 = await c2.newPage(); await p2.goto(FILE); await p2.waitForTimeout(1200);
    await p2.evaluate(() => window.__test.wbILoad());
    await p2.evaluate(() => window.__test.wbAction({ type: 'wbGo', form: { wbship: 'Hulk' } }));
    const s2 = await p2.evaluate(() => window.__test.wbGetS());
    await p2.evaluate(() => { window.__test.switchTab('assets'); const d = document.createElement('div'); d.id = 'wbx'; document.body.appendChild(d); window.__test.wbView(d, true); });
    await p2.waitForTimeout(300);
    const t2 = await p2.textContent('#wbx');
    assert(!s2.idx && s2.hits.length === 2 && c2calls === 5, 'f) ohne IndexedDB: alte Seiten-Suche (5 Abrufe, 2 Treffer)');
    assert(/No local index \(storage for it is missing here\)/.test(t2) && !/Ohne lokalen|indexieren/.test(t2), 'f/h) Hinweis auf Englisch, kein Deutsch');
    await c2.close();
    console.log('\nALL WB-INDEX TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
  finally{ await b.close().catch(() => {}); }
})();
