// Abschnitt O (Wuensche vom 25.09.2026, 8. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CH = [{ character_id: 111, character_name: 'Eins', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 },
            { character_id: 222, character_name: 'Zwei', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 }];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH));
    w.localStorage.setItem('eve-zentrale-wsync-src-v1', '222');
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([
      { id: 'r1', fromName: 'Jita IV - Moon 4', toName: 'Amarr VIII', charId: 111, charName: 'Eins', created: Date.now() - 3600e3, status: 'open', items: [{ tid: 34, name: 'Tritanium', q: 1000, p: 5000 }] },
      { id: 'r2', fromName: 'Jita IV - Moon 4', toName: 'Rens VI', charId: 111, charName: 'Eins', created: Date.now() - 86400e3, doneAt: Date.now() - 7200e3, status: 'done', res: 2500000, items: [{ tid: 35, name: 'Pyerite', q: 10, p: 100 }] }])); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document;
    // O6: Einstellungs-Sync merkt den zuletzt gewaehlten Quell-Charakter
    d.getElementById('neo-btn-settings').click(); await tick();
    const src = d.getElementById('wsync-source');
    assert(src.value === '222', 'O6: gemerkter Quell-Charakter vorausgewählt');
    src.value = '111'; src.dispatchEvent(new w.Event('change'));
    assert(w.localStorage.getItem('eve-zentrale-wsync-src-v1') === '111', 'O6: Auswahl wird gespeichert');
    // O2/3: Trades-Overlay hat die Markt-Scanner-Suche mit Suchoptionen
    const T = w.__test;
    T.ovSatAction('trades', { type: 'mirrorTog', arg: 'scan-run' });
    const ob = d.createElement('div'); T.ovRenderViewInto('trades', ob);
    assert(ob.querySelector('[data-ova="mirrorRun"][data-arg="scan-run"]') && ob.querySelector('select[data-ovf="tsc-hub"]') && ob.querySelector('input[type=checkbox][data-ovf="tsc-hideflag"]').checked, 'O2/3: Trades-Overlay mit „Markt scannen“ und Suchoptionen (auch Haken)');
    let runs = 0; d.getElementById('tsc-start').onclick = () => { runs++; };
    T.ovSatAction('trades', { type: 'mirrorRun', arg: 'scan-run', form: { 'tsc-minmargin': '9', 'tsc-hidehot': true } }); await tick(30);
    assert(d.getElementById('tsc-minmargin').value === '9' && d.getElementById('tsc-hidehot').checked && runs === 1, 'O2/3: geänderte Werte übernommen, Scan gestartet');
    // O2/2: Overlay „Verfolgt“ mit Aktiv · Erledigt · Alle
    assert(T.ovLoad().views.some(v => v.id === 'track' && !v.on), 'O2/2: Ansicht „Verfolgt“ vorhanden (anfangs als Tab aus)');
    let tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.ov-card').length === 1 && /Jita IV → Amarr VIII/.test(tb.textContent) && /1<\/b> aktiv/.test(tb.innerHTML), 'O2/2: Aktiv zeigt den laufenden Lauf');
    T.ovSatAction('track', { type: 'trkOv', arg: 'done' }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.ov-card').length === 1 && /Rens VI/.test(tb.textContent) && /erledigt/.test(tb.textContent) && /\+2,5 Mio\./.test(tb.textContent), 'O2/2: Erledigt mit Ergebnis: ' + tb.textContent);
    const dn = T.trkAll().find(x => x.state === 'done'); T.ovSatAction('track', { type: 'trkDet', arg: dn.id }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(/gekauft/.test(tb.textContent) && /abgeschlossen \d/.test(tb.textContent), 'X2: Erledigte lassen sich im Overlay aufklappen: ' + tb.textContent);
    T.ovSatAction('track', { type: 'trkDet', arg: dn.id });
    T.ovSatAction('track', { type: 'trkOv', arg: 'all' }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.ov-card').length === 2 && T.ovLoad().trkView === 'all', 'O2/2: Alle, Auswahl gemerkt');
    // O2/4: Trading-Seite zeigt oben, was läuft
    d.getElementById('neo-btn-station').click(); await tick();
    let tro = d.getElementById('tro-box');
    assert(!tro.hidden && d.getElementById('tro-sum').textContent === '1 Lauf' && tro.querySelectorAll('.trk-sm').length === 1 && /Amarr VIII/.test(tro.textContent), 'O2/4: Laufend-Box zeigt den offenen Lauf');
    T.hrUpdate('r1', { status: 'done' }); await tick();
    assert(tro.hidden, 'O2/4: nichts aktiv -> Box ausgeblendet');
    console.log('\nALL WUENSCHE-O TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
