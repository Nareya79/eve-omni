// 25.10.2026: Preise kopieren in der aufgeklappten Kachel-Karte im Overlay-Fenster (Nutzer: „Preis kopieren geht bei Trades in der Karte nicht im Overlay“).
// Grün nach dem Kopieren (wie im alten Layout), auch nach dem Neuaufbau. Echter Weg: Hauptfenster baut das Overlay-HTML (Watchlist + Trades), Einzelfenster (?fenster=…) zeigt es; Klick auf Knopf UND auf die Zahl kopiert, die Karte klappt dabei nicht zu.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.01, created: now - 3600e3, status: 'active' }];
const live = { types: { buys: [{ order_id: 5, price: 5.2, volume_remain: 50, issued: iso(now - 300e3), is_buy_order: true }, { order_id: 6, price: 5, volume_remain: 80, issued: iso(now - 3600e3), is_buy_order: true }], sells: [{ order_id: 9, price: 6.4, volume_remain: 50, issued: iso(now - 600e3), is_buy_order: false }] },
  own: { buy: { order_id: 6, price: 5, volume_remain: 80, volume_total: 100, issued: iso(now - 3600e3), is_buy_order: true, duration: 90 } }, time: now };
(async () => {
  try{
    const main = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true, beforeParse(w){
      w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR)); w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }])); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(800);
    const T = main.__test; T.trLiveSet('t1', live);
    for (const view of ['trades', 'track']){
      if (view === 'track') T.ovSatAction('track', { type: 'trkDet', arg: 't1' });
      const b = main.document.createElement('div'); T.ovRenderViewInto(view, b);
      assert(b.querySelector('.tc-card .cp-hot .tsc-cp-b[data-copy]'), view + ': Karte hat den gelben neuen Preis zum Kopieren');
      const SH = { copied: [], act: [] };
      const shost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ SH.act.push(a); }, resizeTo(){}, resizeEnd(){}, copyText(t){ SH.copied.push(t); return Promise.resolve(); } };
      const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=' + view, pretendToBeVisual: true,
        beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline')); x.evecoreHost = shost; } }).window;
      await tick(400);
      SH.cmd({ type: 'view', data: { title: view, html: b.innerHTML, foot: { age: '', next: '' }, look: { style: 'eve' } } }); await tick(60);
      const d = w.document, hot = d.querySelector('.tc-card .cp-hot');
      assert(hot, view + ': Einzelfenster zeigt die Kachel-Karte');
      const want = hot.querySelector('.tsc-cp-b').getAttribute('data-copy');
      hot.querySelector('.tsc-cp-b').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(30);
      assert(SH.copied[0] === want, view + ': Klick auf ⧉ kopiert ' + want + ' (' + SH.copied.join() + ')');
      assert(SH.act.some(a => a.type === 'trPend' && a.id === 't1') && !SH.act.some(a => a.type === 'trkDet'), view + ': neuer Preis gemerkt (trPend), Karte klappt nicht zu');
      assert(d.querySelector('.tc-card .cp-hot .tsc-cp-b.ok'), view + ': Knopf wird grün');
      SH.cmd({ type: 'view', data: { title: view, html: b.innerHTML.replace('Tritanium', 'Tritanium '), foot: { age: '', next: '' }, look: { style: 'eve' } } }); await tick(30);
      assert(d.querySelector('.tc-card .cp-hot .tsc-cp-b.ok'), view + ': bleibt grün, auch wenn das Overlay gleich danach neu zeichnet (neuer Preis gemerkt)');
      await tick(1300); assert(!d.querySelector('.tsc-cp-b.ok'), view + ': nach gut einer Sekunde wieder normal');
      SH.copied = []; SH.act = [];
      d.querySelector('.tc-card .cp-hot .tsc-cp-v').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(30);
      assert(SH.copied[0] === want && !SH.act.some(a => a.type === 'trkDet'), view + ': Klick auf die Zahl selbst kopiert auch (' + SH.copied.join() + ')');
      SH.copied = [];
      const lim = [...d.querySelectorAll('.tc-tiles .tsc-cp:not(.cp-hot)')].find(c => c.querySelector('.tsc-cp-b[data-copy]'));
      lim.querySelector('.tsc-cp-v').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(30);
      assert(SH.copied[0] === lim.querySelector('.tsc-cp-b').getAttribute('data-copy'), view + ': „nicht über“ per Klick auf die Zahl kopiert');
      w.close();
    }
    // Hauptfenster: Klick auf die Zahl kopiert auch
    const box = main.document.createElement('div'); box.className = 'tc-main'; main.document.body.appendChild(box);
    T.switchTab('track'); main.document.querySelector('[data-trk="active"]').click(); await tick(60); const row = main.document.querySelector('#trk-body [data-trk-row="Trade:t1"]'); row.click(); await tick(60);
    const mv = main.document.querySelector('#trk-body .tc-card .cp-hot .tsc-cp-v'); let mc = '';
    main.navigator.clipboard ? (main.navigator.clipboard.writeText = t => { mc = t; return Promise.resolve(); }) : Object.defineProperty(main.navigator, 'clipboard', { value: { writeText: t => { mc = t; return Promise.resolve(); } } });
    mv.dispatchEvent(new main.MouseEvent('click', { bubbles: true })); await tick(60);
    assert(mc && mc === mv.parentNode.querySelector('.tsc-cp-b').getAttribute('data-copy') && main.document.querySelector('#trk-body .tc-card'), 'Hauptfenster: Klick auf die Zahl kopiert, Karte bleibt offen (' + mc + ')');
    console.log('\nALL TC-KOPIEREN TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
