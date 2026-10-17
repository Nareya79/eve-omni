// Skills-Tab: Warteschlangen-Auswertung, Reihenfolge nach Dringlichkeit, fehlende Berechtigung, Skill-Suche.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const H = 3600000, NOW = Date.now();
function jwt(id, name, scopes){
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b({alg:'none'}) + '.' + b({ sub:'CHARACTER:EVE:' + id, name, scp: scopes }) + '.x';
}
const ALL = ['esi-skills.read_skills.v1','esi-skills.read_skillqueue.v1'];
const CH = [
  { id:'1', name:'Alpha Trainer', scopes:ALL },
  { id:'2', name:'Bravo Leer', scopes:ALL },
  { id:'3', name:'Charlie Alt', scopes:['esi-skills.read_skills.v1'] },
  { id:'4', name:'Delta Pause', scopes:ALL },
  { id:'5', name:'Echo Bald', scopes:ALL }
];
const iso = t => new Date(t).toISOString();
const QUEUES = {
  '1': [ // laeuft: erster Eintrag zur Haelfte fertig, Warteschlange noch 5 Tage
    { skill_id:3456, finished_level:4, queue_position:0, start_date:iso(NOW-10*H), finish_date:iso(NOW+10*H), level_start_sp:45255, level_end_sp:256000, training_start_sp:45255 },
    { skill_id:21611, finished_level:5, queue_position:1, start_date:iso(NOW+10*H), finish_date:iso(NOW+120*H), level_start_sp:256000, level_end_sp:1448155, training_start_sp:256000 },
    { skill_id:3300, finished_level:1, queue_position:2, start_date:iso(NOW-50*H), finish_date:iso(NOW-40*H), level_start_sp:0, level_end_sp:250, training_start_sp:0 }
  ],
  '2': [ { skill_id:3300, finished_level:2, queue_position:0, start_date:iso(NOW-5*H), finish_date:iso(NOW-1*H), level_start_sp:250, level_end_sp:1415, training_start_sp:250 } ],
  '4': [ { skill_id:3300, finished_level:3, queue_position:0, level_start_sp:1415, level_end_sp:8000, training_start_sp:3000 } ],
  '5': [ { skill_id:21611, finished_level:1, queue_position:0, start_date:iso(NOW-1*H), finish_date:iso(NOW+5*H), level_start_sp:0, level_end_sp:2000, training_start_sp:0 } ]
};
const SKILLS = {
  '1': { total_sp: 52300000, unallocated_sp: 250000, skills:[{skill_id:3456, trained_skill_level:3, active_skill_level:3, skillpoints_in_skill:45255},{skill_id:21611, trained_skill_level:4, active_skill_level:4, skillpoints_in_skill:256000},{skill_id:3300, trained_skill_level:5, active_skill_level:5, skillpoints_in_skill:256000}] },
  '2': { total_sp: 1200000, unallocated_sp: 0, skills:[{skill_id:3300, trained_skill_level:2, active_skill_level:2, skillpoints_in_skill:1415}] },
  '3': { total_sp: 900000, unallocated_sp: 0, skills:[{skill_id:21611, trained_skill_level:5, active_skill_level:5, skillpoints_in_skill:1448155}] },
  '4': { total_sp: 2000000, unallocated_sp: 0, skills:[] },
  '5': { total_sp: 3000000, unallocated_sp: 0, skills:[] }
};
const ATTR = { charisma:17, intelligence:27, memory:21, perception:17, willpower:17, bonus_remaps:1 };
const GROUPS = { 255:{group_id:255, name:'Waffenkunde', published:true, types:[3300]}, 275:{group_id:275, name:'Navigation', published:true, types:[21611,3456]}, 505:{group_id:505, name:'Fake', published:false, types:[]} };
const NAMES = { 3300:'Gunnery', 21611:'Jump Drive Calibration', 3456:'Jump Drive Operation' };
let calls = { queue:[], universe:0 };

const dom = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH.map(c => ({ access_token: jwt(c.id, c.name, c.scopes), refresh_token:'r', expires_at: NOW + H, character_id:c.id, character_name:c.name }))));
    w.localStorage.setItem('eve-zentrale-active-char', '1');
    w.fetch = function(url, opts){
      const u = String(url); let m;
      const ok = d => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(d) });
      if ((m = u.match(/\/characters\/(\d+)\/skillqueue\//))){ calls.queue.push(m[1]); return ok(QUEUES[m[1]] || []); }
      if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok(SKILLS[m[1]]);
      if ((m = u.match(/\/characters\/(\d+)\/attributes\//))) return ok(ATTR);
      if (u.indexOf('/universe/categories/16/') !== -1){ calls.universe++; return ok({ groups:[255,275,505] }); }
      if ((m = u.match(/\/universe\/groups\/(\d+)\//))) return ok(GROUPS[m[1]]);
      if (u.indexOf('/universe/names/') !== -1) return ok(JSON.parse(opts.body).map(id => ({ id, name: NAMES[id], category:'inventory_type' })));
      return Promise.reject(new Error('unexpected ' + u));
    };
  }
});
const w = dom.window;
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 60));

setTimeout(async () => {
  try{
    const d = w.document, T = w.__test, $ = id => d.getElementById(id);
    // --- reine Auswertung ---
    const a1 = T.analyzeQueue(QUEUES['1'], NOW);
    assert(a1.state === 'training' && a1.current.skill_id === 3456 && a1.open.length === 2, 'Fertige Eintraege werden ignoriert, aktueller Skill erkannt');
    assert(Math.abs(a1.frac - 0.5) < 0.01, 'Fortschritt der Stufe ~50 %');
    assert(Math.abs(a1.spPerHour - (256000-45255)/20) < 1, 'SP pro Stunde aus dem aktuellen Skill');
    assert(T.analyzeQueue(QUEUES['2'], NOW).state === 'empty', 'Nur abgelaufene Eintraege = leer');
    assert(T.analyzeQueue([], NOW).state === 'empty', 'Leere Liste = leer');
    assert(T.analyzeQueue(QUEUES['4'], NOW).state === 'paused', 'Ohne Datum = pausiert');
    assert(T.analyzeQueue(QUEUES['5'], NOW).state === 'ending', 'Endet in weniger als 24 Std');

    // --- Tab oeffnen ---
    assert(/Skills/.test($('neo-btn-skills').textContent), 'OmniCom-Button Skills');
    await $('neo-btn-skills').onclick(); await tick(100);
    assert($('panel-skills').classList.contains('active'), 'Skills-Panel aktiv');
    assert(calls.queue.indexOf('3') === -1 && calls.queue.length === 4, 'Warteschlange wird nur mit passender Berechtigung abgefragt');
    const cards = Array.from(d.querySelectorAll('.sq-card'));
    const order = cards.map(c => c.querySelector('.sq-name').textContent);
    assert(order[0] === 'Bravo Leer', 'Leere Warteschlange steht ganz oben (' + order.join(', ') + ')');
    assert(order.indexOf('Alpha Trainer') === 4, 'Normal trainierender Charakter steht unten');
    assert(order.indexOf('Echo Bald') === 3 && order.slice(1,3).sort().join() === 'Charlie Alt,Delta Pause', 'Dann pausiert/Berechtigung fehlt, dann "endet bald"');
    const alpha = cards.find(c => /Alpha/.test(c.textContent));
    assert(/Jump Drive Operation IV/.test(alpha.textContent), 'Aktueller Skill mit Stufe in roemischen Ziffern');
    assert(/52,3 Mio SP/.test(alpha.textContent) && /250\.000 SP frei/.test(alpha.textContent), 'Skillpunkte und freie SP');
    assert(/Warteschlange: 2 Skills/.test(alpha.textContent), 'Anzahl offener Skills');
    assert(/Int 27/.test(alpha.textContent) && /1 Bonus-Remap/.test(alpha.textContent), 'Attribute und Remaps');
    const bar = alpha.querySelector('.sq-bar > span');
    assert(Math.abs(parseFloat(bar.style.width) - 50) < 1.5, 'Fortschrittsbalken ~50 % (' + bar.style.width + ')');
    assert(/pill loss/.test(cards[0].innerHTML) && /Warteschlange leer/.test(cards[0].textContent), 'Leer = rote Markierung');
    assert(cards[0].classList.contains('sq-alert'), 'Karte rot umrandet');
    assert(/Berechtigung fehlt/.test(cards.find(c => /Charlie/.test(c.textContent)).textContent), 'Charakter ohne neue Berechtigung markiert');
    assert(!$('sq-scope-hint').hidden && /Charlie Alt/.test($('sq-scope-hint').textContent) && /esi-skills.read_skillqueue.v1/.test($('sq-scope-hint').textContent), 'Hinweis mit Anleitung fuer die fehlende Berechtigung');
    assert(/Pausiert/.test(cards.find(c => /Delta/.test(c.textContent)).textContent), 'Pausiert erkannt');
    const tiles = $('sq-stats').textContent;
    assert(/59,4 Mio SP/.test(tiles), 'Summe aller Skillpunkte (' + tiles + ')');
    assert(/2 \/ 5/.test(tiles), '2 von 5 trainieren gerade');
    assert(/Echo Bald/.test(tiles), 'Naechstes Warteschlangen-Ende');

    // --- Details: Warteschlange + alle Skills gruppiert ---
    const qrows = alpha.querySelectorAll('details[data-key^="q-"] tbody tr');
    assert(qrows.length === 2 && /Jump Drive Calibration V/.test(qrows[1].textContent), 'Warteschlange als Tabelle');
    const skillsDet = alpha.querySelector('details[data-key^="s-"]');
    assert(/Alle Skills anzeigen \(3\)/.test(skillsDet.textContent) && /Navigation \(2\)/.test(skillsDet.textContent) && /Waffenkunde \(1\)/.test(skillsDet.textContent), 'Alle Skills nach Gruppen');
    // K13: je Skill 5 Kaestchen – 3456 hat Stufe 3, trainiert gerade 4 (blinkt), Rest leer
    const lvb = [...skillsDet.querySelectorAll('.sq-lvb')].map(b => [...b.children].map(i => i.className || '-').join(''));
    assert(lvb.some(x => x === 'ononontr-') && lvb.some(x => x === 'onononontr' || x === 'ononononq'), 'K13: Stufen-Kästchen gelernt/trainiert/Warteschlange: ' + lvb.join(' '));
    assert(skillsDet.querySelectorAll('details.sq-g').length === 2 && skillsDet.querySelector('.sq-rest [data-until]'), 'K13: Gruppen aufklappbar, Restzeit je Skill in der Warteschlange');
    skillsDet.open = true;
    await $('neo-btn-skills').onclick(); await tick();
    assert(d.querySelector('.sq-card[data-char="1"] details[data-key^="s-"]').open, 'Aufgeklappte Liste bleibt beim Neuzeichnen offen');

    // --- Suche ueber alle Charaktere ---
    $('sq-search').value = 'jump drive'; $('sq-search').dispatchEvent(new w.Event('input'));
    const res = $('sq-search-result');
    assert(!res.hidden && res.querySelectorAll('tbody tr').length === 2, 'Suche findet beide Jump-Drive-Skills');
    const cal = Array.from(res.querySelectorAll('tbody tr')).find(r => /Calibration/.test(r.textContent));
    const heads = Array.from(res.querySelectorAll('thead th')).map(t => t.textContent);
    const col = n => cal.children[heads.indexOf(n)].textContent;
    assert(/IV/.test(col('Alpha Trainer')) && /→ V/.test(col('Alpha Trainer')), 'Alpha: IV, in Warteschlange auf V');
    assert(col('Charlie Alt').trim() === 'V' && col('Bravo Leer').trim() === '–', 'Charlie hat V, Bravo gar nicht');

    // --- Universum wird gespeichert ---
    assert(calls.universe === 1 && JSON.parse(w.localStorage.getItem('eve-zentrale-skilluniverse-v1')).names[21611] === 'Jump Drive Calibration', 'Skill-Namen/Gruppen gespeichert');
    assert(T.updateSkillCountdowns && (T.updateSkillCountdowns(), true), 'Countdown-Aktualisierung laeuft ohne Fehler');

    // --- R1: Stufen-Kaestchen am laufenden Skill (grosse Ansicht + Overlay) ---
    const cls = box => Array.from(box.querySelectorAll('i')).map(i => i.className || '-').join('');
    const tb = d.querySelector('.sq-card[data-char="1"] .sq-train .sq-lvb');
    assert(tb && cls(tb) === 'ononontr-' && /(4\d|5\d)%/.test(tb.querySelector('i.tr').getAttribute('style')), 'R1: große Ansicht – Kästchen mit Anteil der laufenden Stufe');
    const qb = d.querySelector('.sq-card[data-char="1"] details[data-key^="q-"] tbody tr:nth-child(2) .sq-lvb');
    assert(qb && cls(qb) === 'ononononq', 'R1: Warteschlange – Kästchen je Eintrag: ' + (qb && cls(qb)));
    const ob = d.createElement('div'); T.ovRenderViewInto('skills', ob);
    const oc = Array.from(ob.querySelectorAll('.ov-card')).find(c => /Alpha Trainer/.test(c.textContent));
    assert(oc && oc.querySelector('.sq-lvb i.tr') && oc.querySelector('.sq-bar span'), 'R1: Overlay – Kästchen + Balken der laufenden Stufe');

    // --- S15 (aendert R2): < 1 Woche gelb blinkend, kein Skill rot blinkend, pausiert ohne Farbe ---
    const card = id => d.querySelector('.sq-card[data-char="' + id + '"]');
    assert(!card('4').classList.contains('sk-yellow') && !card('4').classList.contains('sk-red'), 'S15: pausiert = keine Farbe');
    assert(card('1').classList.contains('sk-yellow') && card('2').classList.contains('sk-red'), 'S15: < 1 Woche gelb, leer rot');
    assert($('neo-btn-skills').classList.contains('sk-red') && /data-neo="skills"[^>]*class="[^"]*sk-red/.test(T.neoOverlayHtml()), 'R2: Skills-Symbol im OmniCom (groß + Overlay) blinkt rot');
    const dp = Array.from(ob.querySelectorAll('.ov-card')).find(c => /Delta Pause/.test(c.textContent));
    assert(!dp.classList.contains('sk-yellow') && oc.classList.contains('sk-yellow'), 'S15: Overlay-Karten pausiert ohne Farbe / bald gelb');

    console.log('\nALL SKILLS TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
}, 500);
