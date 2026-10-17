// EE3 (03.10.2026): Wurmlöcher – Daten von anoik.is im Paket, J-System- und Typ-Suche, Schild am Standort, Overlay-Ansicht
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, d = w.document;
    assert(d.getElementById('wh-data') && d.getElementById('wh-data').textContent.length > 100000, 'EE3a: Wurmloch-Daten stecken in der Datei');
    let s = T.whSys('J111613');
    assert(s && s.cls === 'c5' && s.fx === 'Cataclysmic Variable' && s.st[0].n === 'E175' && s.st[0].dest === 'c4', 'EE3b: J111613 = C5, Cataclysmic Variable, Static E175 → C4');
    assert(T.whSys('111613').n === 'J111613' && T.whSys(31002318).n === 'J111613', 'EE3b: auch ohne J und über die System-ID');
    assert(s.fxRows.some(r => /\+\d+%/.test(r[1])), 'EE3b: Effekt mit echten Zahlen für die Klasse');
    const t = T.whType('c247');
    assert(t && t.dest === 'c3' && t.life === 16 && t.total === 2e9, 'EE3b: Typ C247 → C3, 16 Std., 2 Mrd. kg');
    assert(T.whSys('Thera') && !T.whSys('Jita'), 'EE3b: Thera ja, Jita (K-Space) nein');
    assert(/wh-tag/.test(T.whTag(31002318)) && T.whTag(30000142) === '', 'EE3c: Schild nur in J-Space');
    const wr = Object.keys(JSON.parse(d.getElementById('wh-data').textContent).s).map(n => T.whSys(n)).find(x => x.fx === 'Wolf-Rayet Star');
    assert(wr && wr.danger && /neg/.test(T.whTag(wr.id)), 'EE3c: Wolf-Rayet ist als gefährlich markiert');
    T.whAction({ type: 'whGo', form: { whq: 'C247' } });
    let b = d.createElement('div'); T.ovRenderWormhole(b);
    assert(/C247 → C3/.test(b.textContent) && /Static/.test(b.textContent), 'EE3b: Ansicht zeigt den Typ');
    T.whAction({ type: 'whGo', form: { whq: 'J1116' } });
    b = d.createElement('div'); T.ovRenderWormhole(b);
    assert(b.querySelector('[data-ova="whPick"]') && /Meintest du/.test(b.textContent), 'EE3b: Teil-Eingabe → Vorschläge zum Anklicken');
    T.whAction({ type: 'whPick', arg: 'J111613' });
    b = d.createElement('div'); T.ovRenderWormhole(b);
    assert(/E175 → C4/.test(b.textContent) && /Planeten \(PI\)/.test(b.textContent) && b.querySelector('a[href*="anoik.is/systems/J111613"]'), 'EE3b: System-Karte mit Statics, Planeten und Link');
    assert(d.getElementById('neo-btn-wormhole') && d.getElementById('panel-wormhole'), 'EE3b: OmniCom-Symbol und Seite');
    // EE1: Systemnamen selbst anklickbar (data-gosys → Overlay-Karte)
    const sl = T.sysLink(30000142, 'Jita <x>');
    assert(/class="sys-link" data-gosys="30000142"/.test(sl) && /Jita &lt;x&gt;/.test(sl) && T.sysLink(0, 'X') === 'X', 'EE1: sysLink – Name als Link, sicher maskiert, ohne ID nur Text');
    const dh = T.rtDangerHtml([{ id: 30002813, n: 'Tama', s: 0.3, g: null, k: 2 }]);
    assert(/data-gosys="30002813"[^>]*>Tama<\/span> \(0\.3, 2 Kills\)/.test(dh), 'EE1: gefährlichste Systeme sind anklickbar');
    // EE3d: Thera/Turnur – genutzte Wurmlöcher einer Route erkennen, Ergebnis-Text, Liste
    const TL = [{ out_system_id: 31000005, out_system_name: 'Thera', out_signature: 'AAA-111', in_system_id: 30000001, in_system_name: 'Tanoo', in_signature: 'BBB-222', in_system_class: 'hs', max_ship_size: 'large', remaining_hours: 10 },
                { out_system_id: 31000005, out_system_name: 'Thera', out_signature: 'CCC-333', in_system_id: 30000002, in_system_name: 'Lashesih', in_signature: 'DDD-444', in_system_class: 'hs', max_ship_size: 'medium', remaining_hours: 5 }];
    T.thStateSet(TL);
    const used = T.thUsed([30000001, 31000005, 30000002], TL);
    assert(used.length === 2 && used[0].in_system_name === 'Tanoo', 'EE3d: Route über Thera nutzt Ein- und Ausgang');
    const th = T.thResHtml({ route: [30000001, 31000005, 30000002], used, j: 2, base: 20 }, true);
    assert(/2 statt 20 Sprünge/.test(th) && /AAA-111/.test(th) && /medium/.test(th), 'EE3d: Ergebnis mit Sprüngen, Signaturen und Schiffsgröße');
    assert(/nicht kürzer/.test(T.thResHtml({ route: [1, 2], used: [], j: 25, base: 20 }, true)) && /data-ova="thGo"/.test(T.thResHtml(null, true)), 'EE3d: nicht kürzer bzw. Knopf zum Prüfen');
    assert(/2 Verbindungen/.test(T.thListHtml()) && /CCC-333/.test(T.thListHtml()), 'EE3d: Liste der Verbindungen');
    // ESI 420 (Fehlerkonto leer): einmal bis zum Zurücksetzen warten und neu fragen statt „Route nicht berechenbar“
    let n420 = 0; const of = w.fetch;
    w.fetch = (u, o) => /\/route\//.test(String(u)) ? Promise.resolve(n420++ === 0
      ? { ok: false, status: 420, headers: { get: k => ({ 'x-esi-error-limit-remain': '0', 'x-esi-error-limit-reset': '0' })[k.toLowerCase()] || null } }
      : { ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve([30000001, 31000005, 30000002]) }) : of(u, o);
    const r420 = await T.rtFetchRoute(30000001, 30000002, 'shortest', [], []);
    w.fetch = of;
    assert(n420 === 2 && r420 && r420.length === 3, 'ESI 420: wartet bis zum Zurücksetzen und fragt einmal neu');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
