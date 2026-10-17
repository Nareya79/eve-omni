// AA13 (30.09.2026): Skillpläne – Voraussetzungen automatisch, Import „Skill Stufe“ deutsch/englisch, Restzeit mit Attributen, Abgleich Warteschlange,
// Reihenfolge-Warnung, Remap-Hinweis, Injektor-Rechner (SP-Stufen), Hauptfenster + Overlay-Karte
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const at = o => Object.keys(o).map(k => ({ attribute_id: +k, value: o[k] }));
// Skill: [Name, Rang, Primär, Sekundär, Voraussetzungen {Attr: Wert}]
const SK = { 3327: ['Spaceship Command', 1, 167, 168, {}], 3380: ['Industry', 1, 165, 166, {}], 3386: ['Mining', 1, 167, 168, {}],
  3410: ['Astrogeology', 3, 167, 168, { 182: 3386, 277: 4 }], 22551: ['Exhumers', 5, 168, 167, { 182: 3327, 277: 4, 183: 3380, 278: 5, 184: 3410, 279: 5 }] };
const EN = { exhumers: 22551, astrogeology: 3410, mining: 3386 }, DE = { astrogeologie: 3410, bergbau: 3386 };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }]));
    w.fetch = (u, o) => { u = String(u); let m;
      if ((m = /universe\/types\/(\d+)/.exec(u))){ const s = SK[m[1]]; return s ? json({ name: s[0], mass: 0, capacity: 0, dogma_attributes: at(Object.assign({ 275: s[1], 180: s[2], 181: s[3] }, s[4])), dogma_effects: [] }) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }); }
      if (/universe\/ids/.test(u)){ const map = /language=de/.test(u) ? DE : EN; return json({ inventory_types: JSON.parse(o.body).filter(n => map[n.toLowerCase()]).map(n => ({ id: map[n.toLowerCase()], name: n })) }); }
      if (/markets\/10000002\/orders\/.*type_id=40520/.test(u)) return json([{ is_buy_order: false, location_id: 60003760, system_id: 30000142, range: 'region', price: 900e6, volume_remain: 10, min_volume: 1 }]);
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const sp = (r, l) => T.snSpFor(r, l);
    T.sqSet([{ id: '111', name: 'Eins', attrs: { perception: 21, willpower: 27, intelligence: 17, memory: 17, charisma: 17, bonus_remaps: 1 },
      skills: { total_sp: 4.9e6, skills: [{ skill_id: 3327, trained_skill_level: 5, skillpoints_in_skill: sp(1, 5) }, { skill_id: 3380, trained_skill_level: 5, skillpoints_in_skill: sp(1, 5) },
        { skill_id: 3386, trained_skill_level: 4, skillpoints_in_skill: sp(1, 4) }, { skill_id: 3410, trained_skill_level: 2, skillpoints_in_skill: sp(3, 2) + 1000 }] },
      queue: [{ skill_id: 3410, finished_level: 3 }] }]);
    // Parser
    assert(JSON.stringify(T.spParse('Mining Barge 4\nNavigation V\nAstrogeologie\tIII\nQuatsch')) === '[["Mining Barge",4],["Navigation",5],["Astrogeologie",3]]', 'AA13: Import „Skill Stufe“ – Zahl, römisch, Tab');
    // neuer Plan, Exhumers I einfügen -> Astrogeology III–V kommen automatisch davor (Mining IV + SSC/Industry schon gelernt)
    await T.spAction({ type: 'spNew', form: { spcid: '111' } });
    await T.spAction({ type: 'spImport', form: { sptext: 'Exhumers 1' } }); await tick(200);
    let D = T.spLoad(), P = D.plans[0];
    assert(P.cid === '111' && P.items.map(x => x.join(':')).join() === '3410:3,3410:4,3410:5,22551:1', 'AA13: Voraussetzungen automatisch davor (nur was fehlt)');
    // deutscher Name über ESI language=de, schon Geplantes nicht doppelt
    await T.spAction({ type: 'spImport', form: { sptext: 'Astrogeologie V\nBergbau 5' } }); await tick(200);
    P = T.spLoad().plans[0];
    assert(P.items.map(x => x.join(':')).join() === '3410:3,3410:4,3410:5,22551:1,3386:5', 'AA13: deutscher Name erkannt, nichts doppelt');
    // Rechnung
    let X = T.spCalc(P);
    const need3 = sp(3, 3) - (sp(3, 2) + 1000), spmP = 21 + 27 / 2, spmW = 27 + 21 / 2;
    assert(near(X.rows[0].sp, need3) && near(X.rows[0].min, need3 / spmP) && X.rows[0].q && !X.rows[1].q, 'AA13: SP ab dem schon Gelernten, Zeit mit Primär + Sekundär/2, Warteschlange erkannt');
    assert(near(X.rows[3].min, sp(5, 1) / spmW) && X.sum.open === 5 && X.sum.noQ === 4, 'AA13: Exhumers mit Willenskraft/Wahrnehmung, 4 nicht in der Warteschlange');
    const total = X.rows.reduce((s, r) => s + r.sp, 0);
    assert(near(X.sum.sp, total) && near(X.sum.min, X.rows.reduce((s, r) => s + r.min, 0)), 'AA13: Summen');
    assert(X.remap && X.remap.pri === 'Wahrnehmung' && X.remap.sec === 'Willenskraft' && X.remap.save >= 1440 && X.remap.n === 1, 'AA13: Remap-Hinweis Wahrnehmung/Willenskraft spart mehr als einen Tag');
    // Injektoren: unter 5 Mio. SP 500.000, danach 400.000
    let n = 0, tot = 4.9e6, left = total; while (left > 0){ const g = tot < 5e6 ? 5e5 : 4e5; n++; tot += g; left -= g; }
    assert(X.inj.n === n && n === 3, 'AA13: Injektoren mit SP-Stufen (' + n + ')');
    // Reihenfolge: Exhumers ganz nach oben -> Warnung
    await T.spAction({ type: 'spUp', arg: '3' }); await T.spAction({ type: 'spUp', arg: '2' }); await T.spAction({ type: 'spUp', arg: '1' });
    X = T.spCalc(T.spLoad().plans[0]);
    assert(X.rows[0].tid === 22551 && X.rows[0].bad && !X.rows[1].bad, 'AA13: ↑ verschiebt, Warnung wenn Voraussetzung darunter steht');
    await T.spAction({ type: 'spDown', arg: '0' }); await T.spAction({ type: 'spDown', arg: '1' }); await T.spAction({ type: 'spDown', arg: '2' });
    assert(!T.spCalc(T.spLoad().plans[0]).rows.some(r => r.bad), 'AA13: ↓ zurück, keine Warnung');
    // Hauptfenster
    T.switchTab('skills'); T.spPageRender(); await tick(300);
    await T.spAction({ type: 'spPick', arg: T.spLoad().active }); await tick(50);   // BB27: Aktion zeichnet die Seite selbst neu
    const pg = $('spl-page');
    assert(pg && pg.querySelectorAll('.sp-t tr').length === 6 && /noch/.test(pg.querySelector('.sp-sum').textContent) && /4 nicht in der Warteschlange/.test(pg.textContent), 'AA13: Seite Skills › Skillpläne mit Tabelle und Summe');
    assert(/Remap auf Wahrnehmung/.test(pg.textContent) && /Injektoren: 3×/.test(pg.textContent), 'AA13: Remap- und Injektor-Zeile');
    await tick(200); T.spPageRender();
    assert(/2,7 Mrd\. ISK/.test(pg.querySelector('.sp-inj').textContent), 'AA13: Injektor-Kosten aus Jita (3 × 900 Mio.)');
    // Entfernen nimmt höhere Stufen mit
    await T.spAction({ type: 'spRm', arg: '1' });
    assert(T.spLoad().plans[0].items.map(x => x.join(':')).join() === '3410:3,22551:1,3386:5', 'AA13: Entfernen nimmt höhere Stufen desselben Skills mit');
    // zweiter Plan, Overlay-Karte
    await T.spAction({ type: 'spNew', form: { spcid: '111' } });
    await T.spAction({ type: 'spPick', arg: T.spLoad().plans[0].id });
    const box = d.createElement('div'); T.ovRenderViewInto('skills', box);
    const card = box.querySelector('.sp-ov');
    assert(card && /Plan 1/.test(card.textContent) && /Nächster: Astrogeology III/.test(card.textContent) && card.querySelectorAll('[data-ova="spPick"]').length === 2 && card.querySelector('[data-ova="openMain"]'), 'AA13: Overlay – aktiver Plan, Plan wählbar, ⤢ Bearbeiten');
    assert(!box.querySelector('textarea[data-ovf="sptext"]'), 'AA13: Bearbeiten nur im Hauptfenster');
    await T.spAction({ type: 'spDel' });
    assert(T.spLoad().plans.length === 1, 'AA13: Plan löschen');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
