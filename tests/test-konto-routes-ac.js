// Konto-Bereich (Setup + Skills raus aus dem Kopf, Skills automatisch), gespeicherte Jump-Routen,
// System-Autovervollstaendigung im Jump Planner.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const CHARS = [
  { access_token:'tokT', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'96643448', character_name:'Taron Velkar' },
  { access_token:'tokA', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'2112569214', character_name:'Akiria Velkar' }
];
const SKILLS = {
  '96643448': [{skill_id:16622, trained_skill_level:4},{skill_id:3446, trained_skill_level:3},{skill_id:21611, trained_skill_level:5},{skill_id:21610, trained_skill_level:4},{skill_id:29029, trained_skill_level:3}],
  '2112569214': [{skill_id:16622, trained_skill_level:5},{skill_id:3446, trained_skill_level:5},{skill_id:21611, trained_skill_level:2}]
};
// 2500 K-Space-Systeme (-> 3 names-Pakete) + benannte + ein Wurmloch, das ausgelassen werden muss
const NAMED = { 30000142:'Jita', 30000141:'Jinizu', 30002537:'Amamake', 30002813:'Tama', 30004759:'1DQ1-A', 30002187:'Amarr', 30003830:'Old Man Star', 31000005:'J123456' };
const SYSTEM_IDS = Object.keys(NAMED).map(Number);
for (let i = 0; i < 2500; i++) SYSTEM_IDS.push(30010000 + i);
let calls = { systems:0, names:0, namesMaxBatch:0, requestedWormhole:false };

function makeWindow(extraStorage, withChars){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(window){
      if (withChars !== false){
        window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
        window.localStorage.setItem('eve-zentrale-active-char', '96643448');
      }
      Object.keys(extraStorage || {}).forEach(k => window.localStorage.setItem(k, extraStorage[k]));
      window.fetch = function(url, opts){
        const u = String(url);
        let m = u.match(/\/characters\/(\d+)\/skills\//);
        if (m) return Promise.resolve({ ok:true, status:200, json:() => Promise.resolve({ skills: SKILLS[m[1]] || [] }) });
        if (u.indexOf('/universe/systems/?') !== -1){ calls.systems++; return Promise.resolve({ ok:true, json:() => Promise.resolve(SYSTEM_IDS) }); }
        if (u.indexOf('/universe/names/') !== -1){
          const ids = JSON.parse(opts.body); calls.names++; calls.namesMaxBatch = Math.max(calls.namesMaxBatch, ids.length);
          if (ids.some(id => id >= 31000000)) calls.requestedWormhole = true;
          return Promise.resolve({ ok:true, json:() => Promise.resolve(ids.map(id => ({ id, category:'solar_system', name: NAMED[id] || ('Sys' + id) }))) });
        }
        return Promise.reject(new Error('unexpected fetch ' + u));
      };
      window.open = function(){ return null; };
    }
  }).window;
}
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 60));
function type(window, el, value){ el.value = value; el.dispatchEvent(new window.Event('input')); }
function key(window, el, k){ const ev = new window.KeyboardEvent('keydown', {key:k, bubbles:true, cancelable:true}); el.dispatchEvent(ev); return ev; }

(async () => {
  try{
    // ================= A) Kopf aufgeraeumt, Konto-Bereich =================
    let w = makeWindow();
    await tick(500);
    let d = w.document;
    const acc = d.getElementById('panel-account');
    ['sso-login-box','sso-help','skills-panel','sso-client-id','sso-login-btn','sk-acc','sso-import-skills-btn'].forEach(id => {
      assert(d.getElementById('set-pane-chars').contains(d.getElementById(id)), id + ' liegt im Konto-Bereich, nicht mehr im Kopf');   // UU2: Anmeldung steht ganz oben im Reiter Konto
    });
    assert(d.getElementById('sso-charlist') && !acc.contains(d.getElementById('sso-charlist')) && d.getElementById('set-pane-chars').contains(acc), 'Konto steckt in Einstellungen › Konto, Charakter-Chips daneben');
    assert(!d.getElementById('panel-settings').classList.contains('active'), 'Konto-Bereich ist beim Start nicht sichtbar');
    d.getElementById('sso-add-char-btn').onclick();
    await tick(30);
    assert(d.getElementById('panel-settings').classList.contains('active') && !d.getElementById('set-pane-chars').hidden && d.getElementById('sso-login-box').open, '"+ Charakter" oeffnet Einstellungen › Konto mit aufgeklappter Anmeldung');
    assert(w.getComputedStyle(d.getElementById('neo-btn-account')).display === 'none', 'Kein Konto-Symbol mehr im OmniCom');

    // ================= B) Skills automatisch =================
    assert(d.getElementById('sk-acc').value === '4' && d.getElementById('sk-brk').value === '3', 'Handelsskills beim Start automatisch vom aktiven Charakter geladen');
    assert(Math.abs(parseFloat(d.getElementById('st-tax').value) - 4.2) < 1e-9, 'Trading-Steuer folgt automatisch (Accounting 4 -> 4,2 %)');
    assert(Math.abs(parseFloat(d.getElementById('hl-tax').value) - 4.2) < 1e-9, 'Hauling-Steuer ebenso');
    assert(/aus EVE/.test(d.getElementById('sk-auto-info').textContent), 'Kurzinfo im Kopf: Werte aus EVE (' + d.getElementById('sk-auto-info').textContent + ')');
    const act = d.getElementById('sso-active-char');
    act.value = '2112569214'; await act.onchange(); await tick();
    assert(d.getElementById('sk-acc').value === '5' && d.getElementById('sk-brk').value === '5', 'Wechsel des aktiven Charakters laedt dessen Skills automatisch');

    const w0 = makeWindow({}, false); await tick(500);
    assert(w0.document.getElementById('sso-login-box').open, 'Ohne eingeloggten Charakter ist die Anmeldung im Konto-Bereich aufgeklappt');

    // ================= C) Gespeicherte Routen =================
    d.getElementById('sso-active-char').value = '96643448'; setActiveCharVal(w, '96643448');
    d.getElementById('neo-btn-jump').onclick(); d.getElementById('nav-sub-jump').onclick(); await tick(150);
    const $ = id => d.getElementById(id);
    assert($('jp-history-empty').hidden === false, 'Leere Routenliste zeigt Hinweis');
    $('jp-ship').value = 'Anshar'; $('jp-ship').onchange();
    $('jp-from').value = 'Amamake'; $('jp-via').value = 'Tama,'; $('jp-to').value = '1DQ1-A';
    $('jp-go').onclick();
    let rows = d.querySelectorAll('#jp-history-body tr');
    assert(rows.length === 1 && rows[0].querySelector('.jp-route').textContent === 'Amamake → Tama → 1DQ1-A', 'Route mit allen Systemen in Reihenfolge gespeichert');
    assert(/Anshar · 5\/4\/3/.test(rows[0].textContent) && /Taron Velkar/.test(rows[0].textContent), 'Schiff, Skills und Charakter stehen dabei');
    $('jp-go').onclick();
    assert(d.querySelectorAll('#jp-history-body tr').length === 1, 'Gleiche Route wird nicht doppelt gespeichert');
    $('jp-from').value = 'Old Man Star'; $('jp-via').value = ''; $('jp-to').value = 'Tama'; $('jp-go').onclick();
    rows = d.querySelectorAll('#jp-history-body tr');
    assert(rows.length === 2 && rows[0].querySelector('.jp-route').textContent === 'Old Man Star → Tama', 'Neueste Route steht oben');
    // anheften
    rows[1].querySelector('.jp-pin').onclick();
    rows = d.querySelectorAll('#jp-history-body tr');
    assert(rows[0].querySelector('.jp-route').textContent.startsWith('Amamake') && rows[0].classList.contains('jp-pinned'), 'Angeheftete Route steht oben');
    // viele Routen -> nur 25 ungepinnte bleiben, gepinnte bleibt
    for (let i = 0; i < 30; i++){ $('jp-from').value = 'Amamake'; $('jp-via').value = ''; $('jp-to').value = 'Sys' + (30010000 + i); $('jp-go').onclick(); }
    const stored = JSON.parse(w.localStorage.getItem('eve-zentrale-jumproutes-v1'));
    assert(stored.filter(r => !r.pinned).length === 25 && stored.filter(r => r.pinned).length === 1, 'Hoechstens 25 ungepinnte Routen, angeheftete bleibt immer');
    // oeffnen: Felder, Schiff und Charakter wiederhergestellt
    $('jp-char').value = '2112569214'; await $('jp-char').onchange(); await tick();
    $('jp-ship').value = 'Rhea';
    await d.querySelector('#jp-history-body tr.jp-pinned .jp-route').onclick(); await tick();
    assert($('jp-from').value === 'Amamake' && $('jp-via').value === 'Tama' && $('jp-to').value === '1DQ1-A', 'Klick auf Route stellt Start, Zwischenstopps und Ziel wieder her');
    assert($('jp-ship').value === 'Anshar' && $('jp-char').value === '96643448' && $('jp-jdc').value === '5', 'Schiff und Charakter (mit dessen Skills) wiederhergestellt');
    assert($('jp-frame').getAttribute('src') === 'https://evemaps.dotlan.net/jump/Anshar,543/Amamake:Tama:1DQ1-A', 'DOTLAN zeigt die Route wieder');
    // loeschen
    $('jp-history-clear').onclick();
    assert(d.querySelectorAll('#jp-history-body tr').length === 1, '"Nicht angeheftete loeschen" behaelt nur die angeheftete');
    d.querySelector('#jp-history-body .rm-btn').onclick();
    assert($('jp-history-empty').hidden === false, 'Einzelne Route loeschbar');

    // Letzter Charakter bleibt beim naechsten Start (nicht der aktive Handelscharakter)
    const w2 = makeWindow({ 'eve-zentrale-jumpplanner-v1': JSON.stringify({charId:'2112569214', ship:'Nomad', from:'Tama', via:'', to:'Amamake'}) });
    await tick(500);
    w2.document.getElementById('neo-btn-jump').onclick(); w2.document.getElementById('nav-sub-jump').onclick(); await tick(150);
    assert(w2.document.getElementById('jp-char').value === '2112569214', 'Zuletzt gewaehlter Charakter wird beim naechsten Oeffnen wieder gewaehlt');
    assert(w2.document.getElementById('jp-ship').value === 'Nomad' && w2.document.getElementById('jp-jdc').value === '2', 'Schiff und dessen Skills ebenfalls');

    // ================= D) Autovervollstaendigung =================
    const T = w.__test;
    const wD = makeWindow({}, false); await tick(500);
    calls = { systems:0, names:0, namesMaxBatch:0, requestedWormhole:false };
    const names = await wD.__test.loadSystemNames();
    assert(calls.systems === 1 && calls.names === 3 && calls.namesMaxBatch <= 1000, 'Systemnamen in Paketen zu max. 1000 geladen (' + calls.names + ' Pakete)');
    assert(!calls.requestedWormhole && names.indexOf('J123456') === -1, 'Wurmlochsysteme werden ausgelassen');
    assert(JSON.parse(wD.localStorage.getItem('eve-zentrale-systemnames-v1')).names.length === names.length, 'Namen werden lokal gespeichert');
    await T.loadSystemNames();
    const w3 = makeWindow({ 'eve-zentrale-systemnames-v1': wD.localStorage.getItem('eve-zentrale-systemnames-v1') });
    await tick(500);
    const before = calls.systems; await w3.__test.loadSystemNames();
    assert(calls.systems === before, 'Beim naechsten Start kommen die Namen aus dem Speicher, keine ESI-Abfrage');

    assert(JSON.stringify(T.findSystems('ji')) === JSON.stringify(['Jita', 'Jinizu']), '"ji" -> Jita zuerst (kuerzer), dann Jinizu');
    assert(T.findSystems('JI')[0] === 'Jita', 'Gross-/Kleinschreibung egal');
    assert(T.findSystems('1dq')[0] === '1DQ1-A', 'Nullsec-Namen mit Ziffern');
    assert(T.findSystems('man')[0] === 'Old Man Star', 'Treffer mitten im Namen, wenn kein Name so beginnt');

    const from = $('jp-from');
    const srcBefore = $('jp-frame').getAttribute('src');
    type(w, from, 'ji'); await tick();
    const box = from.parentNode.querySelector('.sys-ac');
    assert(!box.hidden && Array.from(box.querySelectorAll('.sys-ac-item')).map(x => x.textContent).join(',') === 'Jita,Jinizu', 'Dropdown zeigt passende Systeme beim Tippen, Jita oben');
    key(w, from, 'ArrowDown'); key(w, from, 'ArrowDown');
    const ev = key(w, from, 'Enter');
    assert(from.value === 'Jita' && box.hidden, 'Pfeiltasten wandern durch die Liste (2x runter = wieder oben), Enter uebernimmt Jita');
    assert($('jp-frame').getAttribute('src') === srcBefore, 'Enter zum Uebernehmen startet noch keine Routenberechnung');
    key(w, from, 'Enter');
    assert($('jp-frame').getAttribute('src') !== srcBefore, 'Zweites Enter (Dropdown zu) berechnet die Route');

    const via = $('jp-via');
    type(w, via, 'Tama, am'); await tick();
    const vbox = via.parentNode.querySelector('.sys-ac');
    assert(Array.from(vbox.querySelectorAll('.sys-ac-item')).map(x => x.textContent).join(',') === 'Amarr,Amamake,Tama', 'Zwischenstopps: Vorschlaege fuer das System nach dem letzten Komma');
    vbox.querySelectorAll('.sys-ac-item')[1].onmousedown(new w.MouseEvent('mousedown'));
    assert(via.value === 'Tama, Amamake, ', 'Klick auf Vorschlag ersetzt nur das letzte System und haengt ein Komma an');

    const to = $('jp-to');
    type(w, to, 'Tama'); await tick();
    assert(to.parentNode.querySelector('.sys-ac').hidden, 'Bei vollstaendigem Namen kein Dropdown mehr');
    type(w, to, 'xyzq'); await tick();
    assert(to.parentNode.querySelector('.sys-ac').hidden, 'Ohne Treffer kein Dropdown');
    type(w, to, 'tam'); await tick();
    key(w, to, 'Escape');
    assert(to.parentNode.querySelector('.sys-ac').hidden && to.value === 'tam', 'Escape schliesst ohne zu uebernehmen');

    console.log('\nALL KONTO / ROUTES / AUTOCOMPLETE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
})();

function setActiveCharVal(w, id){ w.localStorage.setItem('eve-zentrale-active-char', id); }
