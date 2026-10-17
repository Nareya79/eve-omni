// BB27 (30.09.2026): Skillpläne reagierten nicht – Aktionen speicherten, aber die Seite zeichnete sich nicht neu (spPageRender fehlte in ovRender)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }]));
  x.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(800);
    const d = w.document;
    d.getElementById('neo-btn-skills').click(); await tick(300);
    d.querySelector('#spl-page [data-ova="spNew"]').click(); await tick(100);
    assert(d.querySelector('#spl-page [data-ova="spPick"][aria-pressed="true"]') && d.querySelector('#spl-page textarea[data-ovf="sptext"]'), 'BB27: Klick auf „+ Neuer Plan“ zeigt den Plan sofort');
    d.querySelector('#spl-page [data-ova="spNew"]').click(); await tick(100);
    assert(d.querySelectorAll('#spl-page [data-ova="spPick"]').length === 2, 'BB27: zweiter Plan sofort sichtbar');
    d.querySelector('#spl-page [data-ova="spDel"]').click(); await tick(100);
    assert(d.querySelectorAll('#spl-page [data-ova="spPick"]').length === 1, 'BB27: Löschen sofort sichtbar');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
