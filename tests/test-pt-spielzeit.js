// PT (21.11.2026): Spielzeit-Zähler – main.js zählt, solange ein EVE-Client läuft (gesamt, je Tag, je Charakter, eigene Datei
// spielzeit.json); Anzeige nur unter Einstellungen › EVE-Clients (kein Overlay, kein OmniCom-Symbol), DE/EN.
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  // main.js: Zähl-Logik im Nachbau
  const a = main.indexOf('let PT = null'), e = main.indexOf('/* ---------------- Pfade');
  assert(a > 0 && e > a, 'main.js: Spielzeit-Block gefunden');
  const files = {}, fg = { clients: [] };
  const fakeFs = { readFileSync: p => { if (!(p in files)) throw new Error('fehlt'); return files[p]; }, writeFileSync: (p, t) => { files[p] = t; } };
  const M = new Function('fs', 'path', 'app', 'fg', main.slice(a, e) + '; return { ptAdd, ptCount, ptDay, back: ms => { ptAt = Date.now() - ms; } };')(fakeFs, { join: (x, y) => x + '/' + y }, { getPath: () => 'U' }, fg);
  let pt = M.ptAdd({}, [{ name: 'Aria Test' }, { name: 'Aria Test' }, { name: '' }], 60, '2026-11-21');
  assert(pt.total === 60 && pt.days['2026-11-21'] === 60 && pt.ch['Aria Test'] === 60 && Object.keys(pt.ch).length === 1 && pt.since === '2026-11-21', 'ptAdd: gesamt, Tag, Charakter einmal, Charakterauswahl ohne Namen nur in gesamt');
  for (let i = 1; i <= 70; i++) M.ptAdd(pt, [], 10, '2027-01-' + String(i).padStart(3, '0'));
  assert(Object.keys(pt.days).length === 60 && !pt.days['2026-11-21'] && pt.total === 760 && pt.since === '2026-11-21', 'ptAdd: nur 60 Tage bleiben, gesamt und „seit“ bleiben');
  assert(M.ptDay(new Date(2026, 0, 5)) === '2026-01-05', 'ptDay: Ortszeit mit führenden Nullen');
  M.back(90000); M.ptCount(true);
  assert(!files['U/spielzeit.json'], 'kein EVE-Client: nichts gezählt, nichts geschrieben');
  fg.clients = [{ name: 'Bero Test' }]; M.back(90000);
  let p = M.ptCount(true), saved = JSON.parse(files['U/spielzeit.json']);
  assert(p.total === 90 && p.ch['Bero Test'] === 90 && saved.total === 90, 'Client läuft: 90 s gutgeschrieben und gesichert');
  M.back(400000); p = M.ptCount(true);
  assert(p.total === 90, 'Lücke über 5 Minuten (PC hat geschlafen) zählt nicht');
  M.back(30000); p = M.ptCount();
  assert(p.total === 120 && JSON.parse(files['U/spielzeit.json']).total === 90, 'ohne „sichern“ nur gezählt, Datei erst beim nächsten Sichern');
  assert(/o\.playtime = ptCount\(\);/.test(main) && /\{ ptCount\(\); fg\.clients = parseEves\(line\);/.test(main) && /setInterval\(\(\) => ptCount\(true\), 60000\);/.test(main) && /saveSettings\(true\); ptCount\(true\);/.test(main), 'main.js: an die Seite geben, vor Client-Wechsel zählen, jede Minute + beim Beenden sichern');
  assert(!/playtime/.test(main.slice(main.indexOf('const allowed = ['), main.indexOf('const before = {'))), 'main.js: die Seite kann die Spielzeit nicht überschreiben');

  // Seite: nur in den Einstellungen, kein Overlay
  assert(/<h3 class="acc-h host-only">Spielzeit<\/h3>/.test(html.slice(html.indexOf('id="set-pane-clients"'), html.indexOf('id="set-pane-alarm"'))), 'Abschnitt „Spielzeit“ in Einstellungen › EVE-Clients (nur im Programm)');
  assert(/\["EVE-Clients", "Spielzeit-Zähler: [^\]]*"set:clients", ""\]/.test(html), 'Funktionsliste: Eintrag ohne Overlay');
  assert((html.match(/pt-box/g) || []).length === 2 && (html.match(/ptRender\(/g) || []).length === 2, 'kein Overlay: Anzeige nur an einer Stelle');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    for (const lang of ['de', 'en']){
      const pg = await b.newPage({ viewport: { width: 1200, height: 800 } }); const errs = []; pg.on('pageerror', x => errs.push(x.message));
      await pg.addInitScript(l => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l); }, lang);
      await pg.goto('file:///tmp/eve-zentrale-test14.html'); await pg.waitForTimeout(1200);
      await pg.evaluate(() => {
        const key = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
        const days = {}; days[key(0)] = 3660; days[key(6)] = 3600; days[key(7)] = 99999;
        window.__test.ptRender({ playtime: { since: '2026-11-21', total: 360000, days: days, ch: { 'Aria Test': 600, 'Bero Test <b>': 7260 } } });
      });
      await pg.waitForTimeout(150);   // Übersetzer (MutationObserver) abwarten
      const r = await pg.evaluate(() => {
        const box = document.getElementById('pt-box');
        const rows = Array.from(box.querySelectorAll('.range-row')).map(x => x.children[0].textContent + '=' + x.children[1].textContent);
        return { rows: rows, head: box.querySelector('.opt-h').textContent, h3: box.closest('.acc-grid').previousElementSibling.textContent, tags: box.querySelectorAll('b').length };
      });
      const de = lang === 'de';
      assert(r.rows.join('|') === [de ? 'Heute' : 'Today', '=1 h 01 min|', de ? 'Letzte 7 Tage' : 'Last 7 days', '=2 h 01 min|', de ? 'Gesamt' : 'Total', '=100 h 00 min|', de ? 'Gezählt seit' : 'Counting since', '=21.11.2026|Bero Test <b>=2 h 01 min|Aria Test=0 h 10 min'].join(''), lang + ': Heute, 7 Tage (8. Tag nicht), Gesamt, seit, Charaktere nach Zeit (' + r.rows.join('|') + ')');
      assert(r.head === (de ? 'Je Charakter' : 'Per character') && r.h3 === (de ? 'Spielzeit' : 'Playtime') && r.tags === 0, lang + ': Überschriften übersetzt, Name als Text (kein HTML)');
      assert(errs.length === 0, lang + ': keine Seitenfehler ' + errs.join(' | '));
      await pg.close();
    }
  } finally { await b.close(); }
  console.log('ALL TESTS PASSED');
})().catch(e => { console.error(e.message); process.exit(1); });
