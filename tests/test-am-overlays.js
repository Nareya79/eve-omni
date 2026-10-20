// AM (20.10.2026): Trades- und Hauling-Overlay angeglichen – Handelscharakter oben, ⚙ in der Zeile „Suchoptionen“ (AM1), „Suchoptionen“ fest an einer Stelle (AM2),
// laufende Läufe im Hauling-Overlay wie die Trades (AM3), gleiche Reihenfolge (AM4), kleine Knöpfe bei offenen Suchoptionen (AM6), „Laufend“ je Seite (AM7), Demo merkt die Sprache.
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const NOW = Date.now(), H = 3600000;
const run = (id, status, extra) => Object.assign({ id, from: 60003760, fromName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', to: 60008494, toName: 'Amarr VIII (Oris) - Emperor Family Academy',
  charId: '9000001', charName: 'Testa Lauf', sm: 'instant', items: [{ tid: 2048, name: 'Damage Control II', q: 60, sp: 61200000, p: 7900000 }], created: NOW - 3 * H, status, ship: 'Charon (Caldari)', buyDone: true }, extra || {});
const tok = (id, name) => ({ access_token: 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name, scp: [], exp: Math.floor((NOW + 864e5) / 1000) })).toString('base64') + '.t', refresh_token: 'r', expires_at: NOW + 864e5, character_id: String(id), character_name: name, client_id: 't' });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    // Quelltext
    assert(/real\.setItem\(dk\(k\), String\(v\)\); if \(\/\^eve-zentrale-\(client\)\?lang-v1\$\/\.test\(k\)\) real\.setItem\(k, String\(v\)\);/.test(html), 'Demo: Sprachwahl wird auch im echten Speicher gemerkt');
    ['"Erledigte Läufe, Trades und Papierkorb:": "Finished runs, trades and bin:"', '"Suchoptionen ▴": "Search options ▴"', '"Lauf": "Run"', '"Keine laufenden Läufe. Beim Ergebnis'].forEach(t => assert(html.includes(t), 'EN ' + t.split(':')[0]));
    const p = await b.newPage({ viewport: { width: 330, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(a => { window.fetch = () => Promise.reject(new Error('offline'));
      localStorage.setItem('eve-zentrale-welcome-v1', 'done'); if (!localStorage.getItem('eve-zentrale-lang-v1')) localStorage.setItem('eve-zentrale-lang-v1', 'de');
      localStorage.setItem('eve-zentrale-characters', JSON.stringify(a.toks)); localStorage.setItem('eve-zentrale-active-char', '9000001');
      if (!localStorage.getItem('eve-zentrale-haulruns-v1')) localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify(a.runs)); },
      { toks: [tok(9000001, 'Testa Lauf'), tok(9000002, 'Probe Zwei')], runs: [run('r1', 'active'), run('r2', 'active', { created: NOW - H }), run('r3', 'done', { doneAt: NOW - H })] });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
    const show = (v, mode) => p.evaluate(a => { const T = window.__test; T.ovSetMode('compact'); const s = T.ovLoad(); s.views = s.views.filter(x => x.id !== a.v).concat([{ id: a.v, on: true }]); s.view = a.v; T.ovSave(s);
      if (a.mode) localStorage.setItem('eve-zentrale-handel-mode-v1', a.mode); T.ovRender(); }, { v, mode });
    const tog = (v) => p.evaluate(v => window.__test.ovSatAction(v, { type: 'mirrorTog', arg: v === 'trades' ? 'scan-run' : 'haul-run' }), v);
    const st = () => p.evaluate(() => { const b = document.getElementById('ov-body'), t = b.querySelector('.ovm-tog'), kids = [...b.children];
      const at = sel => kids.findIndex(k => k.matches(sel) || !!k.querySelector(sel));
      return { first: kids[0] && kids[0].className, togTop: t ? Math.round(t.getBoundingClientRect().top - b.firstElementChild.getBoundingClientRect().top) : -1,   // ab Zeile Handelscharakter (Reiterleiste darüber ist im Test verschieden)
        togInTop: !!(t && t.closest('.ovm-top')), actTog: b.querySelectorAll('.ov-act .ovm-tog').length,
        gearInTop: !!b.querySelector('.ovm-top [data-ova="blinkOpen"]'), bigBtns: b.querySelectorAll('.sb-mode:not(.ovm-mini)').length, miniBtns: b.querySelectorAll('.sb-mode.ovm-mini').length,
        runs: b.querySelectorAll('.lf-run').length, fold: b.querySelectorAll('.lf-run.tr-fold').length, text: b.textContent,
        idx: { tch: at('.ov-tchar'), ovm: at('.ovm'), hint: kids.findIndex(k => /Erledigte Läufe, Trades und Papierkorb/.test(k.textContent)), run: at('.lf-run'), cards: at('.ov-card') } }; });
    // Trades
    await show('trades'); let s = await st();
    assert(/ov-tchar/.test(s.first), 'Trades: Handelscharakter ist die erste Zeile (AM1)');
    assert(s.gearInTop && s.togInTop && s.actTog === 0, 'Trades: ⚙ und „Suchoptionen“ in der Zeile darunter, nicht mehr in der Knopfleiste (AM1/AM2)');
    const tTrades = s.togTop; await tog('trades'); s = await st();
    assert(s.togTop === tTrades && s.togInTop, 'Trades: „Suchoptionen“ offen an derselben Stelle (' + tTrades + ' = ' + s.togTop + ')');
    await tog('trades');
    await p.evaluate(() => window.__test.ovSatAction('trades', { type: 'blinkOpen' })); s = await st();
    assert(/Warnungen:/.test(s.text) && s.gearInTop, '⚙ aufgeklappt: Warnungen-Optionen erscheinen, ⚙ bleibt an seinem Platz');
    await p.evaluate(() => window.__test.ovSatAction('trades', { type: 'blinkOpen' }));
    // Hauling (Feste Hubs)
    await show('handel', 'hub'); s = await st();
    assert(/ov-tchar/.test(s.first) && s.togInTop && s.actTog === 0, 'Hauling: Handelscharakter oben, „Suchoptionen“ in der Zeile darunter');
    assert(Math.abs(s.togTop - tTrades) <= 1, "Hauling und Trades: „Suchoptionen“ gleich hoch (" + tTrades + " / " + s.togTop + ")");
    assert(s.idx.tch < s.idx.ovm && s.idx.ovm < s.idx.hint && s.idx.hint < s.idx.run, 'Reihenfolge: Handelscharakter → Suche → Ergebnis → Watchlist-Hinweis → Läufe (AM4) ' + JSON.stringify(s.idx));
    assert(s.runs === 2 && /2 Läufe/.test(s.text) && /Kasse/.test(s.text), 'nur die 2 laufenden Läufe als Karten mit Summe, der erledigte nicht (AM3)');
    await tog('handel'); s = await st();
    assert(Math.abs(s.togTop - tTrades) <= 1, "Hauling: offen an derselben Stelle");
    assert(s.bigBtns === 0 && s.miniBtns >= 2, 'offene Suchoptionen: Knopfgruppen klein wie zugeklappt (AM6, ' + s.miniBtns + ')');
    await tog('handel');
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'hrFold', arg: 'r1' })); s = await st();
    assert(s.fold === 1, 'Klick auf den Kopf klappt einen Lauf zu');
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'hrFoldAll', arg: 'zu' })); s = await st();
    assert(s.fold === 2, 'alle zu');
    await p.evaluate(() => window.__test.ovSatAction('handel', { type: 'hrFoldAll', arg: 'auf' })); s = await st();
    assert(s.fold === 0, 'alle auf');
    await show('handel', 'haul'); s = await st();
    assert(s.runs === 2 && s.togInTop && /Einkaufen in/.test(s.text), 'Umkreis-Suche: Läufe auch dort, „Einkaufen in“ links neben „Suchoptionen“');
    // AM7: Übersicht „Laufend“ im Hauptfenster
    const tro = id => p.evaluate(id => { document.getElementById(id).click(); const bx = document.getElementById('tro-box'); return { hidden: bx.hidden, sum: document.getElementById('tro-sum').textContent, n: bx.querySelectorAll('.trk-sm').length }; }, id);
    let t = await tro('neo-btn-haul');
    assert(!t.hidden && t.sum === '2 Läufe' && t.n === 2, 'Hauling: „Laufend“ zeigt nur die Läufe (AM7, „2 Läufe“ statt „2 Laufe“)');
    t = await tro('neo-btn-station');
    assert(t.hidden, 'Trading: keine Trades → „Laufend“ ausgeblendet, keine Läufe dort');
    // Englisch
    await p.evaluate(() => localStorage.setItem('eve-zentrale-lang-v1', 'en')); await p.reload(); await p.waitForTimeout(1200);
    await show('handel', 'hub'); await p.waitForTimeout(300); s = await st();
    assert(/Finished runs, trades and bin:/.test(s.text) && /2 Runs/.test(s.text) && /Search options ▾/.test(s.text) && !/Läufe|Suchoptionen/.test(s.text), 'EN: Hauling-Overlay ganz englisch ' + (s.text.match(/.{25}(Läufe|Suchoptionen|Finished|Runs).{25}/g) || []).join(' ## '));
    await tog('handel'); await p.waitForTimeout(300); s = await st();
    assert(/Search options ▴/.test(s.text), 'EN: „Search options ▴“');
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('\nALL AM OVERLAY TESTS PASSED');
  }catch(e){ console.error(e); process.exitCode = 1; }
  finally{ await b.close(); }
})();
