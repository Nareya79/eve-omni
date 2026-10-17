// DD4 (02.10.2026): Karte wie eve-webtools Atlas – a) Universum „Schema“ (große Karte + Overlay-Karte)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ const R = d => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(d) });
    w.fetch = u => /system_jumps/.test(u) ? R([{ system_id: 30000142, ship_jumps: 500 }, { system_id: 30000144, ship_jumps: 100 }]) : /system_kills/.test(u) ? R([{ system_id: 30000142, ship_kills: 3, pod_kills: 1, npc_kills: 0 }]) : Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const view = () => { const b = d.createElement('div'); T.ovRenderViewInto('karte', b); return b; };
    // Overlay-Karte
    T.ovSatAction('karte', { type: 'mapTog', arg: 'sch' }); let b = view();
    let sv = b.querySelector('svg.mp-sch');
    assert(sv && sv.querySelectorAll('text.rl').length === 68 && sv.querySelectorAll('path.sd').length > 5, 'DD4a: Overlay – Universum mit 68 Regionsnamen und Punkten in Sicherheitsfarbe');
    assert(!sv.querySelector('path.sg') && !sv.querySelector('text.sn'), 'DD4a: weit weg ohne Tor-Linien und Namen');
    T.ovSatAction('karte', { type: 'map', cmd: 'vb:380,600,120,140' }); b = view(); sv = b.querySelector('svg.mp-sch');
    assert(sv.getAttribute('viewBox') === '380 600 120 140' && sv.querySelector('path.sg') && sv.querySelector('path.sg.x') && sv.querySelectorAll('text.sn').length > 5, 'DD4a: nah – Tor-Linien (Regionswechsel gestrichelt) + Systemnamen');
    assert(sv.querySelector('circle.sh[data-ova="mapSchReg"]'), 'DD4a: System anklickbar (öffnet die Regionskarte)');
    // DD4b: Live-Ebenen + Top 20
    T.ovSatAction('karte', { type: 'map', cmd: 'region' }); T.ovSatAction('karte', { type: 'mapSchL', arg: 'j' }); view(); await tick(300); b = view();
    const top = [...b.querySelectorAll('.mps-top button')].map(x => x.textContent);
    assert(top.length === 2 && /^Jita.*500$/.test(top[0]) && /^Perimeter.*100$/.test(top[1]), 'DD4b: Top 20 Sprünge (Jita 500, Perimeter 100)');
    assert(b.querySelector('svg.mp-sch text.lv') && [...b.querySelectorAll('svg.mp-sch circle.sh title')].some(t => /Jita.*Sprünge 500/s.test(t.textContent)), 'DD4b: Zahl am System + Tooltip mit Schiffe/Kapseln/NPC/Sprüngen');
    assert(b.querySelectorAll('[data-ova="mapSchL"], [data-ova="mapSchP"]').length === 9, 'DD4b: Ebenen (6) + Zeitraum 1 Std./24 Std./Δ');
    T.ovSatAction('karte', { type: 'mapSchP', arg: '24' }); b = view();
    assert(/aus 1 Stunden-Ständen/.test(b.textContent), 'DD4b: 24 Std. aus eigenen Stunden-Schnappschüssen');
    T.ovSatAction('karte', { type: 'mapSchP', arg: 'd' }); b = view();
    assert(/Stunde davor fehlt noch/.test(b.textContent), 'DD4b: Δ braucht die Stunde davor');
    T.ovSatAction('karte', { type: 'mapSchGo', arg: '30000142' }); b = view();
    assert(/^[-0-9.]+ [-0-9.]+ 120 140$/.test(b.querySelector('svg.mp-sch').getAttribute('viewBox')), 'DD4b: Klick in Top 20 zoomt hin');
    T.ovSatAction('karte', { type: 'mapSchL', arg: '' });
    // DD4c: Regionskarte wie im Atlas
    T.ovSatAction('karte', { type: 'mapSchReg', arg: '10000002' }); b = view();
    const rh = b.querySelector('.mps-rh').textContent.replace(/\s+/g, ' ');
    assert(/The Forge 88 Systeme 71 ?\/ ?17 ?\/ ?0/.test(rh) && /Tore nach:.*Lonetrek.*The Citadel/.test(rh), 'DD4c: Kopf – 88 Systeme, 71/17/0, Tore nach …');
    assert(b.querySelectorAll('svg .sb').length === 88 && b.querySelectorAll('svg path.cf').length > 5 && /KIMOTORO/.test(b.textContent), 'DD4c: Kästchen + Konstellationsflächen mit Namen');
    const jita = [...b.querySelectorAll('svg .sb')].find(g => /^Jita/.test(g.textContent));
    assert(jita && jita.querySelector('text.nt').textContent === '18' && jita.getAttribute('data-gosys') === '30000142', 'DD4c: Zahl rechts = 18 Stationen, Klick → System');
    assert(b.querySelector('svg .nb[data-ova="mapSchReg"]') && /Lonetrek/.test(b.querySelector('svg .nb').textContent + b.querySelector('svg').textContent), 'DD4c: Nachbarsysteme gestrichelt mit Regionsname, Klick = dorthin');
    T.ovSatAction('karte', { type: 'mapSchN', arg: 'j' }); b = view();
    assert([...b.querySelectorAll('svg .sb')].find(g => /^Jita/.test(g.textContent)).querySelector('text.nt').textContent === '500', 'DD4c: Zahl wählbar (Sprünge)');
    // DD4d: Bedienung
    assert(b.querySelectorAll('select[data-ovf="sr"] option').length === 69 && b.querySelector('[data-ova="mapSchPng"]') && b.querySelector('[data-ova="mapSchFit"]'), 'DD4d: Region wählen (68) + Einpassen + PNG');
    T.ovSatAction('karte', { type: 'mapSchCon' }); T.ovSatAction('karte', { type: 'mapSchLbl' }); b = view();
    assert(!b.querySelector('svg path.cf') && !b.querySelector('svg text.cn') && b.querySelectorAll('svg .sb').length === 88, 'DD4d: Konstellationen + Beschriftung aus');
    T.ovSatAction('karte', { type: 'mapSchCon' }); T.ovSatAction('karte', { type: 'mapSchLbl' });
    T.ovSatAction('karte', { type: 'mapSchRegF', form: { sr: '10000043' } }); b = view();
    assert(/^Domain/.test(b.querySelector('.mps-rh').textContent), 'DD4d: Region per Auswahl öffnen');
    // PNG: Bildbau im Browser (Canvas) – in jsdom nur die Aktion ohne Fehler
    T.ovSatAction('karte', { type: 'mapSchPng', arg: '10000043' });
    T.ovSatAction('karte', { type: 'mapSchN', arg: 'st' }); T.ovSatAction('karte', { type: 'mapSchReg', arg: '' }); b = view();
    assert(b.querySelectorAll('svg text.rl').length === 68, 'DD4c: ← Universum');
    T.ovSatAction('karte', { type: 'mapReg', arg: '10000002' }); b = view();
    assert(!b.querySelector('svg.mp-sch'), 'DD4a: Klick auf Region → flache Regionskarte');
    // große Karte
    d.getElementById('mp-sch').click(); await tick(50);
    const svg = d.getElementById('mp-svg');
    assert(svg.classList.contains('mp-sch') && svg.querySelectorAll('text.rl').length === 68 && d.getElementById('mp-sch').getAttribute('aria-pressed') === 'true', 'DD4a: große Karte – Umschalter „Schema“');
    const rl = svg.querySelector('text.rl[data-schreg="10000002"]'); rl.dispatchEvent(new w.Event('pointerdown', { bubbles: true })); rl.dispatchEvent(new w.Event('pointerup', { bubbles: true })); await tick(50);
    assert(svg.querySelectorAll('.sb').length === 88 && /88 Systeme/.test(d.getElementById('mp-sch-bar').textContent), 'DD4c: große Karte – Klick auf Regionsnamen öffnet die Regionskarte');
    d.getElementById('mp-sch').click(); await tick(50);
    assert(!svg.classList.contains('mp-sch'), 'DD4a: zweiter Klick = flache Karte');
    console.log('\nALL DD4 TESTS PASSED'); process.exit(0);
  }catch(e){ console.log(e.message); process.exit(1); }
})();
