// AO2 Block D (22.10.2026): Markt-Strukturen als Einkaufs-/Verkaufsort im Hub-Handel (① + versteckte Auswahl, Overlay spiegelt),
// Route ins 0.0 (keine Highsec-Route → kürzeste mit Hinweis), Routen-Prüfung Low/Null (Kills/Sprünge + zKillboard-Camp), DE/EN. Netz nachgebaut.
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    for (const lang of ['de', 'en']){
      const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(l => {
        const SID = 1035466617946, J = o => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(o) });
        const SYS = { 30000142: ['Jita', 0.95], 30000144: ['Perimeter', 0.95], 30002813: ['Tama', 0.3], 30004759: ['1DQ1-A', -0.38] };
        window.fetch = (u, o) => { u = String(u);
          if (/\/route\/30000142\/30004759/.test(u)){ const pref = JSON.parse(o.body).preference; return pref === 'Safer' ? Promise.resolve({ ok: false, status: 404, headers: { get: () => null }, json: () => Promise.resolve({ error: 'No route found' }) }) : J([30000142, 30000144, 30002813, 30004759]); }
          let m = /\/universe\/systems\/(\d+)\//.exec(u); if (m && SYS[m[1]]) return J({ name: SYS[m[1]][0], security_status: SYS[m[1]][1], constellation_id: 1 });
          if (/system_kills/.test(u)) return J(window.__quiet ? [] : [{ system_id: 30002813, ship_kills: 3, pod_kills: 1, npc_kills: 0 }, { system_id: 30004759, ship_kills: 1, pod_kills: 0, npc_kills: 0 }]);
          if (/system_jumps/.test(u)) return J([{ system_id: 30002813, ship_jumps: 140 }, { system_id: 30004759, ship_jumps: 900 }]);
          m = /zkillboard\.com\/api\/kills\/solarSystemID\/(\d+)/.exec(u);
          if (m) return J(m[1] === '30002813' ? [1, 2, 3].map(i => ({ killmail_id: i, killmail_time: new Date(Date.now() - i * 300000).toISOString(), attackers: [{ character_id: 9, ship_type_id: 11 }], zkb: { locationID: 50001248 } })) : []);
          if (/\/universe\/stargates\/50001248\//.test(u)) return J({ name: 'Stargate (Kedama)' });
          if (/\/universe\/names\//.test(u)) return J([]);
          return Promise.reject(new Error('offline')); };
        localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l);
        localStorage.setItem('eve-zentrale-structs-v1', JSON.stringify([{ id: SID, name: '1DQ1-A - Testkeepstar', sys: 30004759, region: 10000060, sysName: '1DQ1-A', sec: -0.38, cid: '91000001' }]));
      }, lang);
      await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1600);
      const r = await p.evaluate(async () => { const T = window.__test, out = {};
        out.keys = T.hubKeys().filter(k => /^st/.test(k));
        out.kkBuy = !!document.querySelector('#kk-buy option[value="st1035466617946"]');
        out.kkDest = (document.querySelector('#kk-dest [data-kkd="st1035466617946"]') || {}).textContent;
        out.isSrc = !!document.querySelector('#is-src option[value="st1035466617946"]') && !!document.querySelector('#is-dst input[value="st1035466617946"]');
        T.stSave([]); out.gone = !document.querySelector('#kk-dest [data-kkd^="st"]') && !document.querySelector('#is-dst [data-st]');
        T.stSave([{ id: 1035466617946, name: '1DQ1-A - Testkeepstar', sys: 30004759, region: 10000060, sysName: '1DQ1-A', sec: -0.38, cid: '91000001' }]);
        out.back = !!document.querySelector('#kk-dest [data-kkd="st1035466617946"]');
        const route = await T.hubRouteAO(30000142, 30004759); out.route = route && route.length; out.noHigh = !!(route && route.noHigh);
        const c = await T.rtRouteCheck(route); out.lvl = c.lvl; out.low = c.low; out.nul = c.nul; out.camp = c.camps[0] && [c.camps[0].gate, c.camps[0].sn, c.camps[0].n];
        const d = document.createElement('div'); d.id = 'rc-test'; d.className = 'gk-line'; d.innerHTML = T.rtCheckHtml(c); document.querySelector('#panel-intensiv').appendChild(d);
        out.hi = await T.rtRouteCheck([30000142, 30000144]);
        return out; });
      await p.waitForTimeout(500);
      const txt = await p.evaluate(() => document.getElementById('rc-test').textContent);
      assert(r.keys.length === 1 && r.kkBuy && /1DQ1-A/.test(r.kkDest) && r.isSrc, lang + ': Struktur als Einkaufs- und Verkaufsort (① + Hub-Handel-Auswahl)');
      assert(r.gone && r.back, lang + ': Struktur entfernen/eintragen zieht die Knöpfe sofort nach');
      assert(r.route === 4 && r.noHigh, lang + ': ins 0.0 keine Highsec-Route → kürzeste, markiert');
      assert(r.lvl === 'camp' && r.low === 1 && r.nul === 1 && r.camp && r.camp[0] === 'Kedama' && r.camp[1] === 'Tama' && r.camp[2] === 3, lang + ': Routen-Prüfung erkennt Camp am Kedama-Tor in Tama (3 Kills)');
      assert(r.hi === null, lang + ': reine Highsec-Route → keine Routen-Prüfung (Gank-Ampel gilt)');
      if (lang === 'de') assert(/Route: Camp/.test(txt) && /Kedama-Tor in Tama \(3 Kills, vor/.test(txt) && /1 Lowsec \+ 1 Nullsec · letzte Stunde/.test(txt) && /Keine reine Highsec-Route/.test(txt) && /Ansiblex/.test(txt), 'de: Text der Routen-Prüfung');
      else assert(/Route: camp/.test(txt) && /Kedama gate in Tama \(3 kills, \d+ min ago/.test(txt) && /1 lowsec \+ 1 nullsec · last hour/.test(txt) && /No highsec-only route/.test(txt) && /Ansiblex bridges/.test(txt) && !/letzte Stunde|Tor in|Brücken/.test(txt), 'en: Routen-Prüfung vollständig englisch');
      assert(!errs.length, lang + ': keine Seitenfehler ' + errs.join(' | '));
      await p.close();
    }
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exitCode = 1; } finally { await b.close(); }
})();
