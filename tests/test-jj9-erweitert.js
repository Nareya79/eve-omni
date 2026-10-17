// JJ9: Hauptknopf oben, Seltenes hinter „Erweitert“ (Trading, Hauling, Hub-Handel, Navigation, Mining), auf/zu gemerkt
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const mk = pre => new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); pre(w); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
const w = mk(() => {}), d = w.document, $ = id => d.getElementById(id);
setTimeout(() => { try{
  const adv = k => d.querySelector('details.jj-adv[data-adv=' + k + ']');
  const inAdv = (k, ids) => ids.every(id => $(id) && adv(k).contains($(id)));
  assert(adv('trade') && inAdv('trade', ['tsc-depth', 'tsc-share', 'tsc-fstand', 'tsc-hothi', 'tsc-sep']) && !adv('trade').contains($('tsc-capital')) && !adv('trade').open, 'Trading: Seltenes unter „Erweitert“, Kapital bleibt sichtbar, zu');
  const tm = d.querySelector('#tsc-scan-view > .jj-main');
  assert(tm && tm.contains($('tsc-start')) && tm.compareDocumentPosition(d.querySelector('#tsc-scan-view > .opt-grid')) & 4, 'Trading: „Markt scannen“ oben über den Feldern');
  assert(inAdv('haul', ['hl-depth', 'hl-tax', 'hl-extra']) && d.querySelector('#panel-haul > .jj-main').contains($('hl-search-btn')) && !adv('haul').contains($('hl-budget')), 'Hauling: Hauptknopf oben, Suchtiefe/Steuer unter „Erweitert“');
  assert(inAdv('hub', ['is-depth', 'is-tax']) && d.querySelector('#panel-intensiv > .jj-main').contains($('is-start')), 'Hub-Handel: Hauptknopf oben, Seltenes unter „Erweitert“');
  assert(inAdv('nav', ['rt-auto', 'rt-jb-box', 'rt-gank-box']) && !adv('nav').contains($('rt-go')), 'Navigation: Jump Bridges, Gank-Liste, Auto-Umfahren unter „Erweitert“');
  adv('trade').open = true; adv('trade').dispatchEvent(new w.Event('toggle'));
  assert(JSON.parse(w.localStorage.getItem('eve-zentrale-adv-v1')).trade === 1, 'Auf/zu wird gemerkt');
  const w2 = mk(x => x.localStorage.setItem('eve-zentrale-adv-v1', '{"trade":1}'));
  setTimeout(() => { try{
    assert(w2.document.querySelector('details.jj-adv[data-adv=trade]').open, 'Nach Neustart wieder offen');
    w.document.getElementById('neo-btn-mining').click();
    setTimeout(() => { try{
      const m = w.document.querySelector('#mi-page details.jj-adv[data-adv=mining]');
      assert(m && m.querySelector('[data-ovf=mfac]') && m.querySelector('[data-ovf=mtax]'), 'Mining: Anlage, Steuer, Sicherheit, Implantat unter „Erweitert“');
      console.log('\nALL JJ9 TESTS PASSED'); process.exit(0);
    }catch(e){ console.error(e.stack || e); process.exit(1); } }, 300);
  }catch(e){ console.error(e.stack || e); process.exit(1); } }, 700);
}catch(e){ console.error(e.stack || e); process.exit(1); } }, 700);
