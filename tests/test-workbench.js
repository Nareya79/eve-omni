// WB (14.10.2026): Fits von EVE Workbench – Antworten in PascalCase, Filter nach ShipId, seitenweises Laden (20 Treffer / 10 Seiten / „Mehr suchen“),
// 429 + Retry-After ohne Dauer-Neuversuch, Zwischenspeicher (6 Std. / 24 Std., Obergrenze, nicht im Export), Speichern/Löschen + volle Quote,
// Einkaufsliste aus EFT (doppelte Module), nur api.eveworkbench.com, Texte DE/EN + title an allen Knöpfen, Overlay + Hauptfenster
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const TORRENT = 81047, GILA = 17715, JITA = 60003760;
const EFT = '[Torrent, Blockade]\nDamage Control II\nDamage Control II\nNanofiber Internal Structure II\n\n5MN Microwarpdrive II\n\nSmall Ancillary Current Router I\n\nHornet I x3\n';
// Seite n: auf jeder Seite 3 Torrent-Fits ausser Seite 1 (2 Stück), sonst Gila
const page = n => ({ NumberOfPages: 30, CurrentPage: n, PageSize: 100, TotalFits: 3000, Error: false, Message: null,
  Fits: Array.from({ length: 100 }, (_, i) => { const t = n === 1 ? i < 2 : i < 3; return { Id: 'f' + n + '-' + i, Name: (t ? 'Torrent fit ' : 'Gila fit ') + n + '/' + i, Slug: t ? 'torrent' : 'gila', ShipId: t ? TORRENT : GILA, ShipGroupId: 0, ShipName: t ? 'Torrent' : 'Gila',
    CharacterId: 0, CharacterName: i === 0 ? 'Pilot X' : null, DateAdded: '2026-10-1' + (n % 10) + 'T10:00:00.1', TotalDps: i === 1 ? 123.4 : 0 }; }) });
const IDS = { torrent: TORRENT, gila: GILA, 'damage control ii': 2048, 'nanofiber internal structure ii': 2605, '5mn microwarpdrive ii': 35658, 'small ancillary current router i': 31358, 'hornet i': 2464 };
const PX = { 81047: 30e6, 2048: 1e6, 2605: 5e5, 35658: 3e6, 31358: 4e5, 2464: 2e3 };
const calls = [];
let mode = 'ok';
const J = (x, st, h) => Promise.resolve({ ok: (st || 200) < 300, status: st || 200, headers: { get: k => (h || {})[k.toLowerCase()] || null }, json: () => Promise.resolve(x) });
function win(lang){
  return new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
    x.localStorage.setItem('eve-zentrale-lang-v1', lang);
    x.fetch = (u, o) => { u = String(u); let m;
      if (/eveworkbench/.test(u)) calls.push({ u, h: o && o.headers });
      if (/api\.eveworkbench\.com/.test(u)){
        if (mode === '429') return J({}, 429, { 'retry-after': '42' });
        if ((m = /fits\/public\?page=(\d+)/.exec(u))) return J(page(+m[1]));
        if (/fits\/bad\/eft/.test(u)) return J({ Eft: null, Error: true, Message: 'Invalid fittingId received' });
        if (/fits\/empty\/eft/.test(u)) return J({ Eft: '  ', Error: false, Message: null });
        if (/\/eft$/.test(u)) return J({ Eft: EFT, Error: false, Message: null });
      }
      if (/universe\/ids/.test(u)){ const names = JSON.parse(o.body); return J({ inventory_types: names.filter(n => IDS[n.toLowerCase()]).map(n => ({ id: IDS[n.toLowerCase()], name: n })) }); }
      if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))) return J(PX[m[1]] ? [{ is_buy_order: false, location_id: JITA, system_id: 30000142, range: 'region', price: PX[m[1]], volume_remain: 100, min_volume: 1, order_id: 1, type_id: +m[1], duration: 90, issued: '2026-10-01T00:00:00Z' },
        { is_buy_order: true, location_id: JITA, system_id: 30000142, range: 'station', price: PX[m[1]] * 0.9, volume_remain: 100, min_volume: 1, order_id: 2, type_id: +m[1], duration: 90, issued: '2026-10-01T00:00:00Z' }] : []);
      if ((m = /universe\/types\/(\d+)/.exec(u))) return J({ type_id: +m[1], name: Object.keys(IDS).find(k => IDS[k] === +m[1]) || 'X', packaged_volume: 5, volume: 5 });
      return Promise.reject(new Error('offline')); };
  } }).window;
}
(async () => {
  try{
    let w = win('de'); await tick(800);
    let T = w.__test, d = w.document;
    // a) PascalCase + kompakte Ablage
    const p1 = await T.wbPage(1);
    assert(p1.np === 30 && p1.f.length === 100 && p1.f[0][0] === 'f1-0' && p1.f[0][2] === TORRENT && p1.f[0][3] === 'Torrent' && p1.f[0][4] === 'Pilot X' && p1.f[0][5] === '2026-10-11' && p1.f[1][6] === 123 && p1.f[2][4] === '', 'a) Fits-Liste PascalCase gelesen (Id, Name, ShipId, ShipName, Ersteller, Datum, DPS)');
    assert(p1.f.filter(x => x[2] === TORRENT).length === 2, 'a) Filter nach ShipId');
    // c) Seitenweise: Torrent → Seite 1 (2) + Seiten 2..7 (je 3) = 20 → Schluss nach 7 Seiten
    calls.length = 0;
    T.wbAction({ type: 'wbTab', arg: 'find', form: { wbship: 'Torrent' } }); await tick(20);
    await T.wbAction({ type: 'wbGo', form: { wbship: 'Torrent' } });
    let S = T.wbGetS();
    assert(S.tid === TORRENT && S.hits.length === 20 && S.next === 8, 'c) Abbruch bei 20 Treffern (nach 7 Seiten, Seite 1 aus dem Zwischenspeicher)');
    assert(calls.filter(c => /public/.test(c.u)).length === 6, 'c) Seite 1 kam aus dem Zwischenspeicher (6 Abrufe übers Netz)');
    await T.wbAction({ type: 'wbMore', form: {} });
    S = T.wbGetS();
    assert(S.hits.length === 41 && S.next === 15, 'c) „Mehr suchen“ lädt weiter (Seiten 8–14, 21 neue Treffer)');
    await T.wbAction({ type: 'wbGo', form: { wbship: 'Gila' } }); S = T.wbGetS();
    assert(S.hits.length >= 20 && S.next <= 11, 'c) höchstens 10 Seiten je Suche (Gila)');
    // max. 10 Seiten ohne genug Treffer: Schiff ohne Fits
    IDS.venture = 32880;
    await T.wbAction({ type: 'wbGo', form: { wbship: 'Venture' } }); S = T.wbGetS();
    assert(S.hits.length === 0 && S.next === 11, 'c) ohne Treffer Schluss nach 10 Seiten');
    T.wbView(d.createElement('div'), true);
    let box = d.createElement('div'); T.wbView(box, false);
    assert(/Keine Fits zu diesem Schiff in den letzten 10 Seiten gefunden/.test(box.textContent) && box.querySelector('[data-ova="wbMore"]'), 'c) Meldung „Keine Fits … Mehr suchen“ + Knopf');
    // b) EFT-Antwort
    assert(await T.wbEft('f1-0') === EFT.trim(), 'b) EFT-Text aus „Eft“');
    let e1 = null; try{ await T.wbEft('bad'); }catch(e){ e1 = e.message; }
    assert(/Invalid fittingId received/.test(e1), 'b) Error=true → Meldung: ' + e1);
    let e2 = null; try{ await T.wbEft('empty'); }catch(e){ e2 = e.message; }
    assert(/leer/.test(e2), 'b) leerer Text → Meldung: ' + e2);
    // d) 429
    mode = '429'; calls.length = 0;
    let e3 = null; try{ await T.wbPage(29); }catch(e){ e3 = e.message; }
    assert(/42 s/.test(e3) && calls.length === 1, 'd) 429: Retry-After 42 s gemeldet, ein Abruf');
    let e4 = null; try{ await T.wbPage(28); }catch(e){ e4 = e.message; }
    assert(/bremst/.test(e4) && calls.length === 1, 'd) während der Wartezeit kein neuer Abruf');
    mode = 'ok'; T.wbSetWait(0);
    // e) Zwischenspeicher
    let c = T.wbCacheLoad();
    assert(c.p[1] && c.e['f1-0'], 'e) Listen und EFT im Zwischenspeicher');
    const raw = JSON.parse(w.localStorage.getItem('eve-zentrale-wbcache-v1'));
    raw.p[1].t = Date.now() - 6 * 3600000 - 1; raw.p[2].t = Date.now() - 5 * 3600000; raw.e['f1-0'].t = Date.now() - 24 * 3600000 - 1; raw.e.x = { t: Date.now() - 23 * 3600000, x: 'y' };
    w.localStorage.setItem('eve-zentrale-wbcache-v1', JSON.stringify(raw));
    c = T.wbCacheLoad();
    assert(!c.p[1] && c.p[2] && !c.e['f1-0'] && c.e.x, 'e) Listen nach 6 Std., EFT nach 24 Std. abgelaufen');
    for (let i = 100; i < 140; i++) c.p[i] = { t: Date.now() - i, np: 1, f: [] };
    for (let i = 0; i < 130; i++) c.e['z' + i] = { t: Date.now() - i, x: 'x' };
    T.wbCacheSave(c); c = T.wbCacheLoad();
    assert(Object.keys(c.p).length === 25 && Object.keys(c.e).length === 100 && c.p[100] && !c.p[139], 'e) Obergrenze 25 Seiten / 100 EFT, die neuesten bleiben');
    assert(!/wbcache/.test(T.dxBuildJson(false)), 'e) Zwischenspeicher nicht im Export');
    // g) Einkaufsliste aus EFT (doppelte Module, Drohnen)
    await T.wbAction({ type: 'wbGo', form: { wbship: 'Torrent' } });
    await T.wbAction({ type: 'wbOpen', arg: 'f1-0' }); await tick(200);
    let D = T.wbDetGet('f1-0');
    const q = {}; D.rows.forEach(r => q[r.tid] = r.q);
    assert(!D.err && q[TORRENT] === 1 && q[2048] === 2 && q[2605] === 1 && q[35658] === 1 && q[31358] === 1 && q[2464] === 3, 'g) Einkaufsliste zählt: Torrent 1, Damage Control II ×2, Hornet I ×3 …');
    const fees = T.tscFees(T.tscReadCfg()), want = (30e6 + 2e6 + 5e5 + 3e6 + 4e5 + 6e3);
    assert(Math.abs(D.now - want) / want < 1e-6, 'g) Preis Jita sofort = Summe der Verkaufsorders (' + T.shortIsk(D.now) + ')');
    box = d.createElement('div'); T.wbView(box, true);
    const mb = box.querySelector('.wb-mb [data-copy]');
    assert(mb && /Damage Control II 2/.test(mb.getAttribute('data-copy')) && /Hornet I 3/.test(mb.getAttribute('data-copy')), 'g) Multibuy-Kopie „Name Menge“');
    const eftCp = [...box.querySelectorAll('.wb-btns [data-copy]')].find(b => b.getAttribute('data-copy') === EFT.trim());
    assert(eftCp, 'EFT kopieren = exakter Text');
    assert(box.querySelector('.wb-btns a[href="https://eveworkbench.com/fitting/torrent/f1-0"]') && box.querySelector('.wb-src a[href^="https://eveworkbench.com"]'), 'Link zum Fit + Namensnennung EVE Workbench');
    await T.wbAction({ type: 'wbBuy', arg: 'f1-0' }); box = d.createElement('div'); T.wbView(box, true);
    assert(!box.querySelector('.wb-mb'), 'SS1: Einkaufsliste per Knopf zu');
    // SS1: „Preis“ sortieren lädt die Preise aller angezeigten Fits
    await T.wbAction({ type: 'wbSort', arg: 'price' }); await tick(300);
    box = d.createElement('div'); T.wbView(box, false);
    const rws = box.querySelectorAll('.wb-row');
    assert(rws.length > 1 && [...rws].every(r => r.querySelector('b.mono')), 'SS1: nach „Preis“ hat jeder angezeigte Fit einen Preis (' + rws.length + ')');
    await T.wbAction({ type: 'wbSort', arg: 'new' });
    // Durchrechnen
    T.wbAction({ type: 'wbCalc', arg: 'f1-0' }); await tick(1500);
    D = T.wbDetGet('f1-0');
    assert(D.calc || D.cErr, 'Durchrechnen liefert Ergebnis oder sichtbare Meldung (' + (D.cErr || D.calc.name) + ')');
    // f) Speichern / Löschen / Quote
    await T.wbAction({ type: 'wbSave', arg: 'f1-0' });
    assert(T.wbSaved().length === 1 && T.wbSaved()[0].e === EFT.trim() && T.wbDetGet('f1-0').msg === 'Gespeichert.', 'f) gespeichert mit EFT');
    await T.wbAction({ type: 'wbSave', arg: 'f1-0' });
    assert(T.wbSaved().length === 1 && /Schon/.test(T.wbDetGet('f1-0').msg), 'f) kein Doppel');
    assert(/wbfits/.test(T.dxBuildJson(false)), 'f) gespeicherte Fits gehen in den Export');
    const set = w.localStorage.setItem.bind(w.localStorage);
    w.Storage.prototype.setItem = function(k, v){ if (k === 'eve-zentrale-wbfits-v1') throw new Error('QuotaExceededError'); return set(k, v); };
    const qmsg = T.wbSaveFit(['f2-0', 'X', TORRENT, 'Torrent', '', '2026-10-12', 0], 'x');
    w.Storage.prototype.setItem = function(k, v){ return set(k, v); };
    assert(/Speicher ist voll/.test(qmsg), 'f) volle Quote wird gemeldet: ' + qmsg);
    await T.wbAction({ type: 'wbTab', arg: 'saved', form: {} });
    box = d.createElement('div'); T.wbView(box, false);
    assert(/Gespeichert \(1\)/.test(box.textContent) && box.querySelector('[data-ova="wbDel"]'), 'f) Reiter „Gespeichert“ mit Löschen');
    await T.wbAction({ type: 'wbDel', arg: 'f1-0' });
    assert(T.wbSaved().length === 0, 'f) gelöscht');
    // h) nur api.eveworkbench.com, ohne Schlüssel/Token
    assert(calls.every(c => /^https:\/\/api\.eveworkbench\.com\/v1\//.test(c.u) && !c.h), 'h) Abrufe nur an api.eveworkbench.com/v1, ohne eigene Kopfzeilen (' + calls.length + ')');
    assert(!/['"][A-Za-z0-9]{24,}['"]/.test(html.slice(html.indexOf('var WB_API'), html.indexOf('function wbView'))), 'h) kein fest eingebauter Schlüssel im Code');
    // h) Token: Browser ohne Programm → Hinweis, kein Abruf mit Token
    const TOK = 'GEHEIM-test-token-1234567890';
    await T.wbAction({ type: 'wbTokSet', form: { wbtok: TOK } }); await tick(50);
    assert(w.localStorage.getItem('eve-zentrale-wbtoken-v1') === TOK && T.wbVLoad().tab === 'mine', 'h) Token gespeichert, Reiter „Meine Fits“');
    box = d.createElement('div'); T.wbView(box, false);
    assert(/nur im Windows-Programm/.test(box.textContent) && calls.every(c => c.u.indexOf(TOK) < 0 && !c.h), 'h) im Browser: Hinweis, Token geht nirgends hin');
    assert(T.dxBuildJson(false).indexOf(TOK) < 0 && T.dxBuildJson(true).indexOf(TOK) < 0, 'h) Token nie im Export (auch nicht „mit Logins“)');
    // h) im Programm: über evecoreHost.wbFetch (Token als Argument, nicht in der Adresse), 401 → Meldung
    const hc = []; let hst = 200;
    w.evecoreHost = Object.assign(w.evecoreHost || {}, { wbFetch: (p, k) => { hc.push([p, k]); return Promise.resolve(hst === 200 ? { status: 200, body: JSON.stringify(p === 'fits/list' ? { Fits: [{ Id: '11111111-2222-3333-4444-555555555555', Name: 'Mein Torrent', Ship: { Name: 'Torrent', TypeId: TORRENT } }], Error: false } : { Eft: EFT, Error: false }) } : { status: hst, body: '' }); } });
    T.wbHostSet(w.evecoreHost);
    await T.wbAction({ type: 'wbMine' });
    box = d.createElement('div'); T.wbView(box, false);
    assert(hc.length === 1 && hc[0][0] === 'fits/list' && hc[0][1] === TOK && /Mein Torrent/.test(box.textContent), 'h) Meine Fits über das Programm geladen (Token nur als Kopfzeile)');
    await T.wbAction({ type: 'wbOpen', arg: '11111111-2222-3333-4444-555555555555' }); await tick(200);
    assert(hc.some(c => c[0] === 'fits/11111111-2222-3333-4444-555555555555/eft') && T.wbDetGet('11111111-2222-3333-4444-555555555555').eft === EFT.trim(), 'h) eigener Fit: EFT mit Token');
    hst = 401; await T.wbAction({ type: 'wbMine' });
    box = d.createElement('div'); T.wbView(box, false);
    assert(/Token ungültig oder abgelaufen/.test(box.textContent), 'h) 401 → „Token ungültig oder abgelaufen“');
    assert(!html.slice(html.indexOf('var WB_API'), html.indexOf('function wbView')).match(/console\.|\?[^"]*token|token=/i), 'h) Token nicht geloggt, nicht in Adressen');
    const mainSrc = fs.readFileSync('/home/claude/main.js', 'utf8'), wf = mainSrc.slice(mainSrc.indexOf('async function wbFetch('), mainSrc.indexOf("ipcMain.handle('evecore:wbFetch'"));
    assert(/'https:\/\/api\.eveworkbench\.com\/v1\/' \+ p/.test(wf) && /\^fits\\\/\(list\|/.test(wf) && /'X-API-KEY': key/.test(wf) && !/console|log\(/.test(wf), 'h) Programm: fest api.eveworkbench.com, nur Fit-Pfade, Token als X-API-KEY, kein Log');
    await T.wbAction({ type: 'wbTokDel' });
    assert(!w.localStorage.getItem('eve-zentrale-wbtoken-v1') && T.wbVLoad().tab === 'find', 'h) „Token entfernen“ löscht');
    T.wbHostSet(null);
    // Overlay + Hauptfenster angemeldet
    assert(T.ovViews().workbench === 'Workbench' && html.indexOf('mk("workbench"') >= 0 && html.indexOf('"neo-btn-workbench"') >= 0, 'Overlay „Workbench“ + OmniCom-Overlay-Symbol');
    assert(fs.readFileSync('/home/claude/main.js', 'utf8').indexOf("workbench: 'Workbench'") >= 0, 'Programm kennt das Fenster „workbench“');
    // i) title an allen Knöpfen (Suchen + aufgeklappt + Gespeichert)
    await T.wbAction({ type: 'wbTab', arg: 'find', form: {} });
    const miss = [];
    for (const big of [false, true]){ box = d.createElement('div'); T.wbView(box, big); box.querySelectorAll('button, a, input').forEach(b => { if (!(b.getAttribute('title') || '').trim()) miss.push(b.tagName + ' ' + b.textContent.trim().slice(0, 30)); }); }
    assert(!miss.length, 'i) jeder Knopf/Link hat ein title' + (miss.length ? ': ' + miss.join(' | ') : ''));
    w.close();
    // i) EN
    w = win('en'); await tick(800); T = w.__test; d = w.document;
    await T.wbAction({ type: 'wbGo', form: { wbship: 'Torrent' } });
    await T.wbAction({ type: 'wbOpen', arg: 'f1-0' }); await tick(200);
    w.localStorage.setItem('eve-zentrale-wbtoken-v1', 'GEHEIM-test-token-1234567890'); await T.wbAction({ type: 'wbTokUi' });
    box = d.createElement('div'); d.body.appendChild(box); T.wbView(box, false); await tick(100);
    const DE = /[äöüÄÖÜß]|\b(und|nicht|oder|für|mit|der|die|das|den|Fits laden|Suchen|Speichern|Durchrechnen|Einkaufsliste|Gespeichert|Neueste|Preis|Seiten|durchsucht|sofort|Kauforder|kopieren|öffnen|Schiff)\b/;
    const de = [];
    const tw = d.createTreeWalker(box, 5); let n; while ((n = tw.nextNode())){ if (n.nodeType === 3){ if (DE.test(n.nodeValue) && !n.parentElement.closest('.wb-n, .mi-n, [data-copy]')) de.push(n.nodeValue.trim()); } else ['title', 'placeholder'].forEach(a => { const v = n.getAttribute(a); if (v && DE.test(v) && !n.hasAttribute('data-copy')) de.push('@' + a + ': ' + v); }); }
    assert(!de.length, 'i) EN: Workbench ohne Deutsch' + (de.length ? ': ' + [...new Set(de)].join(' | ') : ''));
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
