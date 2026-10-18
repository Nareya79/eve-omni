// GL (18.10.2026): Schiff im Lauf verloren – Abschussbericht direkt von EVE (killmails/recent, Login mit esi-killmails), sonst zKillboard,
// sonst Schätzung aus Schiff + Fitting des Laufs; gebucht als run.shipLoss, zieht vom Ergebnis ab, Betrag änderbar, entfernbar.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const json = o => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(o) });
(async () => {
  try{
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const JWT = b64({ alg: 'none' }) + '.' + b64({ sub: 'CHARACTER:EVE:111', scp: ['esi-killmails.read_killmails.v1', 'esi-wallet.read_character_wallet.v1'], exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
    const NOW = Date.now(), RUN = { id: 'r1', charId: 111, charName: 'Pilot Alpha', created: NOW - 3600e3, ship: 'Charon (Caldari)', fit: '3× Reinforced Bulkheads II', items: [{ tid: 34, name: 'Tritanium', q: 10, sp: 50 }], status: 'done', from: 60003760, fromName: 'Jita IV - Moon 4', to: 60008494, toName: 'Amarr VIII (Oris)', doneAt: NOW };
    let mode = 'eve', calls = [];
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){
        w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([RUN]));
        w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: JWT, refresh_token: 'r', expires_at: NOW + 3600e3, character_id: 111, character_name: 'Pilot Alpha' }]));
        w.fetch = u => { u = String(u); calls.push(u);
          if (/characters\/111\/killmails\/recent/.test(u)) return mode === 'eve' ? json([{ killmail_id: 900, killmail_hash: 'h900' }]) : json([]);
          if (/killmails\/900\/h900/.test(u)) return json({ killmail_time: new Date(NOW - 600e3).toISOString(), victim: { character_id: 111, ship_type_id: 20185, items: [{ item_type_id: 1335, flag: 11, quantity_destroyed: 3 }, { item_type_id: 34, flag: 5, quantity_destroyed: 99999 }] } });
          if (/zkillboard\.com\/api\/losses/.test(u)) return json([]);
          if (/markets\/prices/.test(u)) return json([{ type_id: 20185, average_price: 1.4e9 }, { type_id: 1335, average_price: 5e6 }, { type_id: 34, average_price: 4 }]);
          if (/markets\/\d+\/orders/.test(u)) return json([]);
          if (/universe\/names|universe\/types\/20185/.test(u)) return json(/names/.test(u) ? [{ id: 20185, name: 'Charon' }] : { name: 'Charon' });
          if (/universe\/ids/.test(u)) return json({ inventory_types: [{ id: 20185, name: 'Charon' }, { id: 1335, name: 'Reinforced Bulkheads II' }] });
          return Promise.reject(new Error('offline ' + u)); };
      } }).window;
    await tick(700);
    const T = w.__test, run = () => T.hrLoad().find(r => r.id === 'r1');
    // Weg 1: Abschussbericht direkt von EVE – nur Rumpf + Module (Fracht flag 5 zählt nicht)
    const f = await T.glFind(run());
    assert(f && f.src === 'EVE' && f.km === 900 && f.v === Math.round(1.4e9 + 3 * 5e6), 'Abschussbericht von EVE: Charon + 3× Bulkheads, Fracht nicht mitgezählt (' + f.v + ')');
    assert(calls.some(u => /characters\/111\/killmails\/recent/.test(u)) && !calls.some(u => /zkillboard/.test(u)), 'zKillboard wird dann nicht gefragt');
    const before = T.hrProgress(run()).profit;
    await T.glDo('ship', 'Lauf', 'r1'); await tick(50);
    assert(/Gefunden: <b>Charon<\/b>/.test(T.glHtml('Lauf:r1', run())), 'Anzeige „Gefunden: Charon“ mit Betrag');
    await T.glDo('shipok', 'Lauf', 'r1', '1,2 Mrd'); await tick(30);
    assert(run().shipLoss && run().shipLoss.v === 1.2e9 && run().shipLoss.km === 900, 'geänderter Betrag 1,2 Mrd. gebucht');
    assert(Math.abs(T.hrProgress(run()).profit - (before - 1.2e9)) < 1, 'Ergebnis des Laufs um den Schiffsverlust kleiner');
    assert(/Schiffsverlust gebucht: <b>Charon<\/b>/.test(T.glHtml('Lauf:r1', run())), 'Anzeige „Schiffsverlust gebucht“');
    await T.glDo('shipdel', 'Lauf', 'r1'); await tick(30);
    assert(!run().shipLoss && Math.abs(T.hrProgress(run()).profit - before) < 1, '„Schiffsverlust entfernen“');
    // Weg 3: weder EVE noch zKillboard kennen ihn → Schätzung aus Schiff + Fitting des Laufs
    mode = 'none'; calls = [];
    const e = await T.glFind(run());
    assert(e && e.est && e.v === Math.round(1.4e9 + 3 * 5e6) && /Charon \+ 3× Reinforced Bulkheads II/.test(e.est), 'Schätzung aus Schiff + Fitting (' + e.v + ')');
    w.close();
    console.log('\nALL GL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
