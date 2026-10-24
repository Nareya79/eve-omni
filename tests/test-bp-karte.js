// BP (24.10.2026): OmniMap – Live-Kills-Knopf oben, Ebenen-Liste bleibt beim Neuaufbau offen, Assets-Tooltip je Charakter.
const fs = require('fs');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 50));
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline'));
        w.localStorage.setItem('eve-zentrale-listcache-v1', JSON.stringify({ assets: { t: Date.now(), d: { g: [
          { cid: 1, name: 'Testa Nova', locs: [{ sys: 30000142, rows: [{ qty: 5, estValue: 2e6 }] }] },
          { cid: 2, name: 'Quill Varro', locs: [{ sys: 30000142, rows: [{ qty: 2, estValue: 9e6 }] }] }] } } })); } }).window;
    await tick(600);
    const d = w.document, T = w.__test;
    // Assets je Charakter (nach Wert sortiert)
    const st = T.mpLoadStore(); st.kmO = Object.assign({}, st.kmO, { om: { as: 1 } }); T.mpSaveStore(st);
    const a = T.kmOmState().as['30000142'];
    assert(a && a[0] === 2 && a[1] === 7 && a[3].map(x => x[0]).join() === 'Quill Varro,Testa Nova', 'Assets: zwei Charaktere, nach Wert sortiert (' + JSON.stringify(a) + ')');
    // Overlay-Karte
    T.ovSetMode('compact'); await tick(100);
    const so = T.ovLoad(); so.views = so.views.filter(v => v.id !== 'karte').concat([{ id: 'karte', on: true }]); so.view = 'karte'; T.ovSave(so); T.ovRender(); await tick(100);
    const body = d.getElementById('ov-body'), h0 = body.querySelector('.km');
    const lb = h0.querySelector('[data-kmlive]');
    assert(lb && lb.closest('.km-view') && lb.getAttribute('aria-pressed') === 'true', 'Live-Kills-Knopf oben in der Ansicht, Standard an');
    lb.click(); await tick(30);
    assert(!(T.mpLoadStore().kmO.ly || {}).live, 'Live-Kills aus → gespeichert');
    // Ebenen-Liste öffnen, Neuaufbau → bleibt offen
    h0.querySelector('[data-kmlay]').click();
    assert(!h0.querySelector('.km-lay').hidden, 'Ebenen-Liste offen');
    const s2 = T.ovLoad(); s2.kmSel = '30000142'; T.ovSave(s2); T.ovRender(); await tick(80);
    const h1 = body.querySelector('.km');
    assert(h1 !== h0 && !h1.querySelector('.km-lay').hidden, 'Ebenen-Liste nach Neuaufbau noch offen');
    assert(h1.querySelector('[data-kmlive]').getAttribute('aria-pressed') === 'false', 'Live-Kills-Knopf zeigt aus nach Neuaufbau');
    // BQ: Navigation-Knopf, Start = Standort des aktiven Charakters, zieht bei Systemwechsel mit
    const nb = h1.querySelector('[data-kmp="route"]');
    assert(nb && /Navigation/.test(nb.textContent) && !/Routing/.test(nb.textContent), 'Knopf heißt Navigation');
    h1.__st.me = [[91, 30000142, 'Testa Nova'], [92, 30002187, 'Quill Varro']]; h1.__st.fc = 92;
    nb.click(); await tick(30);
    const rf = () => h1.querySelector('[data-kmf="rf"]').value;
    assert(rf() === 'Amarr', 'Start = System des aktiven Charakters (' + rf() + ')');
    h1.__st.me = [[91, 30000142, 'Testa Nova'], [92, 30000144, 'Quill Varro']]; T.kmRtSync(h1);
    assert(rf() === 'Perimeter', 'Systemwechsel → Start zieht mit (' + rf() + ')');
    console.log('\nALL BP KARTE TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); console.log('FAILED'); process.exit(1); }
})();
