// Navigation: Unterbereiche Jump Planner / Routenplaner, Routenplaner-URLs und -Verlauf, neue Jump-Optionen.
// Alle URL-Formate sind live gegen DOTLAN geprueft (routeGate.getUrl / routeJump.getUrl der DOTLAN-Seite).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const CHARS = [{ access_token:'t', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'96643448', character_name:'Taron Velkar' }];
const SKILLS = [{skill_id:21611, trained_skill_level:5},{skill_id:21610, trained_skill_level:4},{skill_id:29029, trained_skill_level:4}];

function makeWindow(extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      w.localStorage.setItem('eve-zentrale-active-char', '96643448');
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = function(url){
        if (/\/skills\//.test(String(url))) return Promise.resolve({ ok:true, status:200, json:() => Promise.resolve({ skills: SKILLS }) });
        return Promise.reject(new Error('offline'));
      };
      w.__opened = []; w.open = u => { w.__opened.push(u); return null; };
    }
  }).window;
}
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 60));

(async () => {
  try{
    let w = makeWindow(); await tick(500);
    const d = w.document, T = w.__test, $ = id => d.getElementById(id);
    const R = T.buildDotlanRouteUrl, J = T.buildDotlanJumpUrl;

    // --- URLs (live geprueft) ---
    assert(R({type:'1', from:'Jita', to:'Amarr'}) === 'https://evemaps.dotlan.net/route/Jita:Amarr', 'Schnellste Route: ohne Typ-Praefix');
    assert(R({type:'2', from:'Jita', to:'Amarr', avoid:'Niarja'}) === 'https://evemaps.dotlan.net/route/2:Jita:Amarr:-Niarja', 'Highsec + gemiedenes System (DOTLAN: 35 Spruenge ohne Niarja)');
    assert(R({type:'3', from:'Old Man Star', via:'Tama, ', to:'Amarr', avoid:'Uedama, Sivala, uedama'}) === 'https://evemaps.dotlan.net/route/3:Old_Man_Star:Tama:Amarr:-Uedama:-Sivala', 'Low/Null, Zwischenstopp, Leerzeichen -> _, doppelte Meide-Systeme entfernt');
    assert(R({type:'2', from:'Jita', to:''}) === 'https://evemaps.dotlan.net/route', 'Ohne Ziel: normale Planer-Seite');
    assert(R({type:'2', from:'Ji<ta>"', to:'Amarr'}) === 'https://evemaps.dotlan.net/route/2:Jita:Amarr', 'Sonderzeichen entfernt');
    assert(J({ship:'Anshar', jdc:5, jfc:4, jf:4, from:'Amamake', to:'1DQ1-A', stations:true, incursion:true, avoid:'Tama'}) === 'https://evemaps.dotlan.net/jump/Anshar,544,S,I,-Tama/Amamake:1DQ1-A', 'Jump mit Stationen, Incursions meiden, Tama meiden (live geprueft)');
    assert(J({ship:'Rhea', jdc:5, jfc:4, jf:3, from:'Amamake', to:'Tama'}) === 'https://evemaps.dotlan.net/jump/Rhea,543/Amamake:Tama', 'Jump ohne Optionen unveraendert');

    // --- OmniCom heisst Navigation, Unterbereiche ---
    assert(/Navigation/.test($('neo-btn-jump').textContent.replace(/\u00ad/g, '')), 'OmniCom-Button heisst jetzt Navigation');
    $('neo-btn-jump').onclick(); await tick(150);
    assert(!$('nav-esi-wrap').hidden && $('nav-jump-wrap').hidden && $('nav-route-wrap').hidden, 'Standard: Reiseroute ohne DOTLAN sichtbar');
    assert(!$('jp-frame').getAttribute('src') && !$('rp-frame').getAttribute('src'), 'Reiseroute laedt keine DOTLAN-Karte');
    $('nav-sub-jump').onclick(); await tick(150);
    assert(!$('nav-jump-wrap').hidden && $('nav-route-wrap').hidden, 'Jump Planner per Unterbereich erreichbar');
    assert($('jp-frame').getAttribute('src') && !$('rp-frame').getAttribute('src'), 'Routenplaner laedt DOTLAN erst, wenn er geoeffnet wird');
    $('nav-sub-route').onclick(); await tick();
    assert($('nav-jump-wrap').hidden && !$('nav-route-wrap').hidden, 'Umschalten auf Routenplaner');
    assert($('nav-sub-route').getAttribute('aria-selected') === 'true', 'Unterbereich markiert');
    assert($('rp-type').value === '2', 'Standard-Routenart: sicher (Highsec)');
    assert($('rp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/route', 'Routenplaner-Fenster geladen');

    // --- Route berechnen + Verlauf ---
    $('rp-from').value = 'Jita'; $('rp-to').value = 'Amarr'; $('rp-avoid').value = 'Uedama';
    $('rp-go').onclick();
    assert($('rp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/route/2:Jita:Amarr:-Uedama', 'Route berechnen setzt die DOTLAN-Adresse');
    let rows = d.querySelectorAll('#rp-history-body tr');
    assert(rows.length === 1 && rows[0].querySelector('.jp-route').textContent === 'Jita → Amarr' && /Sicher/.test(rows[0].textContent) && /Uedama/.test(rows[0].textContent), 'Route mit Routenart und gemiedenen Systemen gespeichert');
    $('rp-type').value = '1'; $('rp-type').onchange();
    assert($('rp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/route/Jita:Amarr:-Uedama', 'Routenart wechseln rechnet sofort neu');
    assert(d.querySelectorAll('#rp-history-body tr').length === 2, 'Andere Routenart = eigener Eintrag');
    $('rp-to').value = 'Dodixie'; $('rp-to').dispatchEvent(new w.KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    assert(/Jita:Dodixie/.test($('rp-frame').getAttribute('src')), 'Enter berechnet die Route');
    rows = d.querySelectorAll('#rp-history-body tr');
    rows[2].querySelector('.jp-pin').onclick();
    assert(d.querySelector('#rp-history-body tr').classList.contains('jp-pinned'), 'Anheften');
    $('rp-from').value = ''; $('rp-to').value = ''; $('rp-avoid').value = ''; $('rp-type').value = '3';
    d.querySelector('#rp-history-body tr.jp-pinned .jp-route').onclick();
    assert($('rp-from').value === 'Jita' && $('rp-to').value === 'Amarr' && $('rp-type').value === '2' && $('rp-avoid').value === 'Uedama', 'Gespeicherte Route stellt Felder und Routenart wieder her');
    $('rp-open').onclick();
    assert(w.__opened[0] === $('rp-frame').getAttribute('src'), 'In neuem Tab oeffnen');
    assert(d.querySelectorAll('#jp-history-body tr').length === 0, 'Routenplaner-Verlauf ist getrennt vom Jump-Verlauf');
    $('rp-history-clear').onclick();
    assert(d.querySelectorAll('#rp-history-body tr').length === 1, 'Loeschen behaelt angeheftete');

    // --- Autovervollstaendigung haengt an allen Systemfeldern ---
    ['rp-from','rp-via','rp-to','rp-avoid','jp-avoid'].forEach(id => assert($(id).parentNode.querySelector('.sys-ac'), 'Autovervollstaendigung an ' + id));

    // --- Jump-Optionen ---
    $('nav-sub-jump').onclick(); await tick(150);
    $('jp-ship').value = 'Anshar'; $('jp-from').value = 'Amamake'; $('jp-to').value = '1DQ1-A';
    $('jp-stations').checked = true; $('jp-incursion').checked = true; $('jp-avoid').value = 'Tama';
    $('jp-go').onclick();
    assert($('jp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/jump/Anshar,544,S,I,-Tama/Amamake:1DQ1-A', 'Jump Planner nutzt die neuen Optionen');
    assert(/Stationen/.test(d.querySelector('#jp-history-body tr').textContent) && /meidet Tama/.test(d.querySelector('#jp-history-body tr').textContent), 'Optionen stehen im Jump-Verlauf');
    $('jp-stations').checked = false; $('jp-incursion').checked = false; $('jp-avoid').value = '';
    await d.querySelector('#jp-history-body .jp-route').onclick();
    assert($('jp-stations').checked && $('jp-incursion').checked && $('jp-avoid').value === 'Tama', 'Gespeicherte Jump-Route stellt Optionen wieder her');

    // --- Beim naechsten Start: zuletzt gewaehlter Unterbereich + Eingaben ---
    const w2 = makeWindow({ 'eve-zentrale-nav-sub': 'route', 'eve-zentrale-routeplanner-v1': w.localStorage.getItem('eve-zentrale-routeplanner-v1'),
                            'eve-zentrale-jumpplanner-v1': w.localStorage.getItem('eve-zentrale-jumpplanner-v1') });
    await tick(500);
    w2.document.getElementById('neo-btn-jump').onclick(); await tick(150);
    assert(!w2.document.getElementById('nav-route-wrap').hidden, 'Zuletzt benutzter Unterbereich (Routenplaner) wird wieder geoeffnet');
    assert(w2.document.getElementById('rp-from').value === 'Jita' && w2.document.getElementById('rp-avoid').value === 'Uedama', 'Routenplaner-Eingaben bleiben gespeichert');
    w2.document.getElementById('nav-sub-jump').onclick(); await tick(150);
    assert(w2.document.getElementById('jp-stations').checked && w2.document.getElementById('jp-avoid').value === 'Tama', 'Jump-Optionen bleiben gespeichert');

    console.log('\nALL NAVIGATION TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
})();
