// 15.10.2026 PROD P1: Oberfläche Produktions-Planer (jsdom) – Blaupause wählen, Besitzer-Filter, Profil speichern/laden,
// Ergebnis ändert sich bei Preis/Läufen, fehlender Preis markiert, Kopier-Knöpfe exakt, Item-Suche, Reiter + Overlay angemeldet
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true }).window;
(async () => {
  try{
    await tick(800);
    const P = w.__test.pd, d = w.document, T = w.__test;
    const view = () => { const b = d.createElement('div'); P.view(b, false); return b; };
    const kv = (b, label) => { const r = [...b.querySelectorAll('.pd-k')].find(x => x.firstChild.textContent.trim() === label); return r && r.lastChild; };
    P.busy(true);   // keine Netzabfragen
    // Reiter + Overlay angemeldet
    assert(d.getElementById('in-view-prod') && d.getElementById('pd-page'), 'Industrie › Reiter „Produktion“ vorhanden');
    assert(T.ovViews().produktion === 'Produktion' && /data-neo="prod"/.test(T.neoOverlayHtml()), 'Overlay „Produktion“ + OmniCom-Overlay-Symbol');
    w.localStorage.setItem('eve-zentrale-neoseen-v1', JSON.stringify(['neo-btn-station', 'neo-btn-workbench']));
    assert(T.neoIsNew('prod') && !T.neoIsNew('workbench'), 'Bestehender Nutzer: „Produktion“ trägt NEU');
    d.getElementById('in-view-prod').onclick(); await tick(20);
    assert(!d.getElementById('in-prod-wrap').hidden && /Rezepte Stand/.test(d.getElementById('pd-page').textContent), 'Reiter zeigt den Planer mit Info-Zeile');
    // ohne geladene Blaupausen
    assert(/Industrie laden/.test(view().textContent), 'Ohne Blaupausen: Hinweis „Industrie laden“');
    // Blaupausen zweier Charaktere
    P.setInD({ bps: [
      { i: '1', c: '91', cn: 'Pilot Eins', t: 967, n: 'Caldari Shuttle Blueprint', q: -1, me: 10, te: 20, r: -1 },
      { i: '2', c: '92', cn: 'Pilot Zwei', t: 1404, n: 'Inertial Stabilizers I Blueprint', q: -2, me: 5, te: 10, r: 7 },
      { i: '3', c: '92', cn: 'Pilot Zwei', t: 999999, n: 'Unbekannt Blueprint', q: -1, me: 0, te: 0, r: -1 } ] });
    let b = view();
    assert(b.querySelectorAll('.pd-pick').length === 2, 'Liste: nur Blaupausen mit Rezept');
    assert(b.querySelectorAll('[data-ova=pdOwn]').length === 3 && b.querySelectorAll('.pd-pick img.pd-ow').length === 2, 'Besitzer: Filter je Charakter + Mini-Porträt je Zeile');
    await P.action({ type: 'pdOwn', arg: '92' }); b = view();
    assert(b.querySelectorAll('.pd-pick').length === 1 && /Inertial/.test(b.textContent), 'Filter Pilot Zwei');
    await P.action({ type: 'pdOwn', arg: '92' });
    await P.action({ type: 'pdKind', arg: 'copy' }); b = view();
    assert(b.querySelectorAll('.pd-pick').length === 1 && /Kopie/.test(b.textContent), 'Filter Kopien');
    await P.action({ type: 'pdKind', arg: 'all' });
    // Blaupause wählen → ME/TE übernommen
    await P.action({ type: 'pdPick', arg: 'b:1' });
    let st = P.load();
    assert(st.pick.i === '1' && st.me === 10 && st.te === 20 && st.runs === 1, 'Blaupause gewählt: ME 10 / TE 20 übernommen');
    // Daten setzen: Azbel-Profil, Preise
    Object.assign(P.adj, { 34: 3.327 });
    P.sci().m[30000142] = 0.0247; P.sci().t = Date.now();
    const px = P.px(); px[34] = { t: Date.now(), s: 4, b: 3.5 }; px[672] = { t: Date.now(), s: 20000, b: 18000 };
    await P.action({ type: 'pdSet:f', arg: 'azbel' }); await P.action({ type: 'pdSet:tax', arg: '1,9' });
    b = view();
    assert(b.querySelectorAll('.pd-m:not(.as-hd)').length === 1 && /2\.476/.test(b.querySelector('.pd-m:not(.as-hd)').textContent), 'Material: 2.476 Tritanium (ME 10 + Azbel)');
    const job1 = kv(b, 'Gesamtkosten Job').textContent, prof1 = kv(b, 'Gewinn netto gesamt').textContent;
    assert(/ISK/.test(job1) && /^\+/.test(prof1), 'Kostenaufstellung + Gewinn gezeigt (' + job1 + ', ' + prof1 + ')');
    assert(/mehr als die Materialien direkt zu verkaufen/.test(b.textContent), 'Vergleich „Material direkt verkaufen“');
    // GitHub #6: Zahlenfeld liefert „1.9“ (Punkt), Pfeiltasten „1.95“ – nicht 19 bzw. 100 %
    const prof = () => { const D = P.load(); return D.prof[D.cur]; };
    for (const [inV, want] of [['1.9', 1.9], ['1.95', 1.95], ['1,9', 1.9], ['0.25', 0.25], ['3', 3]]){ await P.action({ type: 'pdSet:tax', arg: inV }); assert(prof().tax === want, '#6 Anlagensteuer „' + inV + '“ → ' + prof().tax + ' %'); }
    await P.action({ type: 'pdSet:tax', arg: '1.9' });
    // GitHub #7: Kostenindex von Hand (Wurmloch) – ersetzt den ESI-Wert, nur für dieses System, leer = wieder ESI
    b = view();
    assert(b.querySelector('input[data-ova-change="pdSet:sci"]') && /2,47 %/.test(b.textContent) && !/von Hand\)/.test(b.textContent), '#7 Feld „von Hand“ da, ESI-Index 2,47 %');
    await P.action({ type: 'pdSet:sci', arg: '12.5' }); b = view();
    const job2 = kv(b, 'Gesamtkosten Job').textContent;
    assert(/12,5 %/.test(b.textContent) && /\(von Hand\)/.test(b.textContent) && job2 !== job1, '#7 Index von Hand 12,5 % gilt + gekennzeichnet, Jobkosten neu (' + job1 + ' → ' + job2 + ')');
    assert(b.querySelector('input[data-ova-change="pdSet:sci"]').value === '12.5', '#7 eigener Wert bleibt im Feld');
    const sidWas = prof().sid; prof().sid = 31000005; assert(P.calc(P.inputs(P.load(), P.picked(P.load()))).sci !== 0.125, '#7 anderes System: Wert von Hand gilt nicht'); prof().sid = sidWas;
    await P.action({ type: 'pdSet:sci', arg: '' }); b = view();
    assert(/2,47 %/.test(b.textContent) && !/von Hand\)/.test(b.textContent) && kv(b, 'Gesamtkosten Job').textContent === job1, '#7 Feld leer → wieder Wert von EVE');
    // Kopier-Knöpfe exakt
    const z = P.calc(P.inputs(P.load(), P.picked(P.load())));
    const be = kv(b, 'Break-even je Stück').querySelector('[data-copy]').getAttribute('data-copy');
    assert(be === String(P.priceUp(z.be)).replace(/\.?0+$/, '') || +be === P.priceUp(z.be), 'Break-even kopiert exakt ' + be);
    assert(+be >= z.be && +be - z.be < 10, 'Break-even ist gültiger EVE-Preis ≥ genauem Wert');
    assert(kv(b, 'Verkaufspreis je Stück').querySelector('[data-copy]').getAttribute('data-copy') === '20000', 'Verkaufspreis kopiert 20000');
    const mb = [...b.querySelectorAll('[data-copy]')].find(x => /Multibuy/.test(x.title + x.parentNode.textContent));
    assert(mb && mb.getAttribute('data-copy') === 'Tritanium 2476', 'Einkaufsliste (Multibuy): „Tritanium 2476“');
    // Preis ändern → neu gerechnet
    px[672].s = 30000; b = view();
    assert(kv(b, 'Gewinn netto gesamt').textContent !== prof1, 'Produktpreis geändert → Gewinn neu');
    await P.action({ type: 'pdSet:runs', arg: '5' }); b = view();
    assert(/12\.376/.test(b.querySelector('.pd-m:not(.as-hd)').textContent) && kv(b, 'Gesamtkosten Job').textContent !== job1, '5 Läufe → 12.376 Tritanium, Job-Kosten neu');
    // habe ich schon → raus aus der Einkaufsliste
    await P.action({ type: 'pdHave', arg: '34' }); b = view();
    assert(![...b.querySelectorAll('[data-copy]')].some(x => /Tritanium \d/.test(x.getAttribute('data-copy'))), '„habe ich schon“: nicht in der Einkaufsliste');
    await P.action({ type: 'pdHave', arg: '34' });
    // fehlender Preis
    delete px[34]; b = view();
    assert(/Preis fehlt/.test(b.textContent) && b.querySelector('.pd-miss') && /–/.test(kv(b, 'Gewinn netto gesamt').textContent), 'Fehlender Preis rot markiert, kein Gewinn statt 0');
    px[34] = { t: Date.now(), s: 4, b: 3.5 };
    // von Hand
    await P.action({ type: 'pdSet:mp', arg: 'hand' }); b = view();
    assert(b.querySelector('input[data-ova-change="pdSet:hand:34"]') && /Preis fehlt/.test(b.textContent), 'Preis von Hand: Eingabefeld, leer = fehlt');
    await P.action({ type: 'pdSet:hand:34', arg: '5' }); b = view();
    assert(/61\.880/.test(kv(b, 'Material gesamt').textContent), 'Handpreis 5 × 12.376 = 61.880');
    await P.action({ type: 'pdSet:mp', arg: 'sell' });
    // Profil speichern / laden / löschen
    await P.action({ type: 'pdProfSave', form: { pdpn: 'Azbel Test' } });
    st = P.load();
    assert(st.prof.length === 2 && st.prof[st.cur].n === 'Azbel Test' && st.prof[st.cur].f === 'azbel' && st.prof[st.cur].tax === 1.9, 'Profil gespeichert (Azbel, 1,9 %)');
    await P.action({ type: 'pdSet:prof', arg: '0' }); await P.action({ type: 'pdSet:f', arg: 'npc' });
    await P.action({ type: 'pdSet:prof', arg: '1' });
    st = JSON.parse(w.localStorage.getItem('eve-zentrale-prod-v1'));
    assert(st.prof[st.cur].f === 'azbel' && st.prof[0].f === 'npc', 'Profilwechsel lädt die gespeicherten Werte');
    await P.action({ type: 'pdProfDel' });
    assert(P.load().prof.length === 1, 'Profil gelöscht');
    // Item-Suche
    await P.action({ type: 'pdClear' }); await P.action({ type: 'pdSrc', arg: 'item' });
    await P.action({ type: 'pdFind', form: { pdq: 'caldari shuttle' } }); b = view();
    assert(b.querySelectorAll('.pd-pick').length >= 1 && /Caldari Shuttle/.test(b.textContent), 'Item-Suche findet Caldari Shuttle');
    await P.action({ type: 'pdPick', arg: 't:967' }); st = P.load();
    assert(st.pick.b === 967 && st.me === 0 && st.te === 0, 'Beliebiges Item: ME/TE 0/0');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
