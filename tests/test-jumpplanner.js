// Jumps-Tab: DOTLAN Jump Planner eingebettet, Skills per ESI, URL-Aufbau, Speichern der Eingaben.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const CHARS = [
  { access_token:'tokT', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'96643448', character_name:'Taron Velkar' },
  { access_token:'tokA', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'2112569214', character_name:'Akiria Velkar' }
];
const SKILLS = {
  '96643448': [{skill_id:21611, trained_skill_level:5},{skill_id:21610, trained_skill_level:4},{skill_id:29029, trained_skill_level:3}],
  '2112569214': [{skill_id:21611, trained_skill_level:2}]
};

const dom = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(window){
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '96643448');
    window.fetch = function(url){
      const m = String(url).match(/\/characters\/(\d+)\/skills\//);
      if (m) return Promise.resolve({ ok:true, status:200, json:() => Promise.resolve({ skills: SKILLS[m[1]] || [] }) });
      return Promise.reject(new Error('unexpected fetch ' + url));
    };
    window.__opened = [];
    window.open = function(u){ window.__opened.push(u); return null; };
  }
});
const { window } = dom;
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 50));

setTimeout(async () => {
  try{
    const doc = window.document, T = window.__test;
    const B = T.buildDotlanJumpUrl;
    // --- URL-Aufbau (Format live gegen DOTLAN geprueft: /jump/Rhea,543/Jita:Amarr -> JDC 5, JFC 4, JF 3) ---
    assert(B({ship:'Rhea', jdc:5, jfc:4, jf:3, from:'Amamake', to:'Tama'}) === 'https://evemaps.dotlan.net/jump/Rhea,543/Amamake:Tama', 'Grundformat Schiff,Skills/Start:Ziel');
    assert(B({ship:'Rhea', jdc:5, jfc:4, jf:4, from:' Amamake ', via:'Tama, Egghelende ;', to:'1DQ1-A'}) === 'https://evemaps.dotlan.net/jump/Rhea,544/Amamake:Tama:Egghelende:1DQ1-A', 'Zwischenstopps mit Komma, Leerraum getrimmt, Bindestrich erlaubt');
    assert(B({ship:'Moros Navy Issue', jdc:4, jfc:4, jf:0, from:'Old Man Star', to:'Tama'}) === 'https://evemaps.dotlan.net/jump/Moros_Navy_Issue,440/Old_Man_Star:Tama', 'Leerzeichen in Schiff/System werden zu _');
    assert(B({ship:'Rhea', jdc:9, jfc:-1, jf:'x', from:'Amamake', to:'Tama'}) === 'https://evemaps.dotlan.net/jump/Rhea,000/Amamake:Tama', 'Ungueltige Skill-Werte werden 0');
    assert(B({ship:'Rhea', jdc:5, jfc:4, jf:3, from:'', to:''}) === 'https://evemaps.dotlan.net/jump', 'Ohne Route: normale Planer-Seite (DOTLAN ignoriert sonst Schiff/Skills)');
    assert(B({ship:'Rhea', jdc:5, jfc:4, jf:3, from:'Amamake', via:'Tama', to:''}) === 'https://evemaps.dotlan.net/jump', 'Ohne Ziel ebenfalls normale Planer-Seite');
    assert(B({ship:'Evil"><script>', jdc:5, jfc:5, jf:5, from:'A/B?c#d<x>', to:'T'}) === 'https://evemaps.dotlan.net/jump/Rhea,555/ABcdx:T', 'Unbekanntes Schiff -> Rhea, Sonderzeichen aus Systemnamen entfernt');

    // --- Tab oeffnen: laedt Charaktere, Skills per ESI, setzt iframe ---
    const frame = doc.getElementById('jp-frame');
    assert(!frame.getAttribute('src'), 'DOTLAN wird nicht schon beim Start der App geladen');
    doc.getElementById('neo-btn-jump').onclick();
    doc.getElementById('nav-sub-jump').onclick(); // Standard ist jetzt die Reiseroute ohne DOTLAN
    assert(doc.getElementById('panel-jump').classList.contains('active'), 'Jumps-Tab aktiviert sein Panel');
    assert(doc.getElementById('neo-btn-jump').getAttribute('aria-selected') === 'true', 'OmniCom-Button ist markiert');
    await tick(100);
    const charSel = doc.getElementById('jp-char');
    assert(charSel.options.length === 3 && charSel.value === '96643448', 'Charakterauswahl mit manuell + 2 Charakteren, aktiver Charakter vorgewaehlt');
    assert(doc.getElementById('jp-jdc').value === '5' && doc.getElementById('jp-jfc').value === '4' && doc.getElementById('jp-jf').value === '3', 'Skills von Taron per ESI uebernommen (5/4/3)');
    assert(frame.getAttribute('src') === 'https://evemaps.dotlan.net/jump', 'iframe laedt beim ersten Oeffnen den Planer');

    // --- Charakterwechsel -> andere Skills ---
    charSel.value = '2112569214'; charSel.onchange(); await tick(100);
    assert(doc.getElementById('jp-jdc').value === '2' && doc.getElementById('jp-jfc').value === '0' && doc.getElementById('jp-jf').value === '0', 'Fehlende Skills werden als 0 gesetzt');
    assert(doc.getElementById('jp-status').textContent.indexOf('Start und Ziel') !== -1, 'Ohne Route: Hinweis, Start und Ziel einzutragen');

    // --- Route berechnen ---
    const ship = doc.getElementById('jp-ship');
    assert(ship.options.length > 50 && Array.from(ship.options).some(o => o.value === 'Anshar'), 'Schiffsliste wie bei DOTLAN');
    ship.value = 'Anshar'; ship.onchange();
    doc.getElementById('jp-from').value = 'Amamake';
    doc.getElementById('jp-via').value = 'Tama';
    doc.getElementById('jp-to').value = '1DQ1-A';
    doc.getElementById('jp-go').onclick();
    assert(frame.getAttribute('src') === 'https://evemaps.dotlan.net/jump/Anshar,200/Amamake:Tama:1DQ1-A', 'Route berechnen setzt die DOTLAN-URL im iframe');

    // Enter im Zielfeld
    doc.getElementById('jp-to').value = 'Egghelende';
    doc.getElementById('jp-to').dispatchEvent(new window.KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    assert(frame.getAttribute('src').endsWith('/Amamake:Tama:Egghelende'), 'Enter im Systemfeld berechnet die Route');

    charSel.value = '96643448'; await charSel.onchange();
    assert(frame.getAttribute('src') === 'https://evemaps.dotlan.net/jump/Anshar,543/Amamake:Tama:Egghelende', 'Charakterwechsel berechnet die Route mit dessen Skills neu');
    // Neuer Tab
    doc.getElementById('jp-open').onclick();
    assert(window.__opened[0] === frame.getAttribute('src'), 'In neuem Tab oeffnen nutzt dieselbe URL');

    // --- Gespeichert fuer das naechste Oeffnen ---
    const st = JSON.parse(window.localStorage.getItem('eve-zentrale-jumpplanner-v1'));
    assert(st.ship === 'Anshar' && st.from === 'Amamake' && st.to === 'Egghelende' && st.charId === '96643448', 'Eingaben werden gespeichert');

    // Andere Tabs funktionieren weiter
    doc.getElementById('neo-btn-haul').onclick();
    assert(doc.getElementById('panel-intensiv').classList.contains('active') && !doc.getElementById('panel-jump').classList.contains('active'), 'Wechsel zu Handel klappt');
    doc.getElementById('neo-btn-jump').onclick();
    assert(frame.getAttribute('src').endsWith('/Amamake:Tama:Egghelende'), 'Erneutes Oeffnen laedt die Seite nicht neu (Route bleibt erhalten)');

    console.log('\nALL JUMP-PLANNER TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
}, 500);
