// 5.0: D-Scan-Klassen (ESI-Gruppennamen) in der Sprache der App statt fest deutsch; Zwischenspeicher je Sprache, alte Einträge (d.gn) = deutsch.
// Dazu Skill-Gruppen in der App-Sprache (alter Speicher ohne lang = deutsch, wird in Englisch neu geladen).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const ok = j => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(j) });
const DSCAN = ['11379\tCaracal von Bob\tCaracal\t1.234 km', '22456\tSabre\tSabre\t2,500 km', '35832\tAstrahus\tAstrahus\t5 AU', '2488\tWarrior II\tWarrior II\t800 m'].join('\n');
const TG = { 11379: 358, 22456: 541, 35832: 1657, 2488: 100 };
const GR = { de: { 358: 'Kreuzer', 541: 'Interdictor', 1657: 'Citadel', 100: 'Kampfdrohne' }, en: { 358: 'Cruiser', 541: 'Interdictor', 1657: 'Citadel', 100: 'Combat Drone' } };
const CAT = { 358: 6, 541: 6, 1657: 65, 100: 18 };
function makeWindow(extra, urls){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = (u) => { u = String(u); urls.push(u);
        let m = u.match(/\/universe\/types\/(\d+)\//); if (m) return ok({ group_id: TG[m[1]] });
        m = u.match(/\/universe\/groups\/(\d+)\/.*language=(\w+)/); if (m) return ok({ name: GR[m[2]][m[1]], category_id: CAT[m[1]] });
        return Promise.reject(new Error('offline')); };
    } }).window;
}
(async () => {
  try{
    // Englisch, alter Speicher hat deutsche Namen in d.gn (wie bis 4.0.78)
    const old = JSON.stringify({ g: { 11379: 358 }, gn: { 358: ['Kreuzer', 6] } });
    let urls = [], w = makeWindow({ 'eve-zentrale-lang-v1': 'en', 'eve-zentrale-dscan-v1': old }, urls); await tick(500);
    let T = w.__test;
    await T.dsFromText(DSCAN); await tick(100); let L = T.dsLoad().last;
    const gUrls = urls.filter(u => /universe\/groups/.test(u));
    assert(gUrls.length && gUrls.every(u => /language=en/.test(u)), 'EN: Gruppen werden englisch abgefragt (' + gUrls.length + ')');
    assert(L.grid.concat(L.off).map(c => c.name).indexOf('Cruiser') >= 0 && !L.grid.concat(L.off).some(c => c.name === 'Kreuzer'), 'EN: Klasse „Cruiser“, nicht die alte deutsche „Kreuzer“');
    assert(/^D-Scan [\d:]+( [AP]M)?: 2 ships \(2 on grid\) – warning: 1× Bubble \(Dictor\/HIC\) – /.test(L.sum) && /1 structures/.test(L.sum) && /1 drones/.test(L.sum) && !/Schiffe|Strukturen|Drohnen|Warnung/.test(L.sum), 'EN: Kurztext zum Kopieren englisch: ' + L.sum);
    let d = T.dsLoad();
    assert(d.gn[358][0] === 'Kreuzer' && d.gnEn[358][0] === 'Cruiser', 'Speicher: deutsch bleibt in gn, englisch in gnEn');
    const bd = w.document.createElement('div'); w.document.body.appendChild(bd); T.ovRenderViewInto('dscan', bd); await tick(150);
    bd.querySelectorAll('textarea').forEach(t => t.remove()); const txt = bd.textContent;   // eingefügter D-Scan selbst zählt nicht
    assert(/Cruiser/.test(txt) && /Structures/.test(txt) && /Drones/.test(txt) && /On grid/.test(txt) && !/Kreuzer|Strukturen|Drohnen|Schiffe|Außerhalb/.test(txt), 'EN: Ansicht ohne deutsche Wörter: ' + txt.slice(0, 200));
    w.close();
    // Deutsch: alter Speicher (d.gn) wird weiter genutzt, keine neue Abfrage für 358
    urls = []; w = makeWindow({ 'eve-zentrale-dscan-v1': old }, urls); await tick(500); T = w.__test;
    L = await T.dsRun(DSCAN);
    assert(!urls.some(u => /universe\/groups\/358\//.test(u)) && urls.filter(u => /universe\/groups/.test(u)).every(u => /language=de/.test(u)), 'DE: alte deutsche Einträge gelten weiter, neue deutsch abgefragt');
    assert(L.grid.some(c => c.name === 'Kreuzer') && /Schiffe \(2 auf Grid\) – Warnung: /.test(L.sum) && /1 Strukturen/.test(L.sum) && /1 Drohnen/.test(L.sum), 'DE: Klassen + Kurztext deutsch: ' + L.sum);
    w.close();
    // Skill-Gruppen: alter Speicher ohne lang (deutsch) wird in Englisch neu geladen, englisch abgefragt
    const sku = JSON.stringify({ ts: Date.now(), groups: [{ id: 255, name: 'Schießkunst', types: [3300] }], names: { 3300: 'Gunnery' }, groupOf: { 3300: 255 } });
    urls = []; w = makeWindow({ 'eve-zentrale-lang-v1': 'en', 'eve-zentrale-skilluniverse-v1': sku }, urls); await tick(500);
    w.fetch = (u) => { u = String(u); urls.push(u);
      if (/categories\/16\//.test(u)) return ok({ groups: [255] });
      if (/groups\/255\//.test(u)) return ok({ group_id: 255, name: /language=en/.test(u) ? 'Gunnery' : 'Schießkunst', published: true, types: [3300] });
      if (/universe\/names/.test(u)) return ok([{ id: 3300, name: 'Gunnery' }]);
      return Promise.reject(new Error('offline')); };
    const su = await w.__test.loadSkillUniverse();
    assert(su.lang === 'en' && su.groups[0].name === 'Gunnery' && urls.some(u => /groups\/255\/.*language=en/.test(u)), 'EN: Skill-Gruppen englisch neu geladen (alter deutscher Speicher verworfen)');
    w.close();
    urls = []; w = makeWindow({ 'eve-zentrale-skilluniverse-v1': sku }, urls); await tick(500);
    const su2 = await w.__test.loadSkillUniverse();
    assert(su2.groups[0].name === 'Schießkunst' && !urls.some(u => /categories\/16/.test(u)), 'DE: alter Skill-Speicher gilt weiter (keine neue Abfrage)');
    w.close();
    console.log('\nALL DSCAN-SPRACHE TESTS PASSED');
  }catch(e){ console.log(e.message); console.log('DSCAN-SPRACHE TESTS FAILED'); process.exit(1); }
})();
