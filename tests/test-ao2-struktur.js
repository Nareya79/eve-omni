// AO2 Block C (21.10.2026): Markt-Strukturen (Keepstar/Fortizar … mit Andock-Recht) wie ein Hub – Einstellungen, Marktbuch mit Login,
// Maklergebühr der Struktur, Trades in Strukturen holen ihre Preise dort, Scanner-Auswahl. Netz nachgebaut (ESI-Antworten).
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  assert(/"esi-markets\.structure_markets\.v1",\n    "esi-search\.search_structures\.v1",\n  \]\.join\(" "\);/.test(html), 'neue Berechtigungen im Login');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    for (const lang of ['de', 'en']){
      const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(l => {
        const SID = 1035466617946, J = (o, h) => Promise.resolve({ ok: true, status: 200, headers: { get: k => (h || {})[k] || null }, json: () => Promise.resolve(o) });
        window.__deny = false;
        window.fetch = (u) => { u = String(u);
          if (/\/markets\/structures\/1035466617946\//.test(u)) return window.__deny ? Promise.resolve({ ok: false, status: 403, headers: { get: () => null }, json: () => Promise.resolve({}) })
            : J([{ type_id: 34, is_buy_order: false, price: 6.5, location_id: SID, volume_remain: 1000, order_id: 1 }, { type_id: 34, is_buy_order: true, price: 5.1, location_id: SID, volume_remain: 500, order_id: 2 }, { type_id: 35, is_buy_order: false, price: 12, location_id: SID, volume_remain: 9, order_id: 3 }], { 'x-pages': '1' });
          if (/\/universe\/structures\/1035466617946\//.test(u)) return J({ name: '1DQ1-A - 1-st Thetastar of Dickbutt', solar_system_id: 30004759, type_id: 35834 });
          if (/\/universe\/systems\/30004759\//.test(u)) return J({ name: '1DQ1-A', constellation_id: 20000696, security_status: -0.38 });
          if (/\/universe\/constellations\/20000696\//.test(u)) return J({ region_id: 10000060 });
          if (/\/search\//.test(u)) return J({ structure: [SID] });
          return Promise.reject(new Error('offline')); };
        localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l);
        localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ character_id: 91000001, character_name: 'Aria Test', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e9 }]));
      }, lang);
      await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1400);
      const r = await p.evaluate(async () => { const T = window.__test, out = {};
        await T.stAdd('1035466617946', '91000001');
        out.list = T.stList(); out.msg = document.getElementById('st-res').textContent;
        const h = T.hubGet('st1035466617946'); out.hub = h && { struct: h.struct, region: h.region, station: h.station };
        out.opt = !!document.querySelector('#tsc-hub option[value="st1035466617946"]');
        const o = await T.hubOrders(h, 34); out.ord = [o.buy.length, o.sell.length, o.sell[0] && o.sell[0].price];
        const l = T.stList(); l[0].brk = 2.2; T.stSave(l);
        const f0 = T.tscFeesAO({ brokerLevel: 5, accountingLevel: 5, abrLevel: 5 }), f1 = T.tscFeesAO({ brokerLevel: 5, accountingLevel: 5, abrLevel: 5 }, T.hubGet('st1035466617946'));
        out.fees = [Math.round(f0.brk * 10000) / 100, Math.round(f1.brk * 10000) / 100, f0.tax === f1.tax];
        const th = T.trHubAO({ st: 1035466617946, stName: 'x' }); out.trHub = !!(th && th.struct);
        out.npc = !T.trHubAO({ hub: 'jita' }).struct;
        window.__deny = true; await T.stAdd('1035466617946', '91000001'); out.deny = document.getElementById('st-res').textContent;
        T.stRender(); out.box = document.getElementById('st-list').textContent;
        return out; });
      await p.waitForTimeout(300);
      const tx = await p.evaluate(() => [document.getElementById('st-res').textContent, document.getElementById('st-list').textContent]);
      assert(r.list.length === 1 && r.list[0].region === 10000060 && r.list[0].sys === 30004759 && r.list[0].cid === '91000001', lang + ': Struktur mit Region (über System → Konstellation) und lesendem Charakter gespeichert');
      assert(r.hub.struct && r.hub.station === 1035466617946 && r.opt, lang + ': als Hub abrufbar und in „Trades scannen“ wählbar');
      assert(r.ord[0] === 1 && r.ord[1] === 1 && r.ord[2] === 6.5, lang + ': Marktbuch der Struktur, nach Ware gefiltert');
      assert(r.fees[1] === 2.2 && r.fees[0] === 1.5 && r.fees[2], lang + ': Maklergebühr der Struktur statt Skill-Gebühr, Steuer bleibt (' + r.fees + ')');
      assert(r.trHub && r.npc, lang + ': Trade in der Struktur nimmt den Struktur-Markt, NPC-Hubs unverändert');
      if (lang === 'de') assert(/Kein Zugriff auf den Markt von 1DQ1-A/.test(r.deny) && /andocken/.test(r.deny), 'de: ohne Andock-Recht klare Meldung');
      else assert(/No access to the market of 1DQ1-A/.test(tx[0]) && /Your market structures/.test(tx[1]) && /Broker fee %/.test(tx[1]), 'en: Meldung + Liste übersetzt (' + tx[0].slice(0, 60) + ')');
      assert(!errs.length, lang + ': keine Seitenfehler ' + errs.join(' | '));
      await p.close();
    }
    console.log('\nALL AO2 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
  finally{ await b.close(); }
})();
