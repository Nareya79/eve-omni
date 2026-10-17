// Abschnitt S (Wuensche vom 25.09.2026, 12. Liste) – S7: echte Kasse bei Trades und Laeufen
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const near = (a, b) => Math.abs(a - b) < 1e-6;
const CH = [{ character_id: 111, character_name: 'Eins', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 }];
const now = Date.now(), iso = t => new Date(t).toISOString(), JITA = 60003760, DODI = 60011866;
const T1 = now - 3000e3, T2 = now - 2000e3, TS = now - 1000e3;
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', charName: 'Eins', qty: 100, buy: 5, sell: 8, unit: 1, created: now - 3600e3, status: 'active', buyOrderId: 9 }];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH));
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR)); } }).window;
(async () => {
  try{
    await tick(700);
    const T = w.__test, fees = T.tscFees(T.tscReadCfg());
    // Kauforder am T1 eingestellt, am T2 im Preis geaendert (issued springt), 100 gekauft, 40 verkauft
    const st = T.pnlLoadStore('111');
    T.pnlMerge(st, [], [], [{ order_id: 9, type_id: 34, issued: iso(T1), location_id: JITA, is_buy_order: true }]);
    T.pnlMerge(st, [{ transaction_id: 1, date: iso(T2 + 5e3), type_id: 34, quantity: 100, unit_price: 5, is_buy: true, location_id: JITA },
                    { transaction_id: 2, date: iso(TS), type_id: 34, quantity: 40, unit_price: 8, is_buy: false, location_id: JITA }],
      [{ id: 11, date: iso(T1), ref_type: 'brokers_fee', amount: -3 }, { id: 12, date: iso(T2), ref_type: 'brokers_fee', amount: -2 },
       { id: 13, date: iso(TS), ref_type: 'transaction_tax', amount: -10 }, { id: 14, date: iso(T1 + 7e3), ref_type: 'brokers_fee', amount: -99 }],
      [{ order_id: 9, type_id: 34, issued: iso(T2), location_id: JITA, is_buy_order: true }]);
    assert(st.ord[9][1] === T2 && st.ord[9][4][0] === T1, 'S7: Preisänderung – früheres „issued“ bleibt gespeichert');
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(st));
    const ev = T.trEvaluate(TR[0], null, fees);
    assert(near(ev.result, 320 - 10 - 500 - 5) && !ev.p.est, 'S7: Kasse = Verkauf − echte Steuer − Einkauf − Maklergebühr (inkl. Preisänderung), fremde Gebühr nicht');
    const ev2 = T.trEvaluate(TR[0], { own: { sell: { order_id: 5, price: 9 } } }, fees);
    assert(near(ev2.forecast, ev2.result + 60 * 9 * (1 - fees.tax)), 'S7: „wenn alles verkauft“ = Kasse + Rest × eigener Verkaufspreis nach Steuer');
    // ohne Journal: Gebuehr geschaetzt und markiert
    const TR2 = Object.assign({}, TR[0], { id: 't2', buyOrderId: 0, hub: 'dodixie' });
    const st2 = T.pnlLoadStore('111');
    T.pnlMerge(st2, [{ transaction_id: 3, date: iso(TS), type_id: 34, quantity: 10, unit_price: 5, is_buy: true, location_id: DODI }], [], []);
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(st2));
    const ev3 = T.trEvaluate(TR2, null, fees);
    assert(ev3.p.est && near(ev3.result, -50 - 50 * fees.brk), 'S7: Einkauf sofort als Minus, fehlende Maklergebühr mit Satz geschätzt (≈)');
    // Lauf: Einkauf am Start, Teilverkauf am Ziel
    const run = T.hrAdd(JITA, 'Jita', DODI, 'Dodixie', [{ tid: 35, name: 'Pyerite', q: 100, sp: 500, p: 200 }]);
    const st3 = T.pnlLoadStore('111');
    T.pnlMerge(st3, [{ transaction_id: 4, date: iso(now - 600e3), type_id: 35, quantity: 100, unit_price: 5, is_buy: true, location_id: JITA },
                     { transaction_id: 5, date: iso(now), type_id: 35, quantity: 50, unit_price: 10, is_buy: false, location_id: DODI }], [], []);
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(st3));
    const g = T.hrProgress(T.hrLoad().filter(x => x.id === run.id)[0]);
    assert(near(g.profit, 500 - 500 * fees.tax - 500) && g.est, 'S7: Lauf-Kasse mit Einkauf als Minus und Steuer');
    assert(near(g.forecast, g.profit + 50 * 7), 'S7: Lauf-Prognose = Kasse + Rest × geplanter Stückerlös');
    // S11: Dauer, Ø je Strecke aus mind. 2 Erledigten, > 1,5 × Ø = rot
    const H = 3600e3, R = (id, from, to, created, doneAt, extra) => Object.assign({ id, from, to, fromName: 'A', toName: 'B', charId: '111', items: [], created, status: doneAt ? 'done' : 'active', doneAt }, extra);
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([
      R('r1', 1, 2, now - 10 * H, now - 9 * H), R('r2', 1, 2, now - 8 * H, now - 5 * H), R('r3', 1, 2, now - 5 * H, 0),
      R('r4', 1, 2, now - 1 * H, 0), R('r5', 1, 2, now - 20 * H, now - 1 * H, { cancelled: true }), R('r6', 3, 4, now - 9 * H, 0)]));
    const tm = T.tkTimes();
    assert(tm.Laufr1.avg === 2 * H && !tm.Laufr1.slow && tm.Laufr2.dur === 3 * H, 'S11: Ø 2 Std aus den zwei Erledigten, Abgebrochene zählen nicht');
    assert(tm.Laufr3.active && tm.Laufr3.slow && !tm.Laufr4.slow, 'S11: laufend 5 Std > 1,5 × Ø = rot, 1 Std nicht');
    assert(tm.Laufr6.avg === null && !tm.Laufr6.slow && !tm.Laufr5, 'S11: andere Strecke ohne Ø nie rot, Abgebrochene ohne Zeit');
    const x3 = T.trkAll().find(x => x.id === 'r3');
    assert(x3.tm && x3.tm.slow, 'S11: „Verfolgt“ bekommt die Zeiten');
    // X6: Dauer vom Merken (Kauf davor gehört evtl. zum vorigen Lauf) bis zum Verkauf, nicht bis zum späten Erledigt-Klick
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([R('r7', JITA, DODI, now - 300e3, now + 2 * H, { items: [{ tid: 35, name: 'Pyerite', q: 100, sp: 500, p: 200 }] })]));
    assert(T.tkTimes().Laufr7.dur === 300e3, 'X6: Dauer = Merken bis Verkauf (Wallet): ' + T.tkTimes().Laufr7.dur);
    // T3: Station kopieren – Knopf 1 = Text für die EVE-Suche, Knopf 2 = nur das System (Namen: Z3, test-wuensche-z.js)
    const cp = n => [].map.call(T.stCell(n).querySelectorAll('.tsc-cp-b'), b => b.getAttribute('data-copy')).filter(Boolean);
    assert(cp('Jita IV - Moon 4 - Caldari Navy Assembly Plant').join('|') === 'Jita IV - Moon 4 - Caldari Navy Montagewerk*|Jita', 'T3: EVE-Name, System extra');
    assert(cp('1DQ1-A - 1-st Thetastar of Dickbutt').join('|') === '1DQ1-A - 1-st Thetastar of Dickbutt|1DQ1-A', 'T3: Struktur voller Name');
    // T9: Gewinn pro Stunde – 29 Mio. in 15 Sprüngen schlägt 34 Mio. in 34 Sprüngen
    assert(T.t9JumpMin(null) === 1, 'T9: ohne Schiffsdaten 1 Min. je Sprung');
    const fr = T.t9JumpMin({ mass: 960000000, agility: 0.0288, warpSpeed: 1.37 });
    assert(fr > 1.3 && fr < 3, 'T9: Frachter braucht grob 1,5–2,5 Min. je Sprung (' + fr.toFixed(2) + ')');
    const a = Object.assign({ profit: 34e6 }, T.t9Rate('is', 34e6, 34, 1)), b = Object.assign({ profit: 29e6 }, T.t9Rate('is', 29e6, 15, 1));
    assert(a.min === 39 && near(b.iskh, 29e6 / 20 * 60), 'T9: Zeit = Sprünge × Min. + 5 Min. Zuschlag');
    assert([a, b].sort(T.iskhCmp)[0] === b, 'T9: 29 Mio./15 Sprünge wird empfohlen');
    assert([{ profit: 9e9, iskh: null }, b].sort(T.iskhCmp)[0] === b, 'T9: ohne Sprünge hinten');
    // T10: fertige Trades bleiben 10 Min. im Trades-Overlay, abgebrochene nicht, 0 = sofort weg
    const TD = (id, name, extra) => Object.assign({}, TR[0], { id, name, buyOrderId: 0 }, extra);
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify([TD('a', 'Offen'), TD('b', 'Frisch', { status: 'done', done: now - 120e3 }),
      TD('c', 'Alt', { status: 'done', done: now - 1200e3 }), TD('d', 'Weg', { status: 'done', cancelled: true, done: now })]));
    const trTxt = () => { const bx = w.document.createElement('div'); T.ovRenderViewInto('track', bx); return bx.textContent; };   // BB11: „fertig noch zeigen“ jetzt in der Watchlist
    let tt = trTxt();
    assert(/Offen/.test(tt) && /Frisch/.test(tt) && !/Alt/.test(tt) && !/Weg/.test(tt), 'T10: fertig vor 2 Min. noch da, vor 20 Min. und abgebrochen weg');
    w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ doneKeep: 0 }));
    tt = trTxt();
    assert(/Offen/.test(tt) && !/Frisch/.test(tt), 'T10: 0 = sofort weg');
    // T11: ab 90 % der Planmenge weiter, per Hand „weiter“, verkauft ab 90 % vom Gekauften
    const st4 = T.pnlLoadStore('111');
    T.pnlMerge(st4, [{ transaction_id: 41, date: iso(now - 300e3), type_id: 36, quantity: 92, unit_price: 5, is_buy: true, location_id: JITA }], [], []);
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(st4));
    const RU = (q, extra) => Object.assign({ id: 'x', from: JITA, fromName: 'Jita', to: DODI, toName: 'Dodixie', charId: '111', items: [{ tid: 36, name: 'Mexallon', q, sp: 500, p: 100 }], created: now, status: 'active' }, extra);
    assert(T.hrProgress(RU(100)).phase === 'unterwegs', 'T11: 92 von 100 gekauft = unterwegs');
    assert(T.hrProgress(RU(110)).phase === 'wird gekauft' && T.hrProgress(RU(110, { buyDone: true })).phase === 'unterwegs', 'T11: 92 von 110 bleibt beim Kauf, Knopf „weiter“ schaltet um');
    T.pnlMerge(st4, [{ transaction_id: 42, date: iso(now), type_id: 36, quantity: 83, unit_price: 9, is_buy: false, location_id: DODI }], [], []);
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(st4));
    assert(T.hrProgress(RU(100)).phase === 'verkauft', 'T11: 83 von 92 verkauft = fertig');
    w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ tkThr: 100 }));
    assert(T.hrProgress(RU(100)).phase === 'wird verkauft', 'T11: Schwelle 100 % = wie früher');
    w.localStorage.removeItem('eve-zentrale-overlay-v1');
    // T12: Preise einer Option neu laden (nur Orders ihrer Waren), Gewinn neu, Warnung bei deutlich schlechter
    const ORD = { 1: [{ type_id: 34, location_id: JITA, is_buy_order: false, price: 5, volume_remain: 1000 }], 2: [{ type_id: 34, location_id: DODI, is_buy_order: true, price: 7, volume_remain: 50 }] };
    const urls = [];
    w.fetch = u => { urls.push(u); const m = /markets\/(\d+)\/orders\/.*type_id=34/.exec(u); return m ? Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(ORD[m[1]]) }) : Promise.reject(new Error('offline')); };
    const rows = [{ tid: '34', name: 'Tritanium', q: 900, sp: 4500, p: 1000, vol: 0.01 }];
    const HO = { dst: { region: 2, station: DODI, label: 'Dodixie' }, profit: 1000, spend: 4500, volUsed: 9, strategy: 'x', rows, jumps: 9, perJump: 1 };
    T.setOvData({ hub: Object.assign({ t: now, src: { region: 1, station: JITA, label: 'Jita' }, cargo: 1e6, budget: 1e9, sc: { order: false, fee: 0 }, opts: [HO], sel: 0 }, HO) });
    await T.hubRefresh(0);
    assert(urls.every(u => /type_id=34/.test(u)) && urls.length === 2, 'T12: nur die Orders der Ware an Start und Ziel geladen');
    assert(HO.profit === 100 && HO.prev === 1000 && rows.length === 1 && rows[0].q === 50 && near(HO.iskh, 100 / 14 * 60), 'T12: Menge, Gewinn und Gewinn/Std. neu gerechnet');
    const hb = w.document.createElement('div'); T.ovRenderViewInto('handel', hb);
    assert(/Stand \d\d:\d\d/.test(hb.textContent) && /deutlich schlechter/.test(hb.textContent) && T.getOvHub().profit === 100, 'T12: Overlay zeigt Stand und Warnung');
    w.fetch = () => Promise.reject(new Error('offline'));
    // T13: gemerkter Lauf mit Waren, Preisen, Stationen, Route – im Overlay „Verfolgt“ und in „Meine Hauling-Läufe“
    const run13 = T.hrAdd(JITA, 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', DODI, 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant', [{ tid: 37, name: 'Isogen', q: 10, sp: 500, p: 80 }]);
    w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ trkDet: run13.id }));
    const tb = w.document.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(!tb.querySelector('.ov-hl-items') && /Multibuy/.test(tb.textContent) && /Isogen 10/.test(tb.innerHTML) && !/Ø 50/.test(tb.textContent) && /Jita IV - Moon 4 - Caldari Navy Montagewerk/.test(tb.innerHTML) && tb.querySelector('[data-arg="run:' + run13.id + '"]'), 'T13/U10: Overlay-Lauf zeigt nur Multibuy (keine Einzelwaren), Kauf-Station, Route');
    T.switchTab('track'); w.document.querySelector('[data-trk="active"]').onclick(); w.document.querySelector('[data-trk-row="Lauf:' + run13.id + '"]').onclick();
    const det = w.document.querySelector('#trk-body .hr-det');   // BB11: Läufe in der Watchlist
    assert(det && /Isogen/.test(det.textContent) && det.querySelectorAll('.tsc-cp-b.st-sys').length === 2, 'T13: Hauptfenster-Lauf mit Detailansicht und System-Knöpfen');
// T14: Rahmen nach Status    assert(T.tkStCls('wird gekauft') === ' st-buy' && T.tkStCls('unterwegs') === ' st-way' && T.tkStCls('wird verkauft') === ' st-sell' && T.tkStCls('unterwegs', true) === ' st-bad' && T.tkStCls('erledigt') === '', 'T14: Status-Farben');    assert(tb.querySelector('.ov-card.st-buy') && T.trkAll().some(x => x.kind === 'Lauf' && x.st === ' st-buy'), 'T14: geplanter Lauf blau umrandet');
    w.localStorage.removeItem('eve-zentrale-overlay-v1');
    // T16: Radar – letzter Kill, haeufigster Angreifer, Gefahr-Balken
    w.fetch = (u) => {
      if (/zkillboard\.com\/api\/kills/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { killmail_id: 77, killmail_time: new Date(now - 5 * 60e3).toISOString(), zkb: { locationID: 50000001 }, attackers: [{ character_id: 9001, ship_type_id: 587 }, { character_id: 9002 }] },
        { killmail_id: 76, killmail_time: new Date(now - 20 * 60e3).toISOString(), zkb: { locationID: 50000001 }, attackers: [{ character_id: 9001 }] }]) });
      if (/universe\/names/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 9001, name: 'Camper' }, { id: 9002, name: 'Zwei' }, { id: 587, name: 'Rifter' }]) });
      if (/stargates/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Stargate (Tama)' }) });
      return Promise.reject(new Error('offline'));
    };
    const rc = await T.radarCamps([30002813], 1);
    assert(rc.length === 1 && rc[0].kill === 77 && rc[0].pid === '9001' && rc[0].pn === 'Camper' && rc[0].gate === 'Tama', 'T16: letzter Kill und häufigster Angreifer');
    assert(T.radarDanger(rc[0], 1) >= 50 && T.radarDanger({ n: 1, last: now - 5 * 3600e3, tags: [] }, 6) < 10, 'T16: Gefahr hoch bei frischen Kills, niedrig bei alten');
    w.localStorage.setItem('eve-zentrale-radar-v1', JSON.stringify({ sys: 'Jita', auto: 5, last: { id: 1, name: 'Jita', r: 1, dep: { 30002813: 1 }, t: now, win: 1, n: 1, camps: rc } }));
    w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ navMode: 'radar' }));
    const rb = w.document.createElement('div'); T.ovRenderViewInto('route', rb);
    assert(rb.querySelector('a[href="https://zkillboard.com/kill/77/"]') && rb.querySelector('a[href="https://zkillboard.com/character/9001/"]') && rb.querySelector('.rad-r .d .olb i') && rb.querySelector('[data-ova="radarAuto"][data-arg="5"][aria-pressed="true"]'), 'T16: Overlay zeigt Kill-/Pilot-Links, Gefahr-Balken und Auto-Intervall');
    // U9: Radar als grosse Seite im Hauptfenster
    w.document.getElementById('neo-btn-radar').click();
    const rp = w.document.getElementById('radar-page');
    assert(w.document.getElementById('panel-radar').classList.contains('active') && rp.querySelector('a[href="https://zkillboard.com/kill/77/"]'), 'U9: Radar-Knopf im OmniCom oeffnet die Radar-Seite mit den Camps');
    rp.querySelector('[data-ova="radarSort"][data-arg="near"]').click(); await new Promise(r => setTimeout(r, 50));
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-radar-v1')).sort === 'near' && rp.querySelector('[data-ova="radarSort"][data-arg="near"][aria-pressed="true"]'), 'U9: Bedienung auf der Seite wirkt (Sortierung)');
    w.localStorage.removeItem('eve-zentrale-overlay-v1'); w.fetch = () => Promise.reject(new Error('offline'));
    // T19: Notizblock
    const nb = () => { const b = w.document.createElement('div'); T.ovRenderViewInto('notiz', b); return b; };
    let nx = nb();
    assert(nx.querySelectorAll('.nt-tabs [data-ova="noteSel"]').length === 1 && nx.querySelector('textarea[data-ov-save="noteText"]'), 'T19: eine leere Notiz zum Start');
    T.ovSatAction('notiz', { type: 'noteText', arg: 'n1', text: 'Jita 4-4 Fitting' });
    T.ovSatAction('notiz', { type: 'noteNew' });
    nx = nb(); let nid = nx.querySelector('.nt-tabs [aria-pressed="true"]').getAttribute('data-arg');
    T.ovSatAction('notiz', { type: 'noteRen', arg: nid, form: { ['noteName-' + nid]: 'Einkauf' } });
    let NS = JSON.parse(w.localStorage.getItem('eve-zentrale-notes-v1'));
    assert(NS.list.length === 2 && NS.list[0].text === 'Jita 4-4 Fitting' && NS.list[1].name === 'Einkauf' && NS.cur === nid, 'T19: Text gespeichert, neue Notiz angelegt und umbenannt');
    T.ovSatAction('notiz', { type: 'noteDel', arg: nid });
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-notes-v1')).list.length === 2 && /Wirklich/.test(nb().textContent), 'T19: Löschen fragt erst nach');
    T.ovSatAction('notiz', { type: 'noteDel', arg: nid });
    NS = JSON.parse(w.localStorage.getItem('eve-zentrale-notes-v1'));
    assert(NS.list.length === 1 && NS.cur === 'n1' && /Jita 4-4/.test(nb().querySelector('textarea').value), 'T19: zweiter Klick löscht, erste Notiz wieder offen');
    // T20: Leistung – im Browser nur Serverstatus, im Programm Ping-Kurve und CPU/RAM
    let pb = w.document.createElement('div'); T.ovRenderViewInto('leistung', pb);
    assert(/Downtime in/.test(pb.textContent) && pb.querySelector('[data-ov-until][data-ov-long]') && /nur im Programm/.test(pb.textContent), 'T20: Serverstatus + Hinweis ohne Programm');
    const dt = Number(pb.querySelector('[data-ov-until]').getAttribute('data-ov-until'));
    assert(new Date(dt).getUTCHours() === 11 && dt > Date.now() && dt - Date.now() <= 864e5, 'T20: Downtime ist der nächste 11:00-UTC-Zeitpunkt');
    // U13/V1/V3: EVE-Stand aus Last-Modified, neu ab aus Expires; älteste Zeit mehrerer Abfragen; Uhrzeit-Modus
    const hd = o => ({ ok: true, headers: { get: k => o[k] || null } });
    const LM1 = Date.UTC(2026, 8, 26, 12, 30), LM2 = Date.UTC(2026, 8, 26, 12, 32), EX = Math.ceil((Date.now() + 5 * 60000) / 1000) * 1000;
    T.esiStampRec('https://esi.evetech.net/characters/1/wallet/', hd({ 'last-modified': new Date(LM2).toUTCString(), expires: new Date(EX).toUTCString() }));
    T.esiStampRec('https://esi.evetech.net/characters/2/wallet/', hd({ 'last-modified': new Date(LM1).toUTCString(), expires: new Date(EX + 60000).toUTCString() }));
    const loc = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    assert(T.esiStandTxt(['/characters/wallet']) === 'EVE-Stand ' + loc(LM1) + ' · neu ab ' + loc(EX), 'U13: EVE-Stand = älteste Zeit, neu ab = früheste: ' + T.esiStandTxt(['/characters/wallet']));
    { const f = T.ovFootText('wallet'); assert(f.cd && f.cd.length === 1 && f.cd[0][0] === 'Wallet' && f.cd[0][1] > 0 && !/EVE-Stand/.test(f.age) && T.esiStandTxt(['/characters/assets']) === '', 'II3: Wallet-Overlay zählt bis „neu ab“ herunter (statt EVE-Stand-Uhrzeit), andere Bereiche nicht'); }
    w.localStorage.setItem('eve-zentrale-timemode-v1', 'eve');
    assert(T.fmtT(LM1) === '12:30 EVE', 'V1: EVE-Zeit (UTC)');
    w.localStorage.setItem('eve-zentrale-timemode-v1', 'both');
    assert(T.fmtT(LM1, false, true) === loc(LM1) + ' · EVE 12:30' && T.fmtT(LM1) === loc(LM1), 'V1: beides nur bei der Uhr oben, Datenstand-Zeiten (BB28) eine Zone');
    w.localStorage.removeItem('eve-zentrale-timemode-v1');
    assert(w.document.getElementById('set-timemode') && w.document.getElementById('esi-stand'), 'V1/V3: Einstellung Uhrzeit + Anzeige oben');
    console.log('\nALL WUENSCHE-S TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
