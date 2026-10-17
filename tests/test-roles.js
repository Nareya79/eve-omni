// Kopfbereich: aufklappbarer Charakterbereich, Rollen Frachterpilot / Sprungpilot und ihre Wirkung.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Anna Handel' },
  { access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Bert Frachter' }
];
const NAME_IDS = { 'Caldari Freighter':2001, 'Charon':3001, 'Evasive Maneuvering':2002, 'Spaceship Command':2003 };
const SKILLS = {
  '111': [{skill_id:16622, trained_skill_level:5},{skill_id:3446, trained_skill_level:5},{skill_id:21611, trained_skill_level:1}],
  '222': [{skill_id:16622, trained_skill_level:1},{skill_id:3446, trained_skill_level:1},{skill_id:2001, trained_skill_level:4},{skill_id:3456, trained_skill_level:4},{skill_id:21611, trained_skill_level:5},{skill_id:21610, trained_skill_level:4},{skill_id:29029, trained_skill_level:4}]
};
function makeWindow(extra, withChars){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      if (withChars !== false){ w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS)); w.localStorage.setItem('eve-zentrale-active-char', '111'); }
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = function(url, opts){
        const u = String(url); let m;
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(d) });
        if (u.indexOf('/universe/ids/') !== -1) return ok({ inventory_types: JSON.parse(opts.body).filter(n => NAME_IDS[n]).map(n => ({ name:n, id:NAME_IDS[n] })) });
        if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok({ skills: SKILLS[m[1]] });
        if (u.match(/\/characters\/(\d+)\/assets\//)) return ok([]);
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name:'#' + m[1], mass:1e9, dogma_attributes:[{attribute_id:70, value:0.18}] });
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
}
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));

(async () => {
  try{
    // --- Aufklappbarer Bereich ---
    let w = makeWindow(); await tick(500);
    let d = w.document, $ = id => d.getElementById(id);
    const box = $('sso-box');
    assert(box && box.tagName === 'DETAILS' && box.contains($('sso-charlist')) && box.contains($('sso-active-char')), 'Charaktere und Rollen stecken in einem aufklappbaren Bereich');
    assert(!box.open, 'Mit eingeloggten Charakteren startet der Bereich zugeklappt');
    const sum = () => $('sso-box-summary').textContent;
    assert(/2 eingeloggt/.test(sum()) && /Handel: Anna Handel/.test(sum()) && /Frachter: alle/.test(sum()) && /Sprung: –/.test(sum()), 'Zugeklappt zeigt eine Zeile das Wichtigste (' + sum() + ')');
    box.open = true; box.dispatchEvent(new w.Event('toggle'));
    assert(w.localStorage.getItem('eve-zentrale-charbox-open') === '1', 'Auf-/Zuklappen wird gemerkt');
    const w0 = makeWindow({}, false); await tick(500);
    assert(w0.document.getElementById('sso-box').open, 'Ohne Charakter ist der Bereich offen (Login sichtbar)');
    const w1 = makeWindow({ 'eve-zentrale-charbox-open':'1' }); await tick(500);
    assert(w1.document.getElementById('sso-box').open, 'Gemerkter Zustand "offen" beim naechsten Start');

    // Haken aendert die Zusammenfassung
    const cb = d.querySelector('#sso-charlist input[type=checkbox]'); cb.checked = false; cb.dispatchEvent(new w.Event('change', {bubbles:true}));
    assert(/2 eingeloggt \(1 einbezogen\)/.test(sum()), 'Einbezogene Charaktere in der Zusammenfassung');
    cb.checked = true; cb.dispatchEvent(new w.Event('change', {bubbles:true}));

    // --- Frachterpilot ---
    const hb = id => d.querySelector('#sso-hauler-chars input[value="' + id + '"]');
    const hset = async ids => { ['111', '222'].forEach(id => { hb(id).checked = ids.indexOf(id) >= 0; }); await hb('111').onchange(); };
    assert(!$('sso-hauler-field').hidden && d.querySelectorAll('#sso-hauler-chars input').length === 2 && !d.querySelector('#sso-hauler-chars input:checked'), 'Q8: Frachterpiloten als Haken je Charakter, Standard keiner = alle');
    assert(w.__test.haulerChars().length === 2, 'Ohne Frachterpilot: alle Charaktere');
    let best = await w.__test.computeBestOwnCargo('Charon (Caldari)');
    assert(best && best.charName === 'Bert Frachter' && best.level === 4, 'Maximalschiff mit "alle": bester Charakter (Bert, Stufe 4)');
    await hset(['111']);
    assert(w.localStorage.getItem('eve-zentrale-hauler-char') === '111' && /Frachter: Anna Handel/.test(sum()), 'Frachterpilot gespeichert und angezeigt');
    assert(w.__test.haulerChars().map(t => t.character_id).join() === '111', 'Hauling nutzt nur den Frachterpiloten');
    best = await w.__test.computeBestOwnCargo('Charon (Caldari)');
    assert(best === null, 'Anna kann die Charon nicht fliegen -> kein Wert (statt Berts Skills)');
    await hset(['222']);
    best = await w.__test.computeBestOwnCargo('Charon (Caldari)');
    assert(best && best.charName === 'Bert Frachter', 'Mit Bert als Frachterpilot wieder Berts Skills');
    await hset(['111', '222']);
    best = await w.__test.computeBestOwnCargo('Charon (Caldari)');
    assert(w.localStorage.getItem('eve-zentrale-hauler-char') === '111,222' && w.__test.haulerChars().length === 2 && /Frachter: Anna Handel, Bert Frachter/.test(sum()) && best && best.charName === 'Bert Frachter', 'Q8: mehrere Frachterpiloten – Schiffe/Skills aller gewählten zählen');
    await hset(['222']);

    // --- Sprungpilot ---
    const js = $('sso-jump-char');
    await tick(100);
    const oA = js.querySelector('option[value="111"]'), oB = js.querySelector('option[value="222"]');
    assert(oA.disabled && /Jump Drive Operation/.test(oA.title) && /Schiffs-Skill/.test(oA.title) && !oB.disabled && /Ausgegraut.*Anna Handel/.test($('sso-jump-info').textContent), 'T25: Anna ohne Sprung-Skills ausgegraut (Grund im Tooltip), Bert wählbar');
    assert(w.__test.jumpSkillCheck({ 3456: 1, 21611: 1, 21610: 1, 24311: 1 }) === '' && /Jump Fuel/.test(w.__test.jumpSkillCheck({ 3456: 5, 21611: 5, 29029: 5 })), 'T25: Capital zählt als Schiffs-Skill, fehlender Skill wird genannt');
    js.value = '222'; await js.onchange();
    assert(w.localStorage.getItem('eve-zentrale-jump-pilot') === '222' && /Sprung: Bert Frachter/.test(sum()), 'Sprungpilot gespeichert und angezeigt');
    $('neo-btn-jump').onclick(); await tick(150);
    $('nav-sub-jump').onclick(); await tick(150);
    assert($('jp-char').value === '222' && $('jp-jdc').value === '5' && $('jp-jfc').value === '4', 'Jump Planner nimmt den Sprungpiloten und dessen Skills');
    js.value = '111'; await js.onchange(); await tick();
    assert($('jp-char').value === '111' && $('jp-jdc').value === '1', 'Sprungpilot oben geaendert -> Jump Planner wechselt mit (JDC 1)');
    $('jp-char').value = '222'; await $('jp-char').onchange(); await tick();
    assert(js.value === '222' && w.localStorage.getItem('eve-zentrale-jump-pilot') === '222' && /Sprung: Bert/.test(sum()), 'Auswahl im Jump Planner aendert den Sprungpiloten oben');

    // --- beim naechsten Start ---
    const w2 = makeWindow({ 'eve-zentrale-hauler-char':'222', 'eve-zentrale-jump-pilot':'222' }); await tick(500);
    const d2 = w2.document;
    assert(d2.querySelector('#sso-hauler-chars input[value="222"]').checked && !d2.querySelector('#sso-hauler-chars input[value="111"]').checked && d2.getElementById('sso-jump-char').value === '222', 'Rollen bleiben gespeichert');
    // ausgeloggter Pilot faellt sauber zurueck
    const w3 = makeWindow({ 'eve-zentrale-hauler-char':'999', 'eve-zentrale-jump-pilot':'999' }); await tick(500);
    assert(!w3.document.querySelector('#sso-hauler-chars input:checked') && w3.__test.haulerChars().length === 2 && /Frachter: alle/.test(w3.document.getElementById('sso-box-summary').textContent), 'Nicht mehr eingeloggter Pilot -> automatisch "alle"');

    console.log('\nALL ROLES / CHARBOX TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e.stack || e); process.exit(1); }
})();
