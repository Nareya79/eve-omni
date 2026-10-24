// BI K1/K1b/K2 (23.10.2026): neue Karte (Canvas, ganzes Universum, Stil eo-map) – große Karte + Karten-Overlay, Hintergrund abschaltbar,
// K2: Suche, Tooltip, Rechtsklick-Menü, Färben nach, Ansicht-Schalter (Befehle km:opt / km:ctx an den Besitzer).
// K4: Routing-Leiste + Panel (Punkt zu Punkt über EVE mit eigener Näherung bei Fehler, Sprungreichweite, Sprungplaner, Start/Ziel per Rechtsklick).
// K5a: Ebenen (Kills/Verkehr, Sov mit Kürzeln, FW, Wurmlöcher – Daten lädt der Besitzer in localStorage), Auswahl = Quadrat in der Designfarbe.
// K5b: Aktivität – Aufzeichnung in IndexedDB (Stunde + Tag), Summen je Zeitraum, Panel mit Kennzahl/Zeit/Empfindlichkeit, Werte des gewählten Systems.
// K3: Sterndaten (Stern, Planeten, Umlaufbahn, Gürtel, Truesec), alle „Färben nach“-Arten mit Legende, ESI Industrie/Sov über km:need.
// a) Overlay-HTML/Befehle (jsdom), b) echte Leinwand in Chromium: zeichnet, Mausrad merkt Ausschnitt, Klick wählt Jita, Hintergrund aus, Englisch.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const test = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8'), html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
(async () => {
  try{
    // Quelltext: Daten + Zeichnung stehen vor dem Einzelfenster-Abzweig (Overlay-Fenster zeichnen selbst)
    const iSat = html.indexOf('if (SAT_VIEW === "spare" && window.evecoreHost)');
    assert(html.indexOf('var MP_SCH = window.__MP_SCH') < iSat && html.indexOf('var KM_POS = window.__KM_POS') < iSat && html.indexOf('function kmMount(') < iSat, 'MP_SCH, KM_POS und kmMount vor dem Einzelfenster-Abzweig');
    const KP = JSON.parse(html.slice(html.indexOf('var KM_POS = window.__KM_POS = ') + 31, html.indexOf(';   // BI K1b')));
    const MS = JSON.parse(html.slice(html.indexOf('var MP_SCH = window.__MP_SCH = ') + 31, html.indexOf(';\n', html.indexOf('var MP_SCH = window.__MP_SCH = '))));
    assert(KP.p.length === MS.s.length * 2 && KP.p.every(Number.isInteger), 'K1b: echte Lage für alle ' + MS.s.length + ' Systeme (gleiche Reihenfolge wie das Schema)');
    const KS = JSON.parse(html.slice(html.indexOf('var KM_STAR = window.__KM_STAR = ') + 33, html.indexOf(';   // BI K3')));
    const rows = KS.s.split(';'); let jid = 0, ji = -1; MS.s.forEach((a, i) => { jid += a[0]; if (jid === 30000142) ji = i; });
    assert(rows.length === MS.s.length && rows[ji] === '4,7305,321101,382,0,946' && KS.c[4] === 'F1 V', 'K3: Sterndaten für alle Systeme, Jita = F1 V, 7305 K, 3 Barren/2 Gas/1 Temperate/1 Lava/1 Ice, 38,2 AU, Truesec 0,946');
    assert(/replace\(\/ data-kmvb="\[\^"\]\*"\/, ""\)/.test(html) && /mapDragging = kmBusy;/.test(html), 'Einzelfenster: nur Ausschnitt neu → kein Neuaufbau, Ziehen sperrt Neuzeichnen');
    assert(!/function (mpDraw|mpShow|mpSchemaSvg|mpsPng|ovRenderMapOld|mapGestures)\(/.test(html) && !html.includes('id="mp-svg"') && !html.includes('id="mp-km-b"'), 'K6: alte Karte samt PNG-Export und Umschalter gelöscht');

    // K8 (24.10.): Suche über den Panels, bewegte Ebene im selben Bild, Route → Overlay sofort, kein Echo-Sprung, Neigung 0,1°
    assert(/\.km-find\{[^}]*z-index:3/.test(html), 'K8a: Vorschlagsliste der Suche liegt über Leiste/Panels');
    assert(/kmDrawMe\(host, g, X, Y\); var af = false; try\{ af = host\.__cv2 && kmAnimFrame\(host, performance\.now\(\)\); \}catch\(e\)\{\} if \(af\) kmAnim\(host\);/.test(html) && /if \(!isFinite\(x\) \|\| !isFinite\(y\)\) return;/.test(html), 'K8c: Route/Kugeln werden im selben Bild wie die Karte gezeichnet');
    assert(/function rtSave\(st\)\{[^}]*\}catch\(e\)\{\} try\{ kmBigSync\(\); if \(ovSatOpen\.karte\) ovPublishSatellites\(\)/.test(html), 'K8c: neue Route geht sofort ans Karten-Overlay');
    assert(/va !== host\.__vbSent/.test(html) && /vNew = va !== host\.__vbAttr/.test(html) && /!host\.__down/.test(html) && /1800 \/ Math\.PI\) \/ 10/.test(html), 'K8d: eigener Ausschnitt als Echo ignoriert, bei gedrückter Taste nichts von außen, Neigung auf 0,1°');
    assert(/neo-label">OmniMap</.test(html) && /karte: "OmniMap"/.test(html) && /"In der OmniMap zeigen": "Show in OmniMap"/.test(html) && !/Auf der Karte zeigen/.test(html), 'K12: Karte heißt OmniMap (DE/EN)');

    // a) Overlay „Karte“
    const w = new JSDOM(test, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(600);
    const d = w.document, T = w.__test, view = () => { const b = d.createElement('div'); T.ovRenderViewInto('karte', b); return b; };
    let b = view();
    assert(!b.querySelector('[data-ova="mapTog"]') && !b.querySelector('svg'), 'K6: Overlay zeigt nur noch die neue Karte, kein Umschalter');
    const h = b.querySelector('.ov-map .km');
    assert(h && h.getAttribute('data-km-to') === 'ov' && JSON.parse(h.getAttribute('data-km')).bg === true && !h.hasAttribute('data-kmvb'), 'neue Karte im Overlay: Host mit Zustand, Hintergrund an, noch kein Ausschnitt');
    T.ovSatAction('karte', { type: 'map', cmd: 'km:vb:400,300,120,90' }); T.ovSatAction('karte', { type: 'map', cmd: 'km:sel:30000142' }); b = view();
    const h2 = b.querySelector('.km');
    assert(h2.getAttribute('data-kmvb') === '400,300,120,90' && JSON.parse(h2.getAttribute('data-km')).sel === '30000142', 'Befehle aus dem Overlay-Fenster: Ausschnitt + Auswahl gemerkt');
    T.ovSatAction('karte', { type: 'map', cmd: 'km:opt:bg:false' }); T.ovSatAction('karte', { type: 'map', cmd: 'km:opt:c:reg' }); T.ovSatAction('karte', { type: 'map', cmd: 'km:opt:sn:true' }); b = view();
    const ks = JSON.parse(b.querySelector('.km').getAttribute('data-km')), ms = JSON.parse(w.localStorage.getItem('eve-zentrale-map-v1'));
    assert(ks.bg === false && ks.o.c === 'reg' && ks.o.sn === true && ms.kmBg === false && ms.kmO.c === 'reg', 'K2: Ansicht/Färben aus dem Overlay-Fenster gespeichert (gemeinsam mit der großen Karte)');
    assert(!/data-arg="kmbg"/.test(b.innerHTML), 'K2: Hintergrund-Knopf nicht mehr im Kopf (jetzt in der Karte)');
    T.ovMapGo(30002187); b = view();
    const hg = b.querySelector('.km'), vg = hg.getAttribute('data-kmvb').split(',').map(Number);
    assert(JSON.parse(hg.getAttribute('data-km')).go > Date.now() - 5000 && /Date\.now\(\) - \(st\.go \|\| 0\) < 15000/.test(html), 'K6: Sprung hat Vorrang vor „Folgen“ (go-Stempel)');
    assert(JSON.parse(hg.getAttribute('data-km')).sel === '30002187' && vg[2] === 120 && vg[3] === 90, 'K6: „Auf der Karte zeigen“ wählt Amarr und setzt den Ausschnitt dorthin');
    d.body.insertAdjacentHTML('beforeend', '<b class="sys-link" data-gosys="30000142">Jita</b>'); d.querySelector('[data-gosys]').click(); await tick(50); b = view();
    assert(JSON.parse(b.querySelector('.km').getAttribute('data-km')).sel === '30000142', 'K6: Klick auf einen Systemnamen (data-gosys) öffnet die neue Karte am System');
    assert(/function kmLy\(a, b\)\{ var dx = a\.rx - b\.rx/.test(html) && /K11e: Gang-Report = gekreuzte Klingen/.test(html) && /goldene Schilder = Live-Kampf/.test(html), 'K1c: Lichtjahre aus echter Lage; K11e: eigenes Gang-Report-Symbol + Unterschied im Tooltip');
    // K9/K10/K13: Zustand je Charakter (Ort, Schiff, online), Gank-Systeme der Route, Charaktere abwählbar
    assert(/\(c\.locName \|\| "\?"\) : "", c\.ship \?/.test(html) && /rg: rg, rk:/.test(html) && /function kmMeOn\(host\)\{ var X = kmOm\(host\)\.meX/.test(html), 'K9/K10/K13: Ort/Schiff/online, Gank-Route und Auswahl im Zustand');
    assert(/K14: aktiver Client leuchtet kräftig/.test(html) && /shadowBlur = 22/.test(html), 'K14: aktiver Charakter mit kräftigem Leuchten');
    w.close();

    // b) echte Leinwand
    const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const lang of ['de', 'en']){
      const p = await br.newPage({ viewport: { width: 1400, height: 860 } }), errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.route('**/*', r => { const u = r.request().url(), J = d => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/industry\/systems/.test(u)) return J([{ solar_system_id: 30000142, cost_indices: [{ activity: 'manufacturing', cost_index: 0.0123 }, { activity: 'invention', cost_index: 0.5 }] }]);
        if (/\/route\/30000142\/30002187/.test(u)){ const post = r.request().method() === 'POST'; return J(post ? { route: [30000142, 30000144, 30000139, 30002187] } : [30000142, 30000144, 30000139, 30002187]); }
        if (/\/route\/30000142\/30000144/.test(u)) return r.abort();
        if (/system_kills/.test(u)) return J([{ system_id: 30000142, ship_kills: 9, pod_kills: 4, npc_kills: 0 }]);
        if (/system_jumps/.test(u)) return J([{ system_id: 30000142, ship_jumps: 3300 }]);
        if (/sovereignty\/map/.test(u)) return J([{ system_id: 30004759, alliance_id: 99000001 }, { system_id: 30004760, alliance_id: 99000001 }, { system_id: 30004761, faction_id: 500001 }]);
        if (/alliances\/99000001/.test(u)) return J({ ticker: 'TESTA' });
        if (/fw\/systems/.test(u)) return J([{ solar_system_id: 30002813, owner_faction_id: 500001, occupier_faction_id: 500004, contested: 'contested' }]);
        if (/eve-scout/.test(u)) return J([{ signature_type: 'wormhole', out_system_id: 31000005, out_system_name: 'Thera', in_system_id: 30000144, in_system_name: 'Perimeter', expires_at: '2099-01-01T00:00:00Z' }]);
        if (/universe\/ids/.test(u)){ const n = JSON.parse(r.request().postData() || '[]'); const M = { jita: 30000142, amarr: 30002187, perimeter: 30000144 }; return J({ systems: n.filter(x => M[x.toLowerCase()]).map(x => ({ id: M[x.toLowerCase()], name: x })) }); }
        if (/sovereignty\/structures/.test(u)) return J([{ solar_system_id: 30004759, structure_type_id: 32458, alliance_id: 1, vulnerable_start_time: '2026-10-24T09:30:00Z', vulnerable_end_time: '2026-10-24T12:30:00Z' }, { solar_system_id: 30004760, structure_type_id: 32226, vulnerable_start_time: '2026-10-24T01:00:00Z' }]);
        return /^file:/.test(u) ? r.continue() : r.abort(); });
      await p.addInitScript(l => { if (!sessionStorage.getItem('x')){ sessionStorage.setItem('x', 1); localStorage.setItem('eve-zentrale-lang-v1', l); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); } }, lang);
      await p.goto('file:///home/claude/EVECore.html'); await tick(1200);
      await p.evaluate(() => document.getElementById('neo-btn-jump').click()); await tick(200);
      await p.evaluate(() => document.getElementById('nav-sub-map').click()); await tick(400);
      const lit = () => p.evaluate(() => { const c = document.querySelector('#km-big canvas'), g = c.getContext('2d'), a = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 600) n++; return n; });
      assert(await p.evaluate(() => !document.querySelector('#nav-map-wrap .mp-wrap, #mp-svg') && !!document.querySelector('#km-big canvas').offsetParent), lang + ': Karte zeigt sofort die neue Karte (ohne Umschalter)');
      assert(await lit() > 500, lang + ': Leinwand zeigt helle Sterne');
      const jp = () => p.evaluate(() => { const h = document.querySelector('#km-big .km'), M = window.__MP_SCH, KP = window.__KM_POS.p; let id = 0, o = null; M.s.forEach((a, i) => { id += a[0]; if (id === 30000142) o = [0, KP[i * 2] / 10, KP[i * 2 + 1] / 10]; });
        const r = h.getBoundingClientRect(), vb = h.__vb, k = Math.min(r.width / vb[2], r.height / vb[3]); return [r.left + (r.width - vb[2] * k) / 2 + (o[1] - vb[0]) * k, r.top + (r.height - vb[3] * k) / 2 + (o[2] - vb[1]) * k]; });
      for (let i = 0; i < 5; i++){ const j = await jp(); await p.mouse.move(j[0], j[1]); await p.mouse.wheel(0, -300); await tick(120); }
      await tick(1600);
      const st = await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-map-v1')));
      assert(Array.isArray(st.kmV) && st.kmV[2] < 120, lang + ': Mausrad zoomt, Ausschnitt nach dem Loslassen gemerkt (' + (st.kmV || []).join(',') + ')');
      const vz = await p.evaluate(() => document.querySelector('#km-big .km').__vb.join());
      await p.click('#km-big [data-kmp="om"]'); await tick(150); await p.click('#km-big [data-kmom="mn"]'); await tick(300); await p.click('#km-big [data-kmom="mn"]'); await tick(300); await p.click('#km-big [data-kmp="om"]'); await tick(150);
      assert(await p.evaluate(() => document.querySelector('#km-big .km').__vb.join()) === vz, lang + ': K8d Aktualisierung nach dem Zoomen holt den alten Ausschnitt nicht zurück');
      const j = await jp(); await p.mouse.click(j[0], j[1]); await tick(300);
      assert(await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmSel) === '30000142', lang + ': Klick wählt Jita');
      const v0 = await p.evaluate(() => document.querySelector('#km-big .km').__vb.join());
      await p.mouse.move(j[0], j[1]); await p.mouse.down(); await p.mouse.move(j[0] + 120, j[1] + 40, { steps: 5 }); await p.mouse.up(); await tick(600);
      assert(await p.evaluate(v0 => document.querySelector('#km-big .km').__vb.join() !== v0 && JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmSel === '30000142', v0), lang + ': Ziehen verschiebt, Auswahl bleibt');
      // Vergrößerung (CSS zoom wie Overlay-Größe): Maus trifft trotzdem das System darunter
      await p.evaluate(() => { document.getElementById('km-big').style.zoom = '1.4'; }); await tick(300);
      const zp = await p.evaluate(() => { const h = document.querySelector('#km-big .km'), M = window.__MP_SCH, KP = window.__KM_POS.p; let id = 0, o = null; M.s.forEach((a, i) => { id += a[0]; if (id === 30000144) o = [0, KP[i * 2] / 10, KP[i * 2 + 1] / 10]; });
        const r = h.getBoundingClientRect(), z = r.width / h.clientWidth, vb = h.__vb, W = h.clientWidth, H = h.clientHeight, k = Math.min(W / vb[2], H / vb[3]);
        return [r.left + ((W - vb[2] * k) / 2 + (o[1] - vb[0]) * k) * z, r.top + ((H - vb[3] * k) / 2 + (o[2] - vb[1]) * k) * z]; });
      await p.mouse.move(zp[0] - 20, zp[1]); await p.mouse.move(zp[0], zp[1], { steps: 3 }); await tick(300);
      assert(await p.evaluate(() => { const h = document.querySelector('#km-big .km'); return h.__hov && h.__hov.n; }) === 'Perimeter', lang + ': mit Vergrößerung 1,4 trifft die Maus Perimeter (blauer Ring am richtigen System)');
      await p.evaluate(() => { const h = document.querySelector('#km-big .km'); h.__vb = h.__vb.slice(); window.dispatchEvent(new Event('resize')); }); await p.mouse.wheel(0, 1); await tick(900);
      assert(await p.evaluate(() => { const h = document.querySelector('#km-big .km'), c = h.querySelector('canvas'); return Math.abs(c.width - Math.round(h.clientWidth * 1.4 * devicePixelRatio)) <= 2; }), lang + ': mit Vergrößerung 1,4 zeichnet die Leinwand in voller Auflösung (scharf)');
      await p.evaluate(() => { document.getElementById('km-big').style.zoom = ''; }); await tick(200);
      // K2: Tooltip nach kurzem Verweilen (Ring sofort)
      await p.mouse.move(zp[0] - 30, zp[1]); await tick(100);
      const pp = await p.evaluate(() => { const h = document.querySelector('#km-big .km'), M = window.__MP_SCH, KP = window.__KM_POS.p; let o = null; M.s.forEach((a, i) => { if (a[6] === 'Perimeter') o = [KP[i * 2] / 10, KP[i * 2 + 1] / 10]; });
        const r = h.getBoundingClientRect(), vb = h.__vb, k = Math.min(r.width / vb[2], r.height / vb[3]); return [r.left + (r.width - vb[2] * k) / 2 + (o[0] - vb[0]) * k, r.top + (r.height - vb[3] * k) / 2 + (o[1] - vb[1]) * k]; });
      await p.mouse.move(pp[0], pp[1], { steps: 3 }); await tick(150);
      assert(await p.evaluate(() => { const t = document.querySelector('#km-big .km-tip'); return !t || t.hidden; }), lang + ': Tooltip noch nicht sofort');
      await tick(600);
      const tip = await p.evaluate(() => { const t = document.querySelector('#km-big .km-tip'); return t && !t.hidden ? t.innerText : ''; });
      assert(/Perimeter/.test(tip) && /Highsec/.test(tip) && /The Forge/.test(tip) && /Kimotoro/.test(tip) && (lang === 'de' ? /NPC-Stationen/ : /NPC stations/).test(tip), lang + ': Tooltip mit Sicherheit, Region, Konstellation, Stationen');
      assert(/K1 V/.test(tip) && (lang === 'de' ? /4\.796 K/.test(tip) && /14,8 AU/.test(tip) && /Äußerste Umlaufbahn/.test(tip) && /0,949/.test(tip) : /4,796 K/.test(tip) && /14\.8 AU/.test(tip) && /Outermost orbit/.test(tip) && /0\.949/.test(tip)) && /4 Barren, 1 Gas, 5 Temperate/.test(tip), lang + ': K3 Tooltip: Stern, Planeten je Typ, Umlaufbahn, Truesec');
      // K2: Rechtsklick-Menü
      await p.mouse.click(pp[0], pp[1], { button: 'right' }); await tick(250);
      const mt = await p.evaluate(() => { const m = document.querySelector('#km-big .km-ctx'); return m ? m.innerText.split(String.fromCharCode(10)).join('|') : ''; });
      assert(lang === 'de' ? /Route hierher/.test(mt) && /Ziel in EVE setzen/.test(mt) && /Region einpassen: The Forge/.test(mt) && /zKillboard/.test(mt) : /Set destination in EVE/.test(mt) && /Fit region: The Forge/.test(mt) && /Copy system ID/.test(mt), lang + ': Rechtsklick-Menü ' + mt);
      await p.click('#km-big .km-ctx [data-kmc="avoid"]'); await tick(300);
      assert(await p.evaluate(() => ((JSON.parse(localStorage.getItem('eve-zentrale-esiroute-v1') || '{}').avoid) || []).indexOf('Perimeter') >= 0 && !document.querySelector('.km-ctx')), lang + ': Menüpunkt „Meiden“ trägt Perimeter in die Meiden-Liste ein und schließt');
      await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('eve-zentrale-esiroute-v1')); r.avoid = []; localStorage.setItem('eve-zentrale-esiroute-v1', JSON.stringify(r)); });
      // K2: Suche
      await p.fill('#km-big .km-q', 'Amar'); await tick(200);
      assert(await p.evaluate(() => /Amarr/.test(document.querySelector('#km-big .km-sug').innerText) && !document.querySelector('#km-big .km-sug').hidden), lang + ': Suche schlägt Amarr vor');
      await p.press('#km-big .km-q', 'Enter'); await tick(1600);
      assert(await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmSel) === '30002187', lang + ': Enter springt zu Amarr und wählt es');
      // K2: Ansicht + Färben (Hintergrund jetzt in der Karte)
      await p.click('#km-big [data-kmo="bg"]'); await p.selectOption('#km-big .km-c', 'reg'); await p.click('#km-big [data-kmo="sn"]'); await tick(300);
      const so = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('eve-zentrale-map-v1')); return [s.kmBg, s.kmO.c, s.kmO.sn, document.querySelector('#km-big .km').classList.contains('km-nobg')]; });
      assert(so[0] === false && so[1] === 'reg' && so[2] === true && so[3], lang + ': Hintergrund aus, Färben nach Region, Systemnamen an – gespeichert');
      // K3: jede „Färben nach“-Art zeichnet und zeigt ihre Legende; Industrie/Sov lädt der Besitzer von ESI
      const legs = {};
      for (const m of ['sec', 'ts', 'pt', 'st', 'belt', 'ind', 'sov', 'none']){ await p.selectOption('#km-big .km-c', m); await tick(m === 'ind' || m === 'sov' ? 900 : 250);
        legs[m] = await p.evaluate(() => { const l = document.querySelector('#km-big .km-leg'); return l.hidden ? '' : l.innerText.replace(/\s+/g, ' ').trim(); }); }
      assert(legs.sec && legs.ts && legs.pt && /O B A F G K M/.test(legs.st) && /20\+/.test(legs.belt) && /1,2|1\.2/.test(legs.ind) && /UTC/.test(legs.sov) && legs.none === '', lang + ': Legenden ' + JSON.stringify(legs));
      assert(await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('eve-zentrale-kmind-v1')), s = JSON.parse(localStorage.getItem('eve-zentrale-kmsov-v1')); return i.d['30000142'] === 0.0123 && s.d['30004759'][0] === '2026-10-24T09:30:00Z' && !s.d['30004760']; }), lang + ': ESI geladen – Herstellungs-Index und Sov-Fenster (nur Infrastructure Hub) gespeichert');
      assert(await p.evaluate(() => !document.querySelector('#km-big .km-pt').hidden === false), lang + ': Planetentyp-Auswahl nur bei „Planetentyp“');
      await p.selectOption('#km-big .km-c', 'pt'); await tick(150);
      assert(await p.evaluate(() => !document.querySelector('#km-big .km-pt').hidden), lang + ': Planetentyp-Auswahl sichtbar');
      await p.selectOption('#km-big .km-c', 'sec'); await tick(150);
      // K4: Routing
      const H = '#km-big ';
      await p.click(H + '[data-kmp="route"]'); await tick(150);
      assert(await p.evaluate(() => !document.querySelector('#km-big .km-rt').hidden), lang + ': Leiste „Routing“ öffnet das Panel');
      await p.fill(H + '[data-kmf="rf"]', 'Jita'); await p.fill(H + '[data-kmf="rt"]', 'Amarr'); await p.click(H + '[data-kma="calc"]'); await tick(1500);
      let sum = await p.evaluate(() => document.querySelector('#km-big .km-sum').innerText);
      assert(/^3 /.test(sum) && await p.evaluate(() => document.querySelectorAll('#km-big .km-list li').length) === 4, lang + ': Punkt zu Punkt nimmt die Route von EVE (' + sum + ')');
      const ro = await p.evaluate(() => [JSON.parse(localStorage.getItem('eve-zentrale-esiroute-v1')).last, JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.r, document.getElementById('rt-from').value, document.getElementById('rt-to').value]);
      assert(ro[0].route.join() === '30000142,30000144,30000139,30002187' && ro[1] === null && ro[2] === 'Jita' && ro[3] === 'Amarr', lang + ': K4b – Route läuft über den Omni-Routenplaner (Reiseroute: Felder + gespeicherte Route), Karte zeigt sie');
      assert(await p.evaluate(() => { const c = document.querySelector('#km-big .km-cv2'); return c && c.width > 0; }), lang + ': K4b – eigene Leinwand für die fließende Route');
      await p.fill(H + '[data-kmf="rt"]', 'Perimeter'); await p.click(H + '[data-kma="calc"]'); await tick(1500);
      sum = await p.evaluate(() => document.querySelector('#km-big .km-rt .km-pb').innerText);
      assert(/^1 /.test(await p.evaluate(() => document.querySelector('#km-big .km-sum').innerText)) && (lang === 'de' ? /eigene Berechnung/ : /own calculation/).test(sum), lang + ': EVE nicht erreichbar → eigene Berechnung mit Hinweis');
      await p.click(H + '[data-kmt="range"]'); await p.fill(H + '[data-kmf="gf"]', 'Tama'); await p.click(H + '[data-kma="range"]'); await tick(400);
      assert(/^136 /.test(await p.evaluate(() => document.querySelector('#km-big .km-sum').innerText)), lang + ': Sprungreichweite JF (JDC V, 10 ly) ab Tama: 136 Systeme');
      await p.click(H + '[data-kmt="jump"]'); await p.fill(H + '[data-kmf="jf"]', 'Tama'); await p.fill(H + '[data-kmf="jt"]', '1DQ1-A'); await p.click(H + '[data-kma="jcalc"]'); await tick(800);
      const jl = await p.evaluate(() => [...document.querySelectorAll('#km-big .km-list li')].map(li => li.innerText));
      assert(jl.length === 7 && /Tama/.test(jl[0]) && /1DQ1-A/.test(jl[6]) && jl.slice(1).every(x => parseFloat(x.split(String.fromCharCode(10)).pop().replace(',', '.')) <= 10), lang + ': Sprungplaner Tama → 1DQ1-A in 6 Sprüngen, jeder ≤ 10 ly');
      await p.fill(H + '[data-kmf="jt"]', 'Jita'); await p.click(H + '[data-kma="jcalc"]'); await tick(300);
      assert((lang === 'de' ? /Highsec/ : /highsec/).test(await p.evaluate(() => document.querySelector('#km-big .km-rt .km-pb').innerText)), lang + ': Sprungziel im Highsec → Hinweis');
      await p.click(H + '[data-kma="close"]'); await tick(150);
      assert(await p.evaluate(() => document.querySelector('#km-big .km-rt').hidden), lang + ': × schließt das Panel');
      // K7: Kippen – Knopf kippt weich, Maus trifft im gekippten Bild, rechte Taste ziehen kippt ohne Menü, Knopf zurück = Draufsicht
      await p.click(H + '[data-kmtl]'); await tick(1500);
      const tl = await p.evaluate(() => [document.querySelector('#km-big .km').__tl, JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.tl]);
      assert(tl[0] > 0.9 && Number(tl[1]) === 55, lang + ': Kippen → 55° (' + tl.join(' / ') + ')');
      const tp = await p.evaluate(() => { const h = document.querySelector('#km-big .km'), P = h.__P, W = h.clientWidth, Hh = h.clientHeight, M = window.__MP_SCH; let bi = -1, bd = 1e9;
        for (let i = 0; i < P.x.length; i++){ const d = Math.hypot(P.x[i] - W * 0.6, P.y[i] - Hh * 0.55); if (d < bd){ bd = d; bi = i; } } const r = h.getBoundingClientRect(); return [r.left + P.x[bi], r.top + P.y[bi], M.s[bi][6]]; });
      await p.mouse.move(tp[0] - 20, tp[1]); await p.mouse.move(tp[0], tp[1], { steps: 3 }); await tick(200);
      assert(await p.evaluate(() => (document.querySelector('#km-big .km').__hov || {}).n) === tp[2], lang + ': gekippt trifft die Maus ' + tp[2]);
      await p.mouse.move(700, 500); await p.mouse.down({ button: 'right' }); await p.mouse.move(700, 560, { steps: 5 }); await p.mouse.up({ button: 'right' }); await tick(300);
      assert(await p.evaluate(() => { const a = document.querySelector('#km-big .km').__tl; return a > 0.3 && a < 0.9 && !document.querySelector('.km-ctx'); }), lang + ': rechte Taste ziehen kippt (kein Menü)');
      await p.click(H + '[data-kmtl]'); await tick(1500);
      assert(await p.evaluate(() => document.querySelector('#km-big .km').__tl === 0 && Number(JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.tl) === 0), lang + ': Knopf zurück = Draufsicht');
      // K8b: rechte Taste links/rechts dreht (ohne Menü, ohne Kippen), Maus trifft im gedrehten Bild, Knopf = Draufsicht dreht zurück
      await p.mouse.move(700, 500); await p.mouse.down({ button: 'right' }); await p.mouse.move(790, 503, { steps: 6 }); await p.mouse.up({ button: 'right' }); await tick(300);
      const rot8 = await p.evaluate(() => { const h = document.querySelector('#km-big .km'); return [h.__rot, h.__tl, Number(JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.rot), !!document.querySelector('.km-ctx')]; });
      assert(rot8[0] > 0.4 && rot8[1] === 0 && Math.abs(rot8[2] - rot8[0] * 180 / Math.PI) < 0.1 && !rot8[3], lang + ': K8b rechte Taste seitwärts dreht (' + rot8[2] + '°), kein Kippen, kein Menü');
      const rp = await p.evaluate(() => { const h = document.querySelector('#km-big .km'), P = h.__P, W = h.clientWidth, Hh = h.clientHeight, M = window.__MP_SCH; let bi = -1, bd = 1e9;
        for (let i = 0; i < P.x.length; i++){ const d = Math.hypot(P.x[i] - W * 0.4, P.y[i] - Hh * 0.45); if (d < bd){ bd = d; bi = i; } } const r = h.getBoundingClientRect(); return [r.left + P.x[bi], r.top + P.y[bi], M.s[bi][6]]; });
      await p.mouse.move(rp[0] - 20, rp[1]); await p.mouse.move(rp[0], rp[1], { steps: 3 }); await tick(200);
      assert(await p.evaluate(() => (document.querySelector('#km-big .km').__hov || {}).n) === rp[2], lang + ': K8b gedreht trifft die Maus ' + rp[2]);
      assert(await p.evaluate(() => document.querySelector('#km-big [data-kmtl]').getAttribute('aria-pressed')) === 'true', lang + ': K8b Knopf zeigt „gedreht“ an');
      await p.click(H + '[data-kmtl]'); await tick(1500);
      assert(await p.evaluate(() => { const h = document.querySelector('#km-big .km'); return Math.abs(Math.sin(h.__rot)) < 0.01 && Math.cos(h.__rot) > 0.99 && h.__tl === 0 && Number(JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.rot) === 0; }), lang + ': K8b Draufsicht dreht zurück');
      await p.mouse.move(700, 500); await p.mouse.down({ button: 'right' }); await p.mouse.move(780, 500, { steps: 5 }); await p.mouse.move(780, 440, { steps: 5 }); await p.mouse.up({ button: 'right' }); await tick(300);
      assert(await p.evaluate(() => { const h = document.querySelector('#km-big .km'); return h.__rot > 0.4 && h.__tl > 0.3; }), lang + ': rechte Taste – erst drehen, dann kippen in einem Zug (ohne Loslassen)');
      await p.click(H + '[data-kmtl]'); await tick(1500);
      // K1c: 2D = Schema-Lage aus dem Spiel, Ausschnitt bleibt beim selben System, Lichtjahre weiter echt
      const scr = () => p.evaluate(() => { const h = document.querySelector('#km-big .km'), o = h.__st.sel && null; const W = h.clientWidth, Hh = h.clientHeight, vb = h.__vb, k = Math.min(W / vb[2], Hh / vb[3]);
        const sid = h.__st.sel, M = window.__MP_SCH, KP = window.__KM_POS.p, two = (JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO || {}).lay === '2d'; let id = 0, x = 0, y = 0;
        M.s.forEach((a, i) => { id += a[0]; if (String(id) === String(sid)){ x = two ? a[1] : KP[i * 2] / 10; y = two ? a[2] : KP[i * 2 + 1] / 10; } });
        return [(W - vb[2] * k) / 2 + (x - vb[0]) * k, (Hh - vb[3] * k) / 2 + (y - vb[1]) * k, sid]; });
      const ly0 = await scr();
      await p.click(H + '[data-kmo="lay"]'); await tick(600);
      const l2 = await scr(), lp = await p.evaluate(() => [JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.lay, document.querySelector('#km-big [data-kmo="lay"]').getAttribute('aria-pressed')]);
      assert(ly0[2] && lp[0] === '2d' && lp[1] === 'true' && Math.abs(l2[0] - ly0[0]) < 2 && Math.abs(l2[1] - ly0[1]) < 2, lang + ': K1c 2D – Schema-Lage, gewähltes System bleibt an derselben Bildschirmstelle (' + ly0.slice(0, 2).map(Math.round) + ' → ' + l2.slice(0, 2).map(Math.round) + ')');
      await p.click(H + '[data-kmo="lay"]'); await tick(600);
      const l3 = await scr();
      assert(Math.abs(l3[0] - ly0[0]) < 2 && Math.abs(l3[1] - ly0[1]) < 2, lang + ': K1c zurück zur echten Lage – wieder an derselben Stelle');
      // K5a: Ebenen
      await p.click(H + '[data-kmlay]'); await tick(150);
      const ln = await p.evaluate(() => [...document.querySelectorAll('#km-big .km-lay [data-kml]')].map(c => c.getAttribute('data-kml') + (c.checked ? '+' : '')).join());
      assert(ln === 'live+,alarm,camps,kills,jumps,act,sov,fw,wh,reg', lang + ': Ebenen-Liste, Standard Live-Kills (' + ln + ')');
      for (const l of ['kills', 'sov', 'fw', 'wh']) await p.click(H + '[data-kml="' + l + '"]');
      await tick(2500);
      const ex = await p.evaluate(() => { const g = k => JSON.parse(localStorage.getItem('eve-zentrale-' + k + '-v1') || 'null'); return [g('kmkj'), g('kmsovm'), g('kmfw'), g('kmth'), JSON.parse(localStorage.getItem('eve-zentrale-map-v1')).kmO.ly]; });
      assert(ex[0].d.k['30000142'].join() === '9,4,0' && ex[0].d.j['30000142'] === 3300 && ex[1].d['30004759'] === 99000001 && !ex[1].d['30004761'] && ex[1].tk['99000001'] === 'TESTA' && ex[2].d['30002813'].join() === '500001,500004,1' && ex[3].d[0].join() === '30000144,Thera' && ex[4].kills && ex[4].sov, lang + ': Ebenen-Daten geladen (Kills/Verkehr, Sov + Kürzel ohne Fraktionen, FW umkämpft, Thera bei Perimeter) und Auswahl gespeichert');
      assert(await p.evaluate(() => /\(5\)/.test(document.querySelector('#km-big [data-kmlay]').innerText)), lang + ': Zähler „Ebenen (5)“');
      for (const l of ['kills', 'sov', 'fw', 'wh']) await p.click(H + '[data-kml="' + l + '"]');
      await p.click(H + '[data-kmlay]');
      // K5b: Aktivität
      const rec = await p.evaluate(() => new Promise(res => { const rq = indexedDB.open('eve-zentrale-kmact-v1'); rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains('h')){ db.close(); res(null); return; }
        const tx = db.transaction(['h', 'd']), a = tx.objectStore('h').getAll(), b = tx.objectStore('d').getAll(); tx.oncomplete = () => { db.close(); res([a.result, b.result]); }; }; rq.onerror = () => res(null); }));
      assert(rec && rec[0].length === 1 && rec[0][0].j['30000142'] === 3300 && rec[0][0].s['30000142'] === 9 && rec[1][0].hrs === 1 && rec[1][0].p['30000142'] === 4, lang + ': K5b – Stunde und Tag in IndexedDB aufgezeichnet');
      await p.click(H + '[data-kmp="act"]'); await tick(1500);
      let at = await p.evaluate(() => document.querySelector('#km-big .km-act').innerText);
      assert(!await p.evaluate(() => document.querySelector('#km-big .km-act').hidden) && await p.evaluate(() => document.querySelector('#km-big .km-rt').hidden), lang + ': Aktivität öffnet ihr Panel (Routing zu)');
      await p.fill('#km-big .km-q', 'Jita'); await p.press('#km-big .km-q', 'Enter'); await tick(1600);
      at = await p.evaluate(() => [...document.querySelectorAll('#km-big .km-at tr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()).join('|'));
      assert(/^1h (3\.300|3,300)\|3h (3\.300|3,300) \*\|/.test(at), lang + ': Werte von Jita je Zeitraum (' + at + ')');
      await p.click(H + '[data-kacm="s"]'); await tick(1500);
      at = await p.evaluate(() => { const r = document.querySelector('#km-big .km-at tr'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : 'PANEL: ' + document.querySelector('#km-big .km-act').innerText.slice(-200); });
      assert(/^1h 9$/.test(at) && await p.evaluate(() => JSON.parse(localStorage.getItem('eve-zentrale-kmact-v1')).m === 's'), lang + ': Kennzahl Schiffe → 9 Kills in Jita (' + at + ')');
      await p.click(H + '[data-kacm="j"]'); await p.click(H + '[data-kmp="act"]'); await tick(300);
      const t = await p.evaluate(() => ['', document.querySelector('#km-big [data-kmo="bg"]').textContent, document.querySelector('#km-big .km-q').placeholder]);
      assert(lang === 'de' ? t[1] === 'Hintergrund' && t[2] === 'System oder Region suchen …' : t[1] === 'Background' && t[2] === 'Search system or region …', lang + ': Texte ' + t.join(' | '));
      assert(!errs.length, lang + ': keine Skriptfehler ' + errs.join(' / '));
      await p.close();
    }
    await br.close();
    console.log('ALL BI TESTS PASSED');
  }catch(e){ console.error(e.message); console.log('FAILED'); process.exit(1); }
})();
