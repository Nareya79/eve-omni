// 24.10.2026: Mehrfachkauf „#17471 1“ – fehlgeschlagener Warenname blieb als „#id“ hängen und landete im Lauf (Läufe Transport).
// Jetzt: Fehlschlag gilt 60 s, danach neue Abfrage; gespeicherte Läufe mit „#id“ bekommen den echten Namen.
const fs = require('fs');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 50));
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
(async () => {
  try{
    let up = false, calls = 0;
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
        w.fetch = (u, o) => { if (!/universe\/(names|types\/17471)/.test(String(u))) return Promise.reject(new Error('offline')); calls++;
          if (!up) return Promise.reject(new Error('ESI weg'));
          const body = /names/.test(u) ? JSON.parse(o.body).map(id => ({ id, name: 'Testware Alpha', category: 'inventory_type' })) : { name: 'Testware Alpha' };
          return Promise.resolve({ ok: true, json: () => Promise.resolve(body) }); }; } }).window;
    await tick(600);
    const T = w.__test;
    assert(await T.getTypeName(17471) === '#17471', 'ESI weg → vorerst „#17471“');
    const c0 = calls; await T.getTypeName(17471);
    assert(calls === c0, 'innerhalb von 60 s keine neue Abfrage');
    up = true; T.nameFail()[17471] = Date.now() - 61000;
    assert(await T.getTypeName(17471) === 'Testware Alpha', 'nach 60 s neu gefragt → echter Name');
    T.nameCache()[17471] = '#17471'; T.nameFail()[17471] = Date.now() - 61000;
    T.hrAdd(60011866, 'Dodixie IX', 60003760, 'Jita IV', [{ tid: 17471, name: '#17471', q: 1, sp: 1, p: 1 }], null, null);
    await T.hrHealNames();
    assert(T.hrLoad()[0].items[0].name === 'Testware Alpha', 'gespeicherter Lauf: „#17471“ → echter Name (Mehrfachkauf stimmt wieder)');
    console.log('\nALL NAMEN TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); console.log('FAILED'); process.exit(1); }
})();
