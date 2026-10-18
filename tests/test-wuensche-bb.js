// Patch BB (28.09.2026): BB8 Beta-Namen, weitere BB-Punkte folgen hier
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra, host){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = () => Promise.reject(new Error('offline'));
      if (host) w.evecoreHost = host;
    }
  }).window;
}
(async () => {
  try{
    // ---------- BB8 Beta ----------
    assert(/^<title>EVE Omni Beta<\/title>/.test(src) && /<h1>EVE Omni<\/h1><span class="beta-tag">Beta<\/span>/.test(src), 'BB8: Titel + Kopfzeile mit Beta');
    const sums = src.match(/<summary>[^<]*\d+\.\d+[^<]*·[^<]*<\/summary>/g) || [];
    assert(sums.length > 20 && sums.every(x => /<summary>Beta \d/.test(x)), 'BB8: alle Patchnotes-Versionen heißen Beta x.y');
    assert(/tray\.setToolTip\((T\()?'EVE Omni Beta ' \+ app\.getVersion\(\)/.test(main), 'BB8: Taskleisten-Tooltip mit Beta + Version');
    let w = makeWindow(); await tick(500);
    let d = w.document;
    assert(/^EVE Omni Beta \d+\.\d+\.\d+$/.test(d.getElementById('ver-html').textContent) && /^Beta \d+\.\d+\.\d+$/.test(d.getElementById('set-ver').textContent), 'BB8: Versionsanzeige ' + d.getElementById('ver-html').textContent);
    w.close();

    // ---------- BB9 Trades-Karten zusammenklappbar ----------
    const now = Date.now();
    const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active' },
                { id: 't2', tid: 35, name: 'Pyerite', hub: 'jita', charId: 111, charName: 'Eins', qty: 50, buy: 8, sell: 10, unit: 1, created: now - 7200e3, status: 'active' }];
    const LOGIN = { 'eve-zentrale-characters': JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]) };
    w = makeWindow(Object.assign({ 'eve-zentrale-trades-v1': JSON.stringify(TR) }, LOGIN));
    await tick(600); d = w.document;
    let T = w.__test;
    const view = (id) => { const b = d.createElement('div'); T.ovRenderViewInto(id || 'trades', b); return b; };
    let b = view();
    assert(b.querySelectorAll('.ov-card .ov-h[data-ova="trFold"]').length === 2 && !b.querySelector('.ov-card.tr-fold') && b.querySelector('[data-ova="trFoldAll"][data-arg="zu"]'), 'BB9: Overlay – Kopf klickbar, anfangs offen, Knopf alle zu/auf');
    T.ovSatAction('trades', { type: 'trFold', arg: 't1' });
    b = view();
    const c1 = b.querySelector('.ov-card[data-bk="Trade:t1"]');
    assert(c1.classList.contains('tr-fold') && !b.querySelector('.ov-card[data-bk="Trade:t2"]').classList.contains('tr-fold'), 'BB9: Klick auf den Kopf klappt nur diese Karte zu');
    assert(c1.querySelectorAll(':scope > .ov-keep').length === 2 && c1.querySelector('.ov-h .tsc-cp-b'), 'BB9: zugeklappt bleiben Stand + Gewinn, Kopieren am Namen');
    assert(/^Jita · Stand|^Jita · Preise/.test(c1.querySelector(':scope > .ov-keep').textContent), 'CC3: zugeklappt steht auch das System (' + c1.querySelector(':scope > .ov-keep').textContent + ')');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1')).trFold.t1 === true, 'BB9: Zustand in eve-zentrale-overlay-v1 gemerkt');
    const tc = d.querySelector('#trades-list .tr-card[data-bk="Trade:t1"]');
    assert(tc && tc.classList.contains('tr-fold'), 'BB9: große Seite „Meine Trades“ nutzt denselben Zustand');
    d.querySelector('#trades-list .tr-card[data-bk="Trade:t2"] .tr-head').click();
    assert(d.querySelector('#trades-list .tr-card[data-bk="Trade:t2"]').classList.contains('tr-fold') && view().querySelector('.ov-card[data-bk="Trade:t2"]').classList.contains('tr-fold'), 'BB9: Klick auf der großen Seite klappt auch im Overlay zu');
    d.querySelector('#trades-list .tr-card[data-bk="Trade:t2"] .tr-head .tsc-cp-b').click();
    assert(d.querySelector('#trades-list .tr-card[data-bk="Trade:t2"]').classList.contains('tr-fold'), 'BB9: Kopieren klappt nicht um');
    T.ovSatAction('trades', { type: 'trFoldAll', arg: 'auf' });
    assert(!view().querySelector('.tr-fold') && !d.querySelector('#trades-list .tr-fold'), 'BB9: alle auf');
    T.ovSatAction('trades', { type: 'trFoldAll', arg: 'zu' });
    assert(view().querySelectorAll('.ov-card.tr-fold').length === 2, 'BB9: alle zu');
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(css.includes('.ov-card.tr-fold>:not(.ov-h):not(.ov-keep):not(.hc-box){display:none}'), 'BB9: CSS blendet den Rest aus, Preisverlauf bleibt');
    w.close();

    // ---------- BB3 Skill-Alarm je Charakter ----------
    const iso = t => new Date(t).toISOString();
    const CH2 = [{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' },
                 { access_token: 'b', refresh_token: 'r', expires_at: now + 36e5, character_id: '222', character_name: 'Zwei' }];
    const Q = { 111: [], 222: [{ skill_id: 3300, finished_level: 4, queue_position: 0, start_date: iso(now - 36e5), finish_date: iso(now + 3 * 864e5), level_start_sp: 0, level_end_sp: 1000, training_start_sp: 0 }] };
    w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){
        w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH2));
        w.fetch = (url, o) => { const u = String(url), ok = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) }); let m;
          if ((m = u.match(/\/characters\/(\d+)\/skillqueue\//))) return ok(Q[m[1]]);
          if (/\/characters\/\d+\/skills\//.test(u)) return ok({ skills: [], total_sp: 1e6 });
          if (/\/characters\/\d+\/attributes\//.test(u)) return ok({});
          return Promise.reject(new Error('offline')); };
      } }).window;
    await tick(600); d = w.document; T = w.__test;
    await T.refreshSkills(); await tick(100);
    const neo = () => d.getElementById('neo-btn-skills');
    assert(T.sqAlarmAll() === 'red' && neo().classList.contains('sk-red'), 'BB3: vorher – Eins (leer) blinkt rot');
    const ovSk = () => view('skills');
    assert(ovSk().querySelectorAll('[data-ova="skAlarm"]').length === 2 && d.querySelectorAll('.sq-card [data-ska]').length === 2, 'BB3: Glocke je Charakter an der Skill-Karte (groß + Overlay)');
    assert(d.querySelectorAll('#sso-ska-chars input:checked').length === 2, 'BB3: Einstellungen › Charaktere – Haken je Charakter, anfangs an');
    T.ovSatAction('skills', { type: 'skAlarm', arg: '111' });
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-skillalarm-v1')).off.join() === '111', 'BB3: Schlüssel eve-zentrale-skillalarm-v1 {off:[111]}');
    assert(T.sqAlarmAll() === 'yellow' && !neo().classList.contains('sk-red') && neo().classList.contains('sk-yellow'), 'BB3: Eins aus → Zwei (endet < 1 Woche) blinkt weiter gelb');
    const c1b = d.querySelector('.sq-card[data-char="111"]');
    assert(!/sq-alert|sq-warn|sk-red|sk-yellow/.test(c1b.className) && /Alarm aus/.test(c1b.textContent) && d.querySelector('.sq-card[data-char="222"]').classList.contains('sk-yellow'), 'BB3: Karte ohne Rot/Gelb, grauer Hinweis „Alarm aus“; Charakter bleibt sichtbar');
    const o1 = ovSk().querySelector('[data-ova="skAlarm"][data-arg="111"]').closest('.ov-card');
    assert(o1 && !/ bad| warnc|sk-red/.test(o1.className) && /Alarm aus/.test(o1.textContent), 'BB3: Overlay-Karte ebenso');
    assert(!d.querySelector('#sso-ska-chars input[type=checkbox]').checked && !/sk-red/.test(T.neoOverlayHtml()) && /sk-yellow/.test(T.neoOverlayHtml()), 'BB3: Haken in den Einstellungen aus, OmniCom-Overlay nicht mehr rot');
    d.querySelector('.sq-card[data-char="222"] [data-ska]').click();
    assert(T.sqAlarmAll() === '' && !neo().classList.contains('sk-yellow'), 'BB3: beide aus → kein Blinken');
    d.querySelector('#sso-ska-chars input').click();
    assert(T.sqAlarmAll() === 'red', 'BB3: Haken in den Einstellungen schaltet wieder ein');
    w.close();

    // ---------- BB7 Titelleiste eigene Deckkraft ----------
    w = makeWindow(); await tick(500); d = w.document; T = w.__test;
    assert(T.ovLoad().barAlpha === 1, 'BB7: Standard Titelleiste 100 %');
    const ba = d.getElementById('ovs-baralpha');
    assert(ba && ba.value === '1' && d.getElementById('ovs-baralpha-v').textContent === '100 %', 'BB7: Regler „Deckkraft Titelleiste“ unter Einstellungen › Overlay');
    ba.value = '0.6'; ba.dispatchEvent(new w.Event('input'));
    const rs = d.documentElement.style;
    assert(T.ovLoad().barAlpha === 0.6 && rs.getPropertyValue('--ov-bar-alpha') === '0.6' && T.ovLook().barAlpha === 0.6, 'BB7: Wert in eve-zentrale-overlay-v1, CSS-Variable gesetzt, geht an die Einzelfenster');
    d.getElementById('ovs-alpha').value = '0.4'; d.getElementById('ovs-alpha').dispatchEvent(new w.Event('input'));
    assert(rs.getPropertyValue('--ov-alpha') === '0.4' && rs.getPropertyValue('--ov-bar-alpha') === '0.6', 'BB7: Inhalt-Deckkraft ändert die Leiste nicht');
    const css7 = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(css7.includes('html.ov-eve #ov-root > .ov-bar{background:linear-gradient(rgba(255,255,255,.035), rgba(255,255,255,.035)), rgba(9,11,14,var(--ov-bar-alpha, 1))}') && css7.includes('html.ov-eve:not(.sat-neo) #ov-root:has(> .ov-bar){background:none}'), 'BB7: Leiste nutzt --ov-bar-alpha, Grund nur unter dem Inhalt');
    assert(/"--ov-bar-alpha", String\(Number\(L\.barAlpha\) \|\| 1\)/.test(src), 'BB7: Einzelfenster übernehmen die Leisten-Deckkraft');
    w.close();

    // ---------- BB5 Karten-Overlay: nur Hintergrund durchsichtig ----------
    w = makeWindow(); await tick(500); d = w.document; T = w.__test;
    assert(T.ovLoad().mapBgAlpha === undefined && !d.documentElement.style.getPropertyValue('--map-bg-alpha'), 'BB5: Standard wie heute (folgt dem Fenster)');
    T.ovSetMode('compact'); let o5 = T.ovLoad(); o5.view = 'trades'; T.ovSave(o5); T.ovRender();
    d.getElementById('ov-settings').click();
    assert(d.getElementById('ovm-mapbg-r').hidden, 'BB5: Regler „Karten-Hintergrund“ nur bei der Karte');
    d.getElementById('ov-settings').click();
    o5 = T.ovLoad(); o5.views.forEach(v => { if (v.id === 'karte') v.on = true; }); o5.view = 'karte'; T.ovSave(o5); T.ovRender();
    d.getElementById('ov-settings').click();
    const mr = d.getElementById('ovm-mapbg');
    assert(!d.getElementById('ovm-mapbg-r').hidden && mr.value === String(T.ovLoad().alpha), 'BB5: Zahnrad der Karte zeigt den Regler, Start = Fenster-Deckkraft');
    mr.value = '0.15'; mr.dispatchEvent(new w.Event('input'));
    assert(T.ovLoad().mapBgAlpha === 0.15 && d.documentElement.style.getPropertyValue('--map-bg-alpha') === '0.15' && T.ovLook().mapBgAlpha === 0.15 && d.getElementById('ovm-mapbg-v').textContent === '15 %', 'BB5: mapBgAlpha in eve-zentrale-overlay-v1, CSS-Variable, geht an das Karten-Einzelfenster');
    T.ovSatAction('karte', { type: 'mapBgAlpha', v: 0 });
    assert(T.ovLoad().mapBgAlpha === 0, 'BB5: 0 % erlaubt (nur die Karte ganz durchsichtig)');
    const css5 = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(css5.includes('html.ov-eve:not(.sat-neo) #ov-root:has(> .ov-bar) > .ov-body:has(> .ov-map){background:rgba(9,11,14,var(--mbg))}') && /--mtop:max\(0, calc\(\(var\(--ov-alpha, 1\) - var\(--mbg\)\)/.test(css5), 'BB5: Grund hinter der Karte nach --map-bg-alpha, Leisten bleiben bei der Fenster-Deckkraft');
    assert(/lookMapBg = typeof L\.mapBgAlpha === "number"/.test(src) && /mapBg: function\(v\)\{ lookMapBg = v; H\.satAction\(\{ type: "mapBgAlpha"/.test(src), 'BB5: Einzelfenster Karte – Regler im Zahnrad, Wert kommt zurück');
    w.close();

    // ---------- AA4 Order-Ablauf-Wächter ----------
    w = makeWindow(Object.assign({ 'eve-zentrale-trades-v1': JSON.stringify(TR) }, LOGIN)); await tick(500); d = w.document; T = w.__test;
    const ok = (j) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(j) });
    w.fetch = (url) => /\/skills\//.test(url) ? ok({ skills: [{ skill_id: 3443, trained_skill_level: 5 }, { skill_id: 3444, trained_skill_level: 4 }, { skill_id: 16596, trained_skill_level: 1 }] })
      : /\/universe\/names|\/types\//.test(url) ? ok({ name: 'Tritanium' }) : Promise.reject(new Error('offline'));
    assert(T.oxLeft(-5) === 'abgelaufen' && T.oxLeft(2 * 36e5 + 5 * 6e4) === '2 Std 5 Min' && T.oxLeft(3 * 864e5 + 4 * 36e5) === '3 T 4 Std' && T.oxLeft(9 * 6e4) === '9 Min', 'AA4: Restzeit-Text');
    assert(T.oxCls(2 * 36e5) === 'bad' && T.oxCls(10 * 36e5) === 'warn' && T.oxCls(30 * 36e5) === '', 'AA4: rot unter 3 Std, gelb unter 24 Std');
    const isoIn = (ms) => new Date(Date.now() + ms).toISOString();
    // Ablauf = issued + duration (Tage)
    const OD = [{ order_id: 1, type_id: 34, is_buy_order: false, price: 10, volume_remain: 100, volume_total: 100, issued: isoIn(-90 * 864e5 + 2 * 36e5), duration: 90 },
                { order_id: 2, type_id: 35, is_buy_order: true, price: 5, volume_remain: 10, volume_total: 10, escrow: 40, issued: isoIn(-864e5 + 20 * 36e5), duration: 1 },
                { order_id: 3, type_id: 36, is_buy_order: false, price: 2, volume_remain: 50, volume_total: 50, issued: isoIn(-864e5), duration: 30 }];
    T.oxFeed('111', 'Eins', OD); await tick(150);
    let ox = T.oxLoad();
    assert(ox.pre === 3 && ox.ch['111'].o.length === 3 && ox.ch['111'].sell === 1100 && ox.ch['111'].esc === 40, 'AA4: Orders je Charakter in eve-zentrale-orderexp-v1 (Verkaufswert, Treuhand)');
    assert(ox.ch['111'].max === 5 + 20 + 32 + 16, 'AA4: Slots aus Skills (Trade/Retail/Wholesale/Tycoon) = ' + ox.ch['111'].max);
    const sumTxt = d.getElementById('or-sum').textContent;
    assert(!d.getElementById('or-sum').hidden && /Eins3\/7370/.test(sumTxt.replace(/\s/g, '')), 'AA4: Kopf auf der Orders-Seite: Slots belegt/gesamt, frei');
    let notes = []; w.evecoreHost = null;
    const sOv = T.ovLoad(); sOv.notify = true; sOv.sound = false; T.ovSave(sOv);
    w.Notification = function(t, o){ notes.push(t + '|' + o.body); }; w.Notification.permission = 'granted';
    let n = await T.oxCheck();
    assert(notes.length === 1 && /Order läuft bald ab\|.*\(Verkauf, Eins\) – in [12] Std/.test(notes[0]), 'AA4: Windows-Meldung ' + notes[0]);
    assert(n === 1 && T.oxLoad().warned['1'] && !T.oxLoad().warned['2'], 'AA4: 3 Std Vorwarnung – nur die Order unter 3 Std meldet sich');
    assert(await T.oxCheck() === 0, 'AA4: jede Order nur einmal');
    d.getElementById('ovs-oxpre').value = '24'; d.getElementById('ovs-oxpre').dispatchEvent(new w.Event('change'));
    assert(T.oxLoad().pre === 24 && await T.oxCheck() === 1 && T.oxLoad().warned['2'], 'AA4: Vorwarnzeit 24 Std erfasst die Kauforder');
    T.oxFeed('111', 'Eins', [OD[2]]); await T.oxCheck();
    assert(!T.oxLoad().warned['1'] && !T.oxLoad().warned['2'], 'AA4: verschwundene Orders werden vergessen');
    // Orders-Tabelle, Karten
    T.trLiveSet('t1', { types: { buys: [], sells: [] }, own: { sell: OD[0], buy: null }, time: Date.now() });
    assert(/läuft ab in 1 Std 5\d Min|läuft ab in 2 Std 0 Min/.test(T.oxTrade('t1')) && /class="ox-t bad"/.test(T.oxTrade('t1')), 'AA4: Trade-Karte zeigt „läuft ab in …“ rot');
    T.trLiveSet('t2', { types: { buys: [], sells: [] }, own: { sell: OD[2] }, time: Date.now() });
    assert(T.oxTrade('t2', true) === '' && /läuft ab in 2[89] T/.test(T.oxTrade('t2')), 'AA4: kleine Watchlist-Karte nur unter 24 Std');
    let bt = view('trades');
    assert(/läuft ab in/.test(bt.textContent), 'AA4: Trades-Overlay zeigt den Ablauf');
    bt = view('track');
    assert((bt.textContent.match(/läuft ab in/g) || []).length === 1, 'AA4: Watchlist-Overlay zeigt nur den bald ablaufenden Trade');
    assert(/rfNotify\(title, body, kind\)/.test(src) && /alCfg\(kind \|\| "pi"\)/.test(src), 'AA4: Meldung nutzt Trade-Alarm (Ton/Windows-Meldung)');
    w.close();
    // Orders-Seite (gespeicherte Liste) + Wallet-Overlay mit Slots
    w = makeWindow(Object.assign({
      'eve-zentrale-listcache-v1': JSON.stringify({ orders: { t: Date.now(), d: { a: [Object.assign({ _charName: 'Eins', _typeName: 'Tritanium', _locName: 'Jita' }, OD[0])], h: [] } } }),
      'eve-zentrale-orderexp-v1': JSON.stringify({ pre: 3, ch: { '111': { name: 'Eins', o: [[1, 0, 34, 0, ''], [3, 0, 36, 0, '']], sell: 0, esc: 0, max: 73, maxT: Date.now() } } }),
      'eve-zentrale-ovwallet-v1': JSON.stringify({ t: Date.now(), list: [{ id: '111', name: 'Eins', bal: 1000, sell: 200, sellN: 1, escrow: 0, buyN: 0, d24: null }], j: [] })
    }, LOGIN)); await tick(600); d = w.document; T = w.__test;
    const td = d.querySelector('#or-active-body td[data-ox]');
    assert(td && td.lastChild.className === 'ox-t bad' && /^in [12] Std/.test(td.lastChild.textContent), 'AA4: Orders-Tabelle „Läuft ab“ mit Restzeit, rot unter 3 Std');
    const bw = d.createElement('div'); T.ovRenderViewInto('wallet', bw);
    assert(/Order-Slots2 \/ 73 \(71 frei\)/.test(bw.textContent) && /Slots2 \/ 73Gesamt/.test(bw.textContent), 'AA4: Wallet-Overlay zeigt Slots (Summe + je Charakter)');
    w.close();

    // ---------- AA11 D-Scan ----------
    const DSCAN = ['11379\tCaracal von Bob\tCaracal\t1.234 km', '11379\tNoch einer\tCaracal\t15 AE', '22456\tSabre\tSabre\t2,500 km', '11172\tHelios\tHelios\t-',
                   '35832\tAstrahus\tAstrahus\t5 AU', '2488\tWarrior II\tWarrior II\t800 m', '670\tKapsel\tCapsule\t900 m'].join('\n');
    const lld = new Function(main.match(/function looksLikeDscan[\s\S]*?\n}\n/)[0] + 'return looksLikeDscan;')();
    assert(lld(DSCAN) && !lld('Bob Pilot\nAlice Pilot') && !lld('Tritanium\t1000\nPyerite\t50'), 'AA11: Programm erkennt D-Scan (nicht Local, nicht Inventar)');
    assert(main.indexOf("if (looksLikeDscan(t)){ if (S.localWatch) send({ type: 'dscanPaste'") < main.indexOf('if (looksLikeAppraisal(t))') && /dscan: 'D-Scan'/.test(main), 'AA11: D-Scan geht vor Wertschätzer, eigenes Einzelfenster');
    const TG = { 11379: 358, 22456: 541, 11172: 830, 35832: 1657, 2488: 100, 670: 29 }, GR = { 358: ['Kreuzer', 6], 541: ['Interdictor', 6], 830: ['Covert Ops', 6], 1657: ['Citadel', 65], 100: ['Kampfdrohne', 18], 29: ['Kapsel', 6] };
    let esiCalls = 0;
    const dsFetch = (url) => { esiCalls++; let m = url.match(/\/universe\/types\/(\d+)\//); if (m) return ok({ group_id: TG[m[1]] });
      m = url.match(/\/universe\/groups\/(\d+)\//); if (m) return ok({ name: GR[m[1]][0], category_id: GR[m[1]][1] }); return Promise.reject(new Error('offline')); };
    let shown = [];
    w = makeWindow({}, { showView: v => shown.push(v), setSettings: () => Promise.resolve(), getSettings: () => Promise.resolve({}) }); await tick(500); d = w.document; T = w.__test;
    w.fetch = dsFetch;
    const pr = T.dsParse(DSCAN);
    assert(pr.length === 7 && pr[0].grid && !pr[1].grid && pr[2].grid && !pr[3].grid && pr[5].grid, 'AA11: Grid = km/m bis 10.000 km, AU/AE und „-“ außerhalb');
    await T.dsFromText(DSCAN, true); await tick(100);
    let L = T.dsLoad().last;
    assert(L && L.ships === 5 && L.gridShips === 3, 'AA11: 5 Schiffe (Kapsel zählt), 3 auf Grid');
    assert(L.warn.map(x => x.label + x.n + '/' + x.g).join('|') === 'Bubble (Dictor/HIC)1/1|Cloaky1/0', 'AA11: Warnungen Dictor (auf Grid) und Cloaky');
    assert(L.grid.map(c => c.name + c.n).join(',') === 'Interdictor1,Kreuzer1,Kapsel1,Drohnen1' && L.off.map(c => c.name + c.n).join(',') === 'Covert Ops1,Kreuzer1,Strukturen1', 'AA11: Klassen je Grid – Warnklassen, Schiffe, dann Strukturen/Drohnen');
    assert(/^D-Scan \d\d:\d\d: 5 Schiffe \(3 auf Grid\) – Warnung: 1× Bubble \(Dictor\/HIC\), 1× Cloaky – 2× Caracal, 1× Sabre, 1× Helios, 1× Capsule – 1 Drohnen, 1 Strukturen$/.test(L.sum), 'AA11: kopierbare Zusammenfassung ' + L.sum);
    assert(shown.join() === 'dscan', 'AA11: Programm öffnet das D-Scan-Fenster von selbst');
    const n1 = esiCalls; await T.dsRun(DSCAN);
    assert(esiCalls === n1 && T.dsLoad().g['11379'] === 358, 'AA11: Typ-Gruppen zwischengespeichert (eve-zentrale-dscan-v1)');
    const bd = d.createElement('div'); T.ovRenderViewInto('dscan', bd);
    assert(/Bubble \(Dictor\/HIC\)/.test(bd.querySelector('.ds-warn').textContent) && bd.querySelectorAll('.ds-c').length === 7 && bd.querySelector('[data-ova="dsCopy"]'), 'AA11: Overlay-Ansicht dscan mit Warnungen, Klassen, Kopieren');
    T.switchTab('intel'); T.ovRender();
    assert(d.querySelectorAll('#ds-page .ds-c').length === 7, 'AA11: Hauptfenster Intel › D-Scan');
    await T.dsAction({ type: 'dsSound' }); assert(T.dsLoad().sound === true, 'AA11: Ton an/aus');
    await T.dsFromText('Bob Pilot\nAlice', false);
    assert(/kein D-Scan/.test(d.querySelector('#ds-page').textContent), 'AA11: Hinweis bei falscher Zwischenablage');
    w.close();

    // ---------- Z5 Einklappen per Doppelklick ----------
    const satWin = (view, st) => {
      const Z = { mini: [], drag: [] };
      const zw = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test?fenster=' + view, pretendToBeVisual:true,
        beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline'));
          x.evecoreHost = { getSettings: () => Promise.resolve(st), setSettings: q => Promise.resolve(st), onCommand(cb){ Z.cmd = cb; }, ready(){}, satAction(){}, closeSelf(){}, resizeTo(){}, resizeEnd(){},
            satMini: h => Z.mini.push(h), satDrag: ph => Z.drag.push(ph) }; } }).window;
      return { zw, Z };
    };
    let { zw, Z } = satWin('wallet', { windows: { wallet: { rolled: true } } }); await tick(400);
    let zd = zw.document;
    assert(zd.documentElement.classList.contains('sat-selfdrag') && zd.documentElement.classList.contains('sat-rolled'), 'Z5: Wallet-Fenster zieht selbst und startet eingeklappt (gemerkt)');
    zd.getElementById('ov-bar').dispatchEvent(new zw.MouseEvent('dblclick', { bubbles: true }));
    assert(Z.mini.length === 1 && typeof Z.mini[0] === 'number', 'Z5: Doppelklick auf die Leiste schickt Einklappen mit Leistenhöhe');
    zd.getElementById('ov-refresh').dispatchEvent(new zw.MouseEvent('dblclick', { bubbles: true }));
    assert(Z.mini.length === 1, 'Z5: Doppelklick auf einen Knopf klappt nicht ein');
    Z.cmd({ type: 'settings', settings: { windows: { wallet: { rolled: false } } } });
    assert(!zd.documentElement.classList.contains('sat-rolled'), 'Z5: ausgeklappt zeigt wieder den Inhalt');
    assert(/html\.sat-rolled #ov-root > :not\(\.ov-bar\)\{display:none!important\}/.test(src), 'Z5: eingeklappt nur die Leiste');
    zw.close();
    for (const v of ['neocom', 'alarm']){
      ({ zw, Z } = satWin(v, { windows: { [v]: { rolled: true } } })); await tick(300); zd = zw.document;
      zd.getElementById('ov-bar').dispatchEvent(new zw.MouseEvent('dblclick', { bubbles: true }));
      assert(!Z.mini.length && !zd.documentElement.classList.contains('sat-rolled') && !zd.documentElement.classList.contains('sat-selfdrag'), 'Z5: Ausnahme ' + v);
      zw.close();
    }
    // main.js: Hoehe umschalten, Mindestgroesse, gemerkter Zustand
    const zS = { windows: {} }, bw0 = { x: 10, y: 20, width: 320, height: 400 }, calls = [];
    const fakeW = { b: Object.assign({}, bw0), isDestroyed: () => false, getBounds(){ return Object.assign({}, this.b); }, setBounds(b){ this.b = Object.assign({}, b); },
      setMinimumSize: (a, b) => calls.push('min' + b), setResizable: r => calls.push('res' + r) };
    const zm = new Function('S', 'sats', 'saveSettings', 'pushSettings', 'JB_MINI_H',
      main.match(/const SAT_MIN = [^\n]*\n/)[0] + main.match(/const SAT_NOROLL[\s\S]*?\n}\n/)[0] + main.match(/function satRollApply[\s\S]*?\n}\n/)[0] + 'return satMiniToggle;');
    const tog = zm(zS, { wallet: fakeW, neocom: fakeW }, () => {}, () => {}, 84);
    tog('wallet', 27);
    assert(fakeW.b.height === 27 && fakeW.b.width === 320 && fakeW.b.y === 20 && zS.windows.wallet.rolled && zS.windows.wallet.normalH === 400 && calls.join() === 'min27,resfalse', 'Z5: eingeklappt auf Leistenhöhe, Breite/Position bleiben, nicht aufziehbar');
    tog('wallet', 27);
    assert(fakeW.b.height === 400 && !zS.windows.wallet.rolled && calls.slice(2).join() === 'min100,restrue', 'Z5: nochmal = alte Höhe');
    tog('neocom', 27); assert(fakeW.b.height === 400 && !zS.windows.neocom, 'Z5: OmniCom klappt nicht ein');
    assert(/if \(cfg\.rolled\)\{ satRollApply\(w, id, cfg\)/.test(main), 'Z5: Zustand nach Neustart');

    // ---------- Z1 Schloss, Strg + Mausrad, OmniCom-Menue ----------
    {
      const Z = { set: [], act: [] }; let st = { alwaysOnTop: true, windows: { wallet: { lock: false } } };
      const zw1 = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test?fenster=wallet', pretendToBeVisual:true,
        beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline'));
          x.evecoreHost = { getSettings: () => Promise.resolve(st), setSettings: q => { Z.set.push(q); st = { alwaysOnTop: true, windows: { wallet: Object.assign({}, st.windows.wallet, (q.windows || {}).wallet) } }; return Promise.resolve(st); },
            onCommand(cb){ Z.cmd = cb; }, ready(){}, satAction: a => Z.act.push(a), closeSelf(){}, resizeTo(){}, resizeEnd(){}, satMini(){}, satDrag(){} }; } }).window;
      await tick(400);
      const zd1 = zw1.document, lk = zd1.getElementById('ov-lock');
      assert(lk && lk.getAttribute('aria-pressed') === 'false' && (lk.nextElementSibling.id === 'ov-hide' || (lk.nextElementSibling.id === 'ov-roll' && lk.nextElementSibling.nextElementSibling.id === 'ov-hide')), 'Z1: Schloss-Knopf neben ✕ (AF5: im Stil EVE „—“ dazwischen), offen');
      lk.click(); await tick(50);
      assert(Z.set.pop().windows.wallet.lock === true && lk.getAttribute('aria-pressed') === 'true' && lk.textContent.codePointAt(0) === 0x1F512, 'Z1: Klick sperrt Position + Größe, Symbol zu');
      lk.click(); await tick(50);
      assert(Z.set.pop().windows.wallet.lock === false && lk.getAttribute('aria-pressed') === 'false', 'Z1: nochmal = frei');
      assert(zd1.getElementById('ov-pin'), 'Z1: Knopf „Immer im Vordergrund“ in der Leiste');
      Z.cmd({ type: 'view', data: { title: 'Wallet', html: '<div class="ov-card">x</div>', foot: {}, look: { alpha: 0.8 } } }); await tick(50);
      // 06.10.: Deckkraft per Strg + Mausrad entfernt (Nutzer) – im Overlay passiert nichts, auch kein Chromium-Zoom
      const cw = new zw1.WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }); zd1.dispatchEvent(cw);
      assert(cw.defaultPrevented && !Z.act.some(x => x.type === 'alpha') && zd1.documentElement.style.getPropertyValue('--ov-alpha') === '0.8', 'Z1: Strg + Mausrad im Overlay ändert die Deckkraft nicht mehr');
      const ev = new zw1.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); zd1.dispatchEvent(ev);
      assert(!ev.defaultPrevented, 'Z1: ohne Strg normal scrollen');
      zw1.close();
      // Kompaktansicht im Hauptfenster
      const MS = { set: [] }; let ms = { windows: { main: {} } };
      const zw2 = makeWindow({}, { getSettings: () => Promise.resolve(ms), setSettings: q => { MS.set.push(q); if (q.windows) ms = { windows: { main: Object.assign({}, ms.windows.main, q.windows.main) } }; return Promise.resolve(ms); }, publishView(){}, onCommand(){}, ready(){}, setMode(){} });
      await tick(500); const T2 = zw2.__test;
      T2.ovSetMode('compact'); const a0 = T2.ovLoad().alpha;
      zw2.document.dispatchEvent(new zw2.WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
      assert(T2.ovLoad().alpha === a0 && zw2.document.documentElement.style.getPropertyValue('--ui-scale') === '1.1', 'JJ1: Strg + Mausrad in der Kompaktansicht = Zoom, nicht Deckkraft');
      zw2.document.getElementById('ov-lock').click(); await tick(50);
      assert(MS.set.some(q => q.windows && q.windows.main && q.windows.main.lock === true), 'Z1: Schloss in der Kompaktansicht sperrt das Hauptfenster');
      zw2.close();
      const menu = main.match(/function satMenu[\s\S]*?\n}\n/)[0];
      assert(/label: 'Durchklicken'[^\n]*HOTKEY_ACTIONS\.clickThrough\(\)/.test(menu) && /label: 'Immer im Vordergrund'/.test(menu) && /Position und Größe sperren/.test(menu) && /label: 'Hintergrund'/.test(menu), 'Z1: OmniCom-Rechtsklickmenü mit Sperren, Deckkraft, Durchklicken, Vordergrund');
    }

    // ---------- AA7 Skill-Nutzen-Rechner ----------
    {
      const now = Date.now(), D = 864e5;
      const PN = { tx: { a: [now - 2*D, 34, 1e6, 60, 0, 1], b: [now - 5*D, 35, 1e6, 40, 0, 1], c: [now - 3*D, 34, 1e6, 999, 1, 1], d: [now - 40*D, 34, 1e6, 999, 0, 1] },
                   fee: { f: [now - 1*D, 'b', 2.1e6], g: [now - 1*D, 't', 5e6], h: [now - 45*D, 'b', 9e9] }, ord: {}, upd: now };
      const aw = makeWindow(Object.assign({ 'eve-zentrale-pnl-v1-1': JSON.stringify(PN) }, LOGIN)); await tick(500);
      const A = aw.__test, ad = aw.document;
      assert(A.snSpFor(1, 5) === 256000 && A.snSpFor(2, 4) === 90510 && A.snSpFor(3, 1) === 750 && A.snInjSp(4e6) === 5e5 && A.snInjSp(9e7) === 1.5e5, 'AA7: SP je Stufe (Rang) und SP je Injektor');
      const sk = (acc, accSp, br, brSp) => ({ total_sp: 3e7, skills: [{ skill_id: 16622, trained_skill_level: acc, skillpoints_in_skill: accSp }, { skill_id: 3446, trained_skill_level: br, skillpoints_in_skill: brSp }] });
      const C1 = { id: 1, name: 'Händler', skills: sk(4, 135765, 3, 16000), attrs: { charisma: 20, memory: 20 } };
      const x = A.snCalc(C1);
      assert(x.sell === 1e8 && x.fb === 2.1e6, 'AA7: nur Verkäufe + Broker-Gebühren der letzten 30 Tage (' + x.sell + '/' + x.fb + ')');
      assert(x.rows.map(r => r.name + r.lvl).join() === 'Accounting5,Broker Relations4', 'AA7: nächste Stufe je Skill, größte Ersparnis zuerst');
      assert(Math.abs(x.rows[0].save - 825000) < 1 && Math.abs(x.rows[1].save - 300000) < 1, 'AA7: Accounting V spart 0,825 % vom Umsatz, BR IV 0,3 Punkte Broker (' + x.rows.map(r => r.save) + ')');
      assert(x.rows[0].need === 632235 && Math.abs(x.rows[0].ms - 632235 / 30 * 60000) < 1, 'AA7: Trainingszeit aus fehlenden SP und Charisma/Memory');
      const C2 = { id: 2, name: 'Neu', skills: sk(0, 0, 0, 0) }, C3 = { id: 1, name: 'Profi', skills: sk(5, 768000, 5, 512000) };
      assert(A.snCalc(C2).none && A.snCalc(C3).rows.length === 0, 'AA7: ohne Handelsdaten Hinweis, beide auf V = nichts mehr');
      A.sqSet([C1, C2]); A.snPageRender();
      const box = ad.getElementById('sn-page');
      assert(box.querySelectorAll('tbody tr').length === 2 && /Accounting V/.test(box.textContent) && /Standings/.test(box.textContent), 'AA7: Tabelle auf der Skills-Seite mit Standings-Hinweis');
      assert(box.querySelector('[data-sn-load="2"]') && /keine Handelsdaten/.test(box.textContent), 'AA7: Knopf „Aus EVE laden“ wenn keine Daten');
      const top = A.snTop(3);
      assert(top.length === 2 && top[0].who === 'Händler' && top[0].name === 'Accounting', 'AA7: Top-Liste über alle Charaktere');
      const ob = ad.createElement('div'); A.ovRenderViewInto('skills', ob);
      assert(/Lohnt sich.*Händler: Accounting V/.test(ob.textContent), 'AA7: Skills-Overlay zeigt „Lohnt sich“');
      aw.close();
    }

    // ---------- Z7 Uhr: Downtime-Alarm + eigene Timer ----------
    {
      const tw = makeWindow({}); await tick(500);
      const T = tw.__test, td = tw.document, N = [];
      tw.Notification = function(t, o){ N.push(t + '|' + o.body); }; tw.Notification.permission = 'granted';
      const base = Date.UTC(2026, 8, 28, 10, 50);
      assert(T.tmNextDt(base) === Date.UTC(2026, 8, 28, 11, 0) && T.tmNextDt(Date.UTC(2026, 8, 28, 11, 0)) === Date.UTC(2026, 8, 29, 11, 0), 'Z7: nächste Downtime 11:00 UTC, danach morgen');
      assert(T.tmNextAt('18:45', true, base) === Date.UTC(2026, 8, 28, 18, 45) && T.tmNextAt('9:00', true, base) === Date.UTC(2026, 8, 29, 9, 0) && T.tmNextAt('25:00', true, base) === null, 'Z7: Uhrzeit hh:mm, vorbei = morgen, Unsinn = null');
      // Alarm-Einstellungen Uhr: nur Desktop-Meldung
      td.getElementById('tma-notify').checked = true; td.getElementById('tma-notify').onchange.call(td.getElementById('tma-notify'));
      assert(T.tmLoad().dt.on === true && T.tmLoad().dt.pre === 5, 'Z7: Downtime-Alarm standardmäßig an, 5 Min. vorher');
      assert(T.tmTick(Date.UTC(2026, 8, 28, 10, 54)).length === 0, 'Z7: 6 Min. vorher noch nichts');
      const h1 = T.tmTick(Date.UTC(2026, 8, 28, 10, 55, 1));
      assert(h1.length === 1 && /Downtime in 5 Min/.test(h1[0]) && N.length === 1 && /EVE Omni: Uhr/.test(N[0]), 'Z7: Downtime 5 Min. vorher gemeldet (' + h1 + '|' + N + ')');
      assert(T.tmTick(Date.UTC(2026, 8, 28, 10, 57)).length === 0, 'Z7: Downtime nur einmal je Tag');
      T.tmAction({ type: 'tmAdd', form: { tmName: '', tmMode: 'min', tmVal: 'abc' } });
      assert(T.tmLoad().list.length === 0 && /Minuten als Zahl/.test(td.getElementById('tm-err').textContent), 'Z7: falsche Minuten = Hinweis, nichts angelegt');
      T.tmAction({ type: 'tmAdd', form: { tmName: 'Extraktor', tmMode: 'min', tmVal: '0,5' } });
      T.tmAction({ type: 'tmAdd', form: { tmName: 'Täglich', tmMode: 'deve', tmVal: '12:00' } });
      let L = T.tmLoad().list;
      assert(L.length === 2 && L[0].v === 0.5 && Math.abs(L[0].at - Date.now() - 30000) < 3000, 'Z7: Countdown 0,5 Min. angelegt');
      assert(/Extraktor/.test(td.getElementById('tm-list').textContent) && /Täglich/.test(td.getElementById('tm-list').textContent), 'Z7: Timer in Einstellungen › Alarme › Uhr');
      const n0 = N.length, later = Date.now() + 31000, h2 = T.tmTick(later);
      L = T.tmLoad().list;
      assert(h2.some(x => /Extraktor/.test(x)) && N.length === n0 + 1 && L[0].done === true, 'Z7: fälliger Timer meldet und ist abgelaufen');
      T.tmAction({ type: 'tmRe', arg: L[0].id });
      assert(T.tmLoad().list[0].done === false, 'Z7: ↻ startet den Timer neu');
      const dd = T.tmLoad().list[1], h3 = T.tmTick(dd.at + 1000);
      assert(h3.some(x => /Täglich/.test(x)) && T.tmLoad().list[1].done !== true && T.tmLoad().list[1].at - dd.at === 864e5, 'Z7: täglicher Timer springt auf morgen');
      const ob = td.createElement('div'); T.ovRenderViewInto('uhr', ob);
      assert(/Downtime/.test(ob.textContent) && /Extraktor/.test(ob.textContent) && ob.querySelector('[data-ovf="tmMode"]') && ob.querySelector('[data-ova="tmAdd"][data-ova-default]'), 'Z7: Overlay „Uhr & Timer“ mit Liste und Formular');
      T.tmAction({ type: 'tmDel', arg: L[0].id }); T.tmAction({ type: 'tmDt' });
      assert(T.tmLoad().list.length === 1 && T.tmLoad().dt.on === false && td.getElementById('tm-dt').checked === false, 'Z7: löschen + Downtime-Alarm aus');
      // alte gespeicherte Reihenfolge ohne Timer (wie beim Nutzer) -> Timer landet hinter Leistung, nicht ganz hinten
      const old = T.neoLoadOrder().filter(x => x !== 'neo-btn-timer'); tw.localStorage.setItem('eve-zentrale-neocom-v1', JSON.stringify(old));
      const no = T.neoLoadOrder();
      assert(no.indexOf('neo-btn-timer') === no.indexOf('neo-btn-perf') + 1, 'Z7: Timer im OmniCom-Overlay hinter Leistung (' + no.slice(-5) + ')');
      assert(/uhr: 'Uhr & Timer'/.test(main), 'Z7: Fenstertitel in main.js');
      tw.close();
    }

    // ---------- BB12 Kleine Fehler + Alert ----------
    {
      assert(/alarm: 'Alert'/.test(main) && !/'Gang-Alarm'/.test(main), 'BB12: Fenstertitel „Alert“ in main.js');
      assert(/Math\.round\(Number\(h\) \* ev\.sender\.getZoomFactor\(\)\)/.test(main) && /st\.miniH \|\| JB_MINI_H/.test(main), 'BB12: Jukebox-Mini-Höhe aus dem Inhalt (mit Zoom)');
      assert(/new Tray\(img\)/.test(main) && /icon\.ico/.test(main) && /let img = winIconPath\(\)/.test(main), 'BB12: Tray nimmt icon.ico (alle Größen)');
      assert(/'OmniCom-Einstellungen …'.*pane: 'neocom'/.test(main), 'BB12: Taskleisten- und OmniCom-Menü springen zu Einstellungen › OmniCom');
      const bw = makeWindow(); await tick(500);
      const bd = bw.document, B = bw.__test, $b = id => bd.getElementById(id);
      const vis = bd.body.textContent;
      assert(!/Gang-Alarm/.test(bd.querySelector('#panel-settings').textContent.replace(/Beta 2\.0\.[0-9]+ ·[\s\S]*/, '')) && /Alert \(zKillboard live\)/.test(vis), 'BB12: Einstellungen sagen „Alert“');
      assert($b('neo-btn-alarm') === null && B.ovTitleIcon('alarm') && /Alert/.test(B.ovViews().alarm), 'BB12: Overlay heißt „Alert“');
      // Reiter OmniCom
      const tabs = [...bd.querySelectorAll('#panel-settings [data-set]')].map(b => b.getAttribute('data-set'));
      assert(tabs.indexOf('neocom') === tabs.indexOf('overlay') + 1 && tabs.indexOf('alarm') === tabs.indexOf('neocom') + 1, 'BB12: Reiter „OmniCom“ zwischen Overlays und Alarme');
      const np = $b('set-pane-neocom');
      assert(np && np.contains($b('neo-order')) && np.contains($b('neo-clock')) && $b('set-pane-look').contains($b('ic-presets')) && $b('set-pane-look').contains($b('neo-clock-col')) && !$b('set-pane-look').contains($b('neo-order')), 'BB12/UU4: Symbol-Liste + Uhr unter OmniCom, Symbolfarbe + Uhrfarbe unter Darstellung');
      B.switchTab('settings'); B.setShow && B.setShow('look'); await tick(30);
      assert(!bd.querySelector('#set-pane-look [data-set-go="neocom"]') && $b('set-pane-look').contains($b('neo-slim')), 'UU4: Verweis-Hinweis weg, „Leiste schmal“ steht unter Darstellung');
      assert(/<span class="neo-new">neu<\/span>/.test($b('neo-order').innerHTML), 'BB12: neue Symbole als „neu“ markiert');   // MB: welches gerade neu ist, wechselt (NEO_NEW)
      // Ton-Knopf im Alert-Overlay
      const s0 = JSON.parse(bw.localStorage.getItem('eve-zentrale-gangalarm-v1') || '{}').sound;
      let box = bd.createElement('div'); B.ovRenderViewInto('alarm', box);
      const sb = box.querySelector('[data-ova="gaSound"]');
      assert(sb && /🔔/.test(sb.textContent) && s0 !== false, 'BB12: Ton-Knopf 🔔 im Alert-Overlay');
      await B.ovAction({ type: 'gaSound' }); await tick(30);
      box = bd.createElement('div'); B.ovRenderViewInto('alarm', box);
      assert(/🔕/.test(box.querySelector('[data-ova="gaSound"]').textContent) && !$b('ga-sound').checked, 'BB12: Klick = stumm, Einstellungen › Alarme › Ton mit umgestellt');
      bw.close();
    }

    // ---------- BB10 Erledigt / Wieder öffnen / Rückgängig / Papierkorb ----------
    {
      const now = Date.now(), LG = { 'eve-zentrale-characters': JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]) };
      const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active' }];
      const OLD = [{ kind: 'Trade', at: now - 31 * 864e5, x: { id: 'alt', tid: 35, name: 'Pyerite', status: 'done' } }];
      const w = makeWindow(Object.assign({ 'eve-zentrale-trades-v1': JSON.stringify(TR), 'eve-zentrale-trash-v1': JSON.stringify(OLD) }, LG)); await tick(600);
      const d = w.document, T = w.__test, tr = () => T.trLoad().find(t => t.id === 't1');
      const ov = (v) => { const o = T.ovLoad(); o.trkView = v; w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify(o)); const b = d.createElement('div'); T.ovRenderViewInto('track', b); return b; };
      // A: gleiche Knöpfe überall
      T.switchTab('track'); d.querySelector('[data-trk="active"]').click(); await tick(20);
      d.querySelector('[data-trk-row="Trade:t1"]').click(); await tick(20);
      const card = d.querySelector('#trk-body .tr-card');
      assert(['done', 'chk', 'cancel'].every(a => card.querySelector('[data-tk="' + a + '|Trade:t1"]')), 'BB10: Watchlist-Karte aktiv: Erledigt · Prüfen · Abbrechen');
      T.ovSatAction('track', { type: 'trkDet', arg: 't1' });
      assert(['done', 'chk', 'cancel'].every(a => ov('active').querySelector('[data-ova="tk"][data-arg="' + a + '|Trade:t1"]')), 'BB10: Overlay-Karte aufgeklappt mit denselben Knöpfen');
      const tb = d.createElement('div'); T.ovRenderViewInto('trades', tb);
      assert(tb.querySelector('[data-ova="tk"][data-arg="done|Trade:t1"]') && tb.querySelector('[data-ova="tk"][data-arg="cancel|Trade:t1"]'), 'BB10: Trades-Overlay mit Erledigt/Abbrechen');
      // C: Erledigt → Streifen → Rückgängig
      card.querySelector('[data-tk="done|Trade:t1"]').click(); await tick(20);
      assert(tr().status === 'done' && !d.getElementById('tk-undo').hidden && /Tritanium erledigt/.test(d.getElementById('tk-undo').textContent), 'BB10: Erledigt + Streifen „… erledigt · Rückgängig“');
      assert(/Rückgängig/.test(ov('done').textContent), 'BB10: Rückgängig auch im Overlay');
      d.querySelector('#tk-undo [data-tk-undo]').click(); await tick(20);
      assert(tr().status === 'active', 'BB10: Rückgängig stellt „aktiv“ wieder her');
      // B: Wieder öffnen hält + Markierung
      T.ovSatAction('track', { type: 'tk', arg: 'cancel|Trade:t1' });
      assert(tr().status === 'done' && tr().cancelled, 'BB10: Abbrechen im Overlay');
      T.ovSatAction('track', { type: 'tk', arg: 'reopen|Trade:t1' });
      assert(tr().status === 'active' && tr().keepOpen && T.trkAll().find(x => x.id === 't1').keep && /von Hand offen/.test(ov('active').textContent), 'BB10: Wieder öffnen → keepOpen, Karte „von Hand offen“');
      assert(/!t\.keepOpen && trEvaluate\(t, trLive\[t\.id\], fees0\)\.allSold/.test(src) && /x\.status !== "done" && !x\.keepOpen && hrProgress/.test(src) && /x\.state === "cancelled" \|\| x\.keep\) return false/.test(src), 'BB10: trRefresh/hrRefresh/tkAutoDone lassen von Hand Geöffnete offen');
      // Löschen → Papierkorb (alter Eintrag > 30 Tage fällt raus), Wiederherstellen
      T.tkAct('Trade', 't1', 'cancel'); T.tkAct('Trade', 't1', 'del');
      assert(!tr() && T.tkTrashLoad().length === 1 && T.tkTrashLoad()[0].x.id === 't1', 'BB10: Löschen → Papierkorb, älter als 30 Tage wird verworfen');
      d.querySelector('[data-trk="trash"]').click(); await tick(20);
      assert(/Tritanium/.test(d.getElementById('trk-body').textContent) && /noch 30 Tage/.test(d.getElementById('trk-body').textContent), 'BB10: Reiter Papierkorb');
      assert(/Tritanium/.test(ov('trash').textContent) && ov('trash').querySelector('[data-ova="tkTrash"]'), 'BB10: Papierkorb im Overlay');
      d.querySelector('[data-tk-trash^="back|"]').click(); await tick(20);
      assert(tr() && T.tkTrashLoad().length === 0, 'BB10: Wiederherstellen');
      T.tkAct('Trade', 't1', 'del'); const u = T.tkUndoLive()[0];
      T.tkUndo(u.n);
      assert(tr() && !T.tkTrashLoad().length, 'BB10: Löschen rückgängig holt ihn aus dem Papierkorb');
      // D: Automatik nennt den Namen, Rückgängig hält ihn offen
      const run = T.hrAdd(1, 'Jita', 2, 'Amarr', [{ tid: 29248, name: 'Magnate', q: 9, sp: 9, p: 1 }]);
      T.hrUpdate(run.id, { charId: '111' });
      w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [now, 29248, 9, 1, 1, 1], 2: [now + 1, 29248, 9, 2, 0, 2] }, fee: {}, ord: {}, upd: 0 }));
      const rs = () => T.hrLoad().find(r => r.id === run.id);
      await T.hrRefresh2();
      const au = T.tkUndoLive().find(x => x.auto);
      assert(rs().status === 'done' && /erledigt: Jita → Amarr/.test(d.getElementById('hr-status').textContent) && au && /automatisch erledigt/.test(au.txt), 'BB10: Auto-Erledigt mit Namen + Rückgängig');
      T.tkUndo(au.n); await T.hrRefresh2();
      assert(rs().status === 'active' && rs().keepOpen, 'BB10: Auto-Erledigt rückgängig → bleibt offen');
      // Einheitliche Wörter
      assert(!/Übernehmen \+ erledigt|Rest trotzdem erledigen|✓ Abschließen|data-ova="hrDone"|data-ova="trFin"/.test(src), 'BB10: alte Abschluss-Knöpfe entfernt');
      w.close();
    }
    // ---------- Z10 Aktualisieren im Takt von EVE ----------
    {
      const w = makeWindow({ 'eve-zentrale-characters': JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }]) }); await tick(600);
      const T = w.__test, now = Date.now(), hd = o => ({ ok: true, headers: { get: k => o[k] || null } });
      const loc = ms => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const LM = now - 60e3, EX = now + 60e3, EXO = now - 30e3;
      T.esiStampRec('https://esi.evetech.net/characters/111/wallet/', hd({ 'last-modified': new Date(LM).toUTCString(), expires: new Date(EX).toUTCString() }));
      T.esiStampRec('https://esi.evetech.net/characters/111/orders/', hd({ 'last-modified': new Date(LM).toUTCString(), expires: new Date(EXO).toUTCString() }));
      T.esiStampRec('https://esi.evetech.net/markets/10000002/orders/?type_id=34', hd({ 'last-modified': new Date(LM).toUTCString(), expires: new Date(EX).toUTCString() }));
      const tx = T.esiTaktTxt(['/markets/orders', '/characters/orders']);
      assert(tx === 'Markt ' + loc(LM) + ' → ' + loc(EX) + ' · Orders ' + loc(LM) + ' → ' + loc(EXO), 'Z10: je Datenart EVE-Stand → neu ab: ' + tx);
      assert(/^Wallet /.test(T.esiTaktTxt(['/characters/wallet'])) && T.ovFootText('wallet').tip === T.esiTaktTxt(['/characters/wallet']), 'Z10: Overlay-Fußzeile hat die volle Liste im Tooltip');
      assert(T.esiDue(['/characters/orders'], now - 120e3) && !T.esiDue(['/characters/orders'], now - 10e3) && !T.esiDue(['/characters/wallet'], now - 600e3), 'Z10: fällig erst nach „neu ab“ + Mindestabstand, nicht vorher');
      assert(!T.esiDue(['/characters/orders'], now), 'Z10: schon nach „neu ab“ geladen → nicht noch einmal');
      assert(!T.esiDue(['/characters/assets'], 0), 'Z10: ohne EVE-Zeiten kein Nachladen');
      w.close();
    }
    // ---------- BB11 Aufträge ordnen ----------
    {
      const now = Date.now(), LG = { 'eve-zentrale-characters': JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]) };
      const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active' },
        { id: 't2', tid: 35, name: 'Pyerite', hub: 'jita', charId: 111, charName: 'Eins', qty: 10, buy: 5, sell: 6, unit: 0.5, created: now - 7200e3, status: 'done', done: now - 60e3 }];
      const w = makeWindow(Object.assign({ 'eve-zentrale-trades-v1': JSON.stringify(TR) }, LG)); await tick(600);
      const d = w.document, T = w.__test, $ = id => d.getElementById(id);
      const ovv = (id, v) => { const o = T.ovLoad(); if (v) o.trkView = v; w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify(o)); const b = d.createElement('div'); T.ovRenderViewInto(id, b); return b; };
      const run = T.hrAdd(60003760, 'Jita IV - Moon 4', 60008494, 'Amarr VIII', [{ tid: 36, name: 'Mexallon', q: 10, sp: 5, p: 1 }]);
      // Watchlist groß: alle Reiter kompakte Zeilen, keine Tabelle
      T.switchTab('track');
      for (const v of ['active', 'done', 'all']){ d.querySelector('[data-trk="' + v + '"]').click(); await tick(20);
        assert(!$('trk-body').querySelector('table') && $('trk-body').querySelector('.trk-sm'), 'BB11: Reiter ' + v + ' = kompakte Zeilen, keine Tabelle'); }
      assert($('trk-stats').querySelector('.stat-tile[title*="je Auftrag"]') && $('trk-body').querySelector('.trk-r b[title*="je Auftrag"]'), 'BB11: Ergebnis erklärt (je Auftrag)');
      // Hauling nur Hinweis, Läufe in der Watchlist
      T.hrUpdate(run.id, {}); await tick(20);
      assert(/1 Lauf aktiv/.test($('hr-list').textContent) && !$('hr-list').querySelector('.tr-card') && $('hr-list').querySelector('[data-go-track]'), 'BB11: Hauling zeigt nur „1 Lauf aktiv → Watchlist“');
      d.querySelector('[data-trk="active"]').click(); d.querySelector('[data-trk-row="Lauf:' + run.id + '"]').click(); await tick(20);
      assert(/data-hr-buydone/.test(src) && $('trk-body').querySelector('.hr-det'), 'BB11: Lauf-Karte in der Watchlist mit „Weiter zu Unterwegs“ und Details');
      // Laufend: kompakte Zeilen, Klick → Watchlist; Wallet › Erledigt nur Summe
      T.troRender(); const tr0 = $('tro-body').querySelector('[data-trk-row="Trade:t1"]');
      assert(tr0 && !$('tro-body').querySelector('.tr-card'), 'BB11: Laufend = kompakte Zeilen');
      T.switchTab('station'); tr0.onclick(); await tick(20);
      assert(d.querySelector('[data-trk="active"]').getAttribute('aria-selected') === 'true' && $('trk-body').querySelector('.tr-card'), 'BB11: Klick in „Laufend“ öffnet den Auftrag in der Watchlist');
      assert(/1 erledigt · Summe/.test($('wv-done-body').textContent) && !$('wv-done-body').querySelector('table'), 'BB11: Wallet › Erledigt nur Summe');
      // Overlays: Trades nur aktive, Watchlist mit Suche, Summe, alle zu/auf, fertig noch sichtbar, Badge
      const tb = ovv('trades');
      assert(/Tritanium/.test(tb.textContent) && !/Pyerite/.test(tb.textContent) && tb.querySelector('[data-ova="ovGo"][data-arg="track"]'), 'BB11: Trades-Overlay nur aktive Trades + Sprung zur Watchlist');
      const wb = ovv('track', 'active');
      assert(wb.querySelector('.ov-blink-btn, [data-ova="blinkOpen"]') && wb.querySelector('[data-ova="trkDetAll"][data-arg="auf"]') && /Pyerite/.test(wb.textContent) && /geplant netto/.test(wb.textContent) && wb.querySelector('[data-bk="Trade:t1"]'), 'BB11: Watchlist-Overlay: Blinken, alle auf, frisch Erledigte, geplant netto, Blink-Schlüssel');
      assert(!wb.querySelector('[data-arg="scan-run"], .ov-act'), 'NW3: keine Markt-Suche mehr im Watchlist-Overlay');
      T.ovSatAction('track', { type: 'trkDetAll', arg: 'auf' });
      const wa = ovv('track');
      assert(/Stand \d\d:\d\d|Preise noch nicht geladen/.test(wa.textContent) && wa.querySelector('.ov-cp, [data-ova="cp"], .tsc-cp-b'), 'BB11: alle auf → volle Trade-Karte mit Preisen + Kopier-Knöpfen');
      T.ovSatAction('track', { type: 'trkDetAll', arg: 'zu' });
      assert(!T.ovLoad().trkDet, 'BB11: alle zu');
      assert(/Preis-Merkliste/.test($('tsc-view-watch').textContent) && !/Marktwatchlist/.test(src.replace(/<details class="skills-more"[^\n]*Beta[^\n]*/g, '')), 'BB11: „Marktwatchlist“ → „Preis-Merkliste“ (außer alten Patchnotes)');
      w.close();
    }

    // BB14: verstecktes Hauptfenster zeichnet die Uhr nicht jede Sekunde neu; toter Code weg
    {
      const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
        beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
      await tick(700);
      const d = w.document, clk = d.getElementById('clock');
      let hid = true; Object.defineProperty(d, 'hidden', { get: () => hid });
      clk.textContent = 'X'; await tick(1100);
      assert(clk.textContent === 'X', 'BB14: Uhr ruht bei verstecktem Hauptfenster');
      hid = false; await tick(1100);
      assert(clk.textContent !== 'X', 'BB14: Uhr läuft wieder, sobald das Hauptfenster sichtbar ist');
      assert(/cmd\.type === "mainVis"/.test(src) && /did-finish-load', vis\)/.test(main), 'BB14: Programm meldet Sichtbarkeit auch beim Start');
      assert(!/function ovNextView\b/.test(src) && (src.match(/function ovTb\(/g) || []).length === 1 && !/function tb\(/.test(src), 'BB14: toter Code weg, doppelter Umschalter-Helfer zusammengelegt');
      assert(!/ReferencedAssemblies System\.Windows\.Forms/.test(main), 'BB14: Helfer ohne Vorschau-Fenster (PvForm) braucht kein WinForms mehr');
      w.close();
    }

    // BB13: OmniCom-Gruppen, Uhr-Menü + Leuchten, Erledigt-Zeitraum
    {
      const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
        beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */ } }).window;
      await tick(700);
      const d = w.document, $ = id => d.getElementById(id), T = w.__test;
      const kids = () => [...$('neocom').children].map(b => b.id.replace(/^neo-(btn|grp)-/, ''));
      assert(kids().slice(0, 5).join() === 'handel,station,haul,market,track' && $('neo-grp-besitz') && kids().indexOf('besitz') === kids().indexOf('courier') + 1, 'BB13: Leiste in Gruppen mit Überschrift (Handel, Besitz, …)');
      $('neo-grp-besitz').onclick();
      assert($('neo-btn-assets').classList.contains('neo-fold') && $('neo-grp-besitz').getAttribute('aria-expanded') === 'false' && /4/.test($('neo-grp-besitz').textContent), 'BB13: Gruppe einklappen per Klick auf die Überschrift');
      const sel = d.querySelector('[data-neo-grpsel="neo-btn-wallet"]'); sel.value = 'handel'; sel.onchange();
      assert(kids().indexOf('wallet') < kids().indexOf('besitz') && !$('neo-btn-wallet').classList.contains('neo-fold'), 'BB13: Symbol per Auswahl in andere Gruppe');
      const mc = d.querySelector('[data-neo-main="neo-btn-radar"]'); mc.checked = false; mc.onchange();
      assert($('neo-btn-radar').hidden && JSON.parse(w.localStorage.getItem('eve-zentrale-neocom-groups-v1')).hide[0] === 'neo-btn-radar', 'BB13: Symbol im Hauptfenster ausblendbar');
      $('neo-slim').checked = true; $('neo-slim').onchange();
      assert(d.documentElement.classList.contains('neo-slim') && $('neo-btn-map').title, 'BB13: Schmal-Modus, Name als Tooltip');
      $('neo-order-reset').onclick();
      assert(kids().indexOf('wallet') > kids().indexOf('besitz') && !$('neo-btn-assets').classList.contains('neo-fold'), 'BB13: Standard stellt Gruppen wieder her');
      // Uhr
      const nh = T.neoOverlayHtml();
      assert(/data-neo="clock"[^>]*data-hint="[^"]*Rechtsklick: Menü · als Nächstes: Downtime in /.test(nh) && /data-dt="true"/.test(nh), 'BB13: Uhr-Tooltip mit nächstem Termin');
      assert(/\.neo-ov \.neo-clk \.clk\{text-shadow/.test(src) && /\.neo-clk\.alarm\{animation/.test(src) && /data-ova="clkMenu" data-arg="timer"/.test(src), 'BB13: Uhr leuchtet, blinkt bei Alarm, Rechtsklick-Menü');
      w.localStorage.setItem('eve-zentrale-timers-v1', JSON.stringify({ dt: { on: false }, list: [{ id: 'a', name: 'Extraktor', mode: 'min', v: 3, at: Date.now() + 180000 }] }));
      assert(/class="neo-clk(?: col)? soon"/.test(T.neoOverlayHtml()) && /Extraktor in/.test(T.neoOverlayHtml()), 'BB13: Uhr pulsiert, wenn ein Timer < 5 Min. fällig ist');
      T.ovSatAction('neocom', { type: 'clkMenu', arg: 'settings' });
      assert($('panel-settings').classList.contains('active') && !$('set-pane-alarm').hidden, 'BB13: Menü › Einstellungen öffnet Alarme › Uhr');
      // Erledigt-Zeitraum im Overlay
      T.ovSatAction('track', { type: 'trkOv', arg: 'done' });
      const ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
      assert(ob.querySelector('[data-ova="doneDays"][data-arg="30"][aria-pressed="true"]'), 'BB13: Overlay Erledigt zeigt 30 Tage, umschaltbar');
      T.ovSatAction('track', { type: 'doneDays', arg: '90' });
      assert($('trk-range').value === '90' && $('wv-done-body').querySelector('[data-dd="90"][aria-pressed="true"]'), 'BB13: Zeitraum gilt für Watchlist, Overlay und Wallet');
      // BB15: offene Menüs überleben das Neuzeichnen, danach wird nachgeholt
      const bx = d.createElement('div'); d.body.appendChild(bx); T.ovFormWire(bx, () => {});
      const paint = t => T.ovFormKeep(bx, () => { bx.innerHTML = '<select><option>A</option></select><input list="ov-sysnames"><p>' + t + '</p>'; });
      paint('1');
      bx.querySelector('select').dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
      paint('2');
      assert(bx.querySelector('p').textContent === '1', 'BB15: Klappmenü ohne data-ovf bleibt offen');
      bx.querySelector('select').dispatchEvent(new w.Event('change', { bubbles: true }));
      assert(bx.querySelector('p').textContent === '2', 'BB15: nach der Auswahl wird nachgeholt');
      bx.querySelector('input').dispatchEvent(new w.Event('input', { bubbles: true }));
      paint('3');
      assert(bx.querySelector('p').textContent === '2', 'BB15: Namens-Vorschläge bleiben offen');
      bx.querySelector('input').dispatchEvent(new w.Event('focusout', { bubbles: true }));
      assert(bx.querySelector('p').textContent === '3', 'BB15: nach Verlassen des Felds nachgeholt');
      const cm = d.createElement('div'); cm.id = 'ov-ctx'; bx.appendChild(cm);
      paint('4');
      assert(bx.querySelector('#ov-ctx') && bx.querySelector('p').textContent === '3', 'BB15: Rechtsklick-Menü (Uhr, Karte) bleibt offen');
      cm.remove(); await tick(400);
      assert(bx.querySelector('p').textContent === '4', 'BB15: Menü zu → Neuzeichnen nachgeholt');
      // BB16: zwei Orders verschiedener Items mit gleichem Zeitstempel dürfen Gewinne nicht leeren
      const st = { tx: { 1: [1000, 34, 10, 5, 1, 60003760], 2: [2000, 34, 10, 8, 0, 60003760] }, fee: { 9: [3000, 'b', 7, '', 0] },
        ord: { 11: [34, 3000, 60003760], 12: [35, 3000, 60003760], 13: [34, 3000, 60003760] } };
      const pr = T.pnlCompute(st, {});
      assert(pr.rows.length === 1 && pr.rows[0].sold === 10, 'BB16: Gewinne rechnet trotz Orders mit gleichem Zeitstempel');
      // BB17: Uhr-Timer mit Sekunden, jede Sekunde neu
      assert(T.fmtRemainSec(272000) === '4:32' && T.fmtRemainSec(2*3600e3 + 14*60e3 + 5000) === '2 Std 14:05' && T.fmtRemainSec(27*3600e3) === '1 T 3 Std', 'BB17: Sekunden-Format');
      const ub = d.createElement('div'); T.ovRenderTimer(ub);
      const sp = ub.querySelector('[data-ov-sec]');
      assert(sp && sp.textContent === T.fmtRemainSec(Number(sp.getAttribute('data-ov-until')) - Date.now()), 'BB17: Uhr zeigt Restzeit im Sekunden-Format');
      // AA8: Gank-Warnung – Liste + Hauler-Verluste 24 Std. (zKill), Reiseroute + Navigations-Overlay
      w.fetch = u => Promise.resolve({ ok: true, json: () => Promise.resolve(/groupID\/513\//.test(u) ? [{ solar_system_id: 3, zkb: { totalValue: 4e9 } }] : []) });
      const cs = T.rtSysLoad(); cs.sys[1] = { n: 'Jita', s: .9 }; cs.sys[2] = { n: 'Uedama', s: .5 }; cs.sys[3] = { n: 'Sivala', s: .6 }; cs.sys[4] = { n: 'Amarr', s: 1 };
      await T.gankLoad(true);
      T.gankSetList('Uedama');
      const gr = T.gankOnRoute([1, 2, 3, 4], cs);
      assert(gr.length === 2 && gr[0].g.list && !gr[0].g.n && gr[1].g.n === 1 && !gr[1].g.list, 'AA8: Gank-Liste und zKill-Verluste erkannt');
      T.rtSave({ last: { from: { name: 'Jita' }, to: { name: 'Amarr' }, pref: 'shortest', route: [1, 2, 3, 4], alts: {}, pos: 0 } });
      T.rtRender();
      assert(d.querySelectorAll('#rt-body tr.gank').length === 2 && /Gank-Gefahr/.test($('rt-stats').textContent), 'AA8: Reiseroute markiert Gank-Systeme');
      const nb = d.createElement('div'); T.ovRenderViewInto('route', nb);
      assert(/Gank-Gefahr: Uedama, Sivala \(1\)/.test(nb.textContent) && nb.querySelectorAll('.ov-route-row.gank').length === 2, 'AA8: Navigations-Overlay warnt');
      // AA8 Teil 2: Gank-Systeme umfahren – Route über 5 statt 2/3
      const idsOf = { jita: 1, uedama: 2, sivala: 3, amarr: 4, niarja: 5 };
      cs.sys[5] = { n: 'Niarja', s: .5 };
      w.fetch = (u, o) => { u = String(u); const ok = x => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(x) });
        if (/universe\/ids/.test(u)) return ok({ systems: JSON.parse(o.body).map(n => ({ id: idsOf[n.toLowerCase()], name: n })).filter(x => x.id) });
        if (/\/route\//.test(u)){ const av = JSON.parse(o.body).avoid_systems || []; return ok(av.indexOf(2) >= 0 ? [1, 5, 4] : [1, 2, 3, 4]); }
        return ok([]); };
      const rc = await T.rtCompute({ from: 'Jita', to: 'Amarr', pref: 'shortest', avoid: [], noGank: true });
      assert(rc.route.join() === '1,5,4' && rc.autoAvoided.indexOf(2) >= 0, 'AA8: Route ohne Gank-Systeme');
      // BB18: Route einfügen
      T.setSysNames(['Jita', 'Uedama', 'Sivala', 'Amarr', 'Niarja', '1DQ1-A']);
      assert(T.rtParseNames('Jita (0,9) → Uedama (0,5) → Sivala (0,6) → Amarr (1,0)').join() === 'Jita,Uedama,Sivala,Amarr', 'BB18: Routen-Text von EVE Omni erkannt');
      assert(T.rtParseNames('jita\nniarja\r\nAmarr').join() === 'Jita,Niarja,Amarr' && T.rtParseNames('Jita » 1DQ1-A').join() === 'Jita,1DQ1-A' && T.rtParseNames('Jita Niarja Amarr').join() === 'Jita,Niarja,Amarr', 'BB18: Zeilen, », Leerzeichen');
      assert(await T.rtPaste('Jita » Uedama » Sivala » Amarr') && $('rt-from').value === 'Jita' && $('rt-to').value === 'Amarr' && d.querySelectorAll('#rt-body tr').length === 4 && d.querySelectorAll('#rt-body tr.gank').length === 2, 'BB18: eingefügte Route mit Gank-Warnung');
      assert(!(await T.rtPaste('hallo welt')) && /Keine Route erkannt/.test($('rt-status').textContent), 'BB18: Unsinn → Hinweis');
      // BB19: Watchlist standardmäßig nach Art gruppiert, Status wählbar
      const LL = (kind, state, st) => ({ kind: kind, id: kind + state + st, name: 'x', state: state, st: st, t: 1, res: 1 });
      const lst = [LL('Lauf', 'active', ' st-bad'), LL('Trade', 'active', ' st-sell'), LL('Lauf', 'active', ' st-way'), LL('Trade', 'done', ' st-done'), LL('Lauf', 'cancelled', '')];
      const ga = T.trkLevels(lst);
      assert(ga.map(l => l.k).join() === 'a-trade,a-run,a-done,a-cancel' && ga[1].list.length === 2, 'BB19: Gruppen Trades → Läufe → Erledigt → Abgebrochen, Problem-Lauf bei den Läufen');
      w.localStorage.setItem('eve-zentrale-trkgroup-v1', 'status');
      assert(T.trkLevels(lst)[0].k === 'bad', 'BB19: nach Status weiter wählbar');
      w.localStorage.removeItem('eve-zentrale-trkgroup-v1');
      w.close();
    }
    // BB20: gleiche Ware als Trade und im Hauling-Lauf – die Käufe des Laufs zählen nicht im Trade
    {
      const w = makeWindow({ 'eve-zentrale-characters': JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }]) }); await tick(600);
      const T = w.__test, now = Date.now(), JITA = 60003760;
      const tr = { id: 'tx1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', qty: 100, buy: 5, sell: 6, created: now - 3600e3, status: 'active' };
      const run = T.hrAdd(JITA, 'Jita', 60008494, 'Amarr', [{ tid: 34, name: 'Tritanium', q: 50, sp: 300, p: 50 }]);
      T.hrUpdate(run.id, { created: now - 1800e3, charId: '111' });
      w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [now - 3000e3, 34, 100, 5, 1, JITA], 2: [now - 1700e3, 34, 50, 5.5, 1, JITA], 3: [now - 600e3, 34, 30, 6, 0, JITA], 4: [now - 300e3, 34, 50, 7, 0, 60008494] }, fee: {}, ord: {}, upd: now }));
      const p = T.trProgress(tr), g = T.hrProgress(T.hrLoad()[0]);
      assert(p.bought === 100 && p.sold === 30, 'BB20: Trade zählt nur seine 100 gekauft / 30 verkauft (nicht die 50 des Laufs): ' + p.bought + '/' + p.sold);
      assert(g.bought === 50 && g.sold === 50, 'BB20: Lauf zählt seine 50 gekauft / 50 verkauft: ' + g.bought + '/' + g.sold);
      const pw = T.trProgress(Object.assign({}, tr, { wide: true, chkEnd: now - 900e3 }));
      assert(pw.sold === 30, 'BB20: aktiver Trade nach „Werte übernehmen“ zählt spätere Verkäufe weiter: ' + pw.sold);
      assert(T.trProgress(Object.assign({}, tr, { wide: true, chkEnd: now - 900e3, status: 'done', done: now })).sold === 0, 'BB20: erledigter Trade bleibt beim Prüf-Stand');
      // BB21: Filter Trades/Läufe – gemerkt, Overlay und große Watchlist gleich
      const ovTrk = () => { const b = w.document.createElement('div'); T.ovRenderViewInto('track', b); return b; };
      assert(ovTrk().querySelector('.trk-run') && ovTrk().querySelector('[data-ova="trkKind"][data-arg=""][aria-pressed="true"]'), 'BB21: Standard Trades + Läufe, Lauf sichtbar');
      T.ovSatAction('track', { type: 'trkKind', arg: 'Trade' });
      assert(!ovTrk().querySelector('.trk-run') && T.trkKind() === 'Trade' && w.document.getElementById('trk-kind').value === 'Trade', 'BB21: „nur Trades“ blendet Läufe aus, große Watchlist zieht mit');
      w.document.getElementById('trk-kind').value = 'Lauf'; w.document.getElementById('trk-kind').onchange();
      assert(ovTrk().querySelector('.trk-run') && ovTrk().querySelector('[data-arg="Lauf"][aria-pressed="true"]'), 'BB21: Auswahl in der großen Watchlist gilt auch im Overlay');
      w.close();
    }

    console.log('\nALL BB TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
