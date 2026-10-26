// AQ (21.10.2026): EVE-Datenzeiten an Trade-/Lauf-Karten + „wartet auf EVE“ + ⓘ im Overlay-Fuß (AQ1);
// Discord: Rechtsklick im Eingabefeld = Rechtschreib-Vorschläge + Bearbeiten, Schalter Rechtschreibprüfung (AQ2).
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  // AQ2 im Nachbau
  const a = main.indexOf('function dcCtxItems('), b = main.indexOf('function discordCmd(');
  const dcCtxItems = new Function(main.slice(a, b) + '; return dcCtxItems;')();
  const calls = [], wc = { replaceMisspelling: w => calls.push('rep:' + w), cut: () => calls.push('cut'), copy: () => calls.push('copy'), paste: () => calls.push('paste'), selectAll: () => calls.push('all'),
    session: { addWordToSpellCheckerDictionary: w => calls.push('dict:' + w) } };
  let it = dcCtxItems({ isEditable: true, misspelledWord: 'Hallp', dictionarySuggestions: ['Hallo', 'Halle'], editFlags: { canCut: true, canCopy: true, canPaste: true } }, wc);
  assert(it[0].label === 'Hallo' && it[1].label === 'Halle' && it[2].label === 'Zum Wörterbuch hinzufügen' && it.some(x => x.label === 'Einfügen'), 'Discord: Vorschläge, Wörterbuch, Bearbeiten');
  it[0].click(); it[2].click(); assert(calls.join() === 'rep:Hallo,dict:Hallp', 'Discord: Klick ersetzt das Wort bzw. nimmt es ins Wörterbuch');
  it = dcCtxItems({ isEditable: true, misspelledWord: 'xqzt', dictionarySuggestions: [], editFlags: {} }, wc);
  assert(it[0].label === 'Keine Vorschläge' && it[0].enabled === false, 'Discord: ohne Vorschläge ein grauer Hinweis');
  assert(dcCtxItems({ isEditable: false, selectionText: 'x', editFlags: {} }, wc).length === 0, 'Discord: außerhalb von Eingabefeldern kein eigenes Menü (Discord hat dort sein eigenes)');
  assert(/wc\.on\('context-menu', \(e, p\) => \{ const it = dcCtxItems\(p, wc\);/.test(main) && /label: 'Rechtschreibprüfung', type: 'checkbox'/.test(main) && /setSpellCheckerEnabled\(\(S\.windows\.discord \|\| \{\}\)\.spell !== false\)/.test(main), 'Discord: Menü angeschlossen, Schalter im ⚙-Menü');
  assert(/'Zum Wörterbuch hinzufügen': 'Add to dictionary'/.test(main), 'Discord: Englisch');

  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    for (const lang of ['de', 'en']){
      const p = await br.newPage({ viewport: { width: 1200, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(l => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l); }, lang);
      await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const T = window.__test, now = Date.now();
        const H = (lm, ex) => ({ ok: true, headers: { get: k => k === 'last-modified' ? new Date(lm).toUTCString() : new Date(ex).toUTCString() } });
        T.esiStampRec('https://esi.evetech.net/characters/91000001/orders/?datasource=tranquility', H(now - 5 * 60000, now + 15 * 60000));
        T.esiStampRec('https://esi.evetech.net/characters/91000001/wallet/transactions/?datasource=tranquility', H(now - 20 * 60000, now + 40 * 60000));
        T.esiStampRec('https://esi.evetech.net/characters/92000002/orders/?datasource=tranquility', H(now - 60000, now + 60000));
        const box = document.createElement('div'); box.id = 'aq-box'; box.innerHTML = T.trEsiHtml('91000001', true); document.body.appendChild(box);
        const none = T.trEsiHtml('93000003', false), f = T.ovFootTextAQ('trades');
        const nx = document.createElement('div'); nx.id = 'aq-nx'; nx.innerHTML = T.tkNextHtml({ state: 'active', charId: '91000001' }); document.body.appendChild(nx);
        const exp = new Date(now + 15 * 60000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        return { none, foot: f.age, tip: f.tip, exp, nxDone: T.tkNextHtml({ state: 'done', charId: '91000001' }) };
      });
      await p.waitForTimeout(400); r.txt = await p.evaluate(() => document.getElementById('aq-box').textContent); r.nx = await p.evaluate(() => document.getElementById('aq-nx').textContent.trim());
      assert(r.nx === '↻ ' + r.exp && r.nxDone === '', lang + ': hinter der Glocke frühestes „neu“ (Orders 15 Min.) in Ortszeit, erledigte ohne (' + r.nx + ')');
      if (lang === 'de'){
        assert(/^wartet auf EVE \(Buchungen bis ~60 Min\.\) EVE-Daten: Orders \d\d:\d\d, neu ab \d\d:\d\d · Buchungen \d\d:\d\d, neu ab \d\d:\d\d$/.test(r.txt), 'de: Zeiten je Charakter als Uhrzeit + „wartet auf EVE“ (' + r.txt + ')');
        assert(r.none === '', 'ohne EVE-Daten des Charakters keine Zeile');
        assert(/^ⓘ /.test(r.foot) && /höchstens alle 20 Min\./.test(r.tip) && /Marktpreise: alle 5 Min\./.test(r.tip), 'ⓘ im Overlay-Fuß mit Erklärung im Tooltip');
      } else assert(/EVE data: Orders \d\d:\d\d, new from/.test(r.txt) && /waiting for EVE/.test(r.txt), 'en: übersetzt (' + r.txt + ')');
      assert(!errs.length, lang + ': keine Seitenfehler ' + errs.join(' | '));
      await p.close();
    }
    assert(/if \(trEsiWait\(t, ev\)\) card\.appendChild\(el\("div", "ov-l txt", '<span class="pill warn" title="' \+ TR_ESI_TIP/.test(html) && /if \(eh\) card\.appendChild\(el\("div", "tr-esi-l", eh\)\);/.test(html) && /x\.state === "active" && trEsiHtml\(x\.charId\)/.test(html) && !/var rh = run\.status !== "done" \? trEsiHtml\(run\.charId\)/.test(html), 'CB: Overlay-Karte nur noch „wartet auf EVE“ (Zeiten im Fuß), Zeile an Meine Trades, Watchlist/Läufe; Overlay-Laufkarte ohne (CC)');
    console.log('\nALL AQ TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
  finally{ await br.close(); }
})();
