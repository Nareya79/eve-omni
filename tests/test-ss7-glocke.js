// SS7 (15.10.2026): Glocke je Trade/Lauf – aus = kein Überboten-Alarm (ovAlarmKeys/Meldung), kein Blinken, kein Verkaufs-Ton; Zustand bleibt sichtbar
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: now - 3600e3, status: 'active', buyDone: true, keepOpen: true }];
const RUN = [{ id: 'r1', fromName: 'Amarr VIII', toName: 'Jita IV - Moon 4', charId: '111', charName: 'Eins', items: [{ tid: 35, name: 'Pyerite', q: 10 }], created: now - 3600e3, status: 'active' }];
const live = { types: { buys: [], sells: [{ order_id: 9, price: 5.9, volume_remain: 50, issued: iso(now - 600e3), is_buy_order: false }, { order_id: 77, price: 6, volume_remain: 60, issued: iso(now - 3600e3), is_buy_order: false }] },
  own: { sell: { order_id: 77, price: 6, volume_remain: 60, volume_total: 100, issued: iso(now - 3600e3), is_buy_order: false } }, time: now };
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(win){
  win.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
  win.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR));
  win.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify(RUN));
} }).window;
(async () => {
  try{
    await tick(900);
    const T = w.__test, d = w.document;
    T.trLiveSet('t1', live);
    let fresh = T.ovCollectAlarms();
    assert(fresh.length === 1, 'Ausgangslage: überboten löst einen Alarm aus');
    T.trkRender();
    const btn = d.querySelector('#panel-track [data-trk-mute="Trade:t1"]') || d.querySelector('[data-trk-mute="Trade:t1"]');
    assert(btn && /🔔/.test(btn.textContent) && /Alarm für diesen Auftrag an/.test(btn.title), 'Watchlist: Glocke 🔔 am aktiven Trade');
    const row = btn.closest('[data-trk-row]'); assert(row && row.classList.contains('trk-ob'), 'Zeile gelb (überboten)');
    btn.click(); await tick(50);
    assert(T.trLoad()[0].mute === true, 'Klick: Trade stumm gespeichert (t.mute)');
    assert(T.ovCollectAlarms().length === 0, 'Stumm: kein Alarm');
    T.trLiveSet('t1', Object.assign({}, live, { types: { buys: [], sells: [{ order_id: 10, price: 5.8, volume_remain: 50, issued: iso(now - 300e3), is_buy_order: false }].concat(live.types.sells.slice(1)) } }));
    assert(T.ovCollectAlarms().length === 0, 'Stumm: auch neuer Unterbieter → kein Alarm, keine Meldung');
    T.trkRender();
    const row2 = d.querySelector('[data-trk-row="Trade:t1"]'), b2 = row2.querySelector('[data-trk-mute]');
    assert(/🔕/.test(b2.textContent) && b2.classList.contains('off') && row2.classList.contains('al-mute') && !row2.classList.contains('trk-ob'), 'Stumm: Glocke 🔕, Zeile ohne Überboten-Blinken');
    const box = d.createElement('div'); box.innerHTML = '<div class="ov-card trk-sm st-bad al-mute"><div class="ov-name">x</div></div>'; T.ovBlink(box, 'track');
    assert(box.querySelector('.ov-card').classList.contains('bl-aus') && !box.querySelector('.ov-card').classList.contains('blk'), 'Blinken: stumme Karte bekommt bl-aus');
    // Overlay-Aktion schaltet zurück
    T.ovSatAction('track', { type: 'trkMute', arg: 'Trade:t1' }); await tick(50);
    assert(!T.trLoad()[0].mute, 'Overlay-Aktion trkMute (auch aus dem Einzelfenster): wieder an');
    const ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
    assert(ob.querySelector('[data-ova="trkMute"][data-arg="Trade:t1"]'), 'Watchlist-Overlay: Glocke mit data-ova="trkMute"');
    T.trkRender();
    assert(d.querySelector('[data-trk-row="Trade:t1"]').classList.contains('trk-ob'), 'Wieder an: Zeile wieder gelb');
    // Lauf
    const rb = d.querySelector('[data-trk-mute="Lauf:r1"]');
    assert(rb, 'Watchlist: Glocke auch am Lauf');
    rb.click(); await tick(50);
    assert(T.hrLoad()[0].mute === true, 'Lauf stumm (run.mute)');
    assert(/!run\.mute\) vcAlarm\(run, fresh\)/.test(html) && /x\.state === "cancelled" \|\| x\.mute\) return;/.test(html), 'Stumm: kein Verkaufs-Check-Alarm, kein Verkaufs-Ton');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
