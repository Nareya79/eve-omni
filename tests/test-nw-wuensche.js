// NW (11.10.2026): Watchlist-Overlay ohne Markt-Suche, Berechnen-Knöpfe hervorgehoben, Haken der Client-Vorschau in Designfarbe,
// „Einkaufen in“ = Standort des aktiven Clients (Hub-System → Hub, sonst Eigenes System; bei „Zu festem Hub“ bleibt die Wahl)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const SYS = { 30000142: 'Jita', 30000144: 'Perimeter' };
let here = 30000144;
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Taron Velkar' }]));
    w.evecoreHost = { frontClient: () => Promise.resolve('Taron Velkar') };
    w.fetch = (url, opts) => {
      url = String(url); const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(x) });
      if (/characters\/111\/location/.test(url)) return json({ solar_system_id: here });
      let m = /universe\/systems\/(\d+)/.exec(url); if (m) return json({ system_id: +m[1], name: SYS[m[1]], security_status: 0.9, constellation_id: 1 });
      if (/universe\/names/.test(url)) return json(JSON.parse(opts.body).map(id => ({ id, name: SYS[id] || 'X', category: 'solar_system' })));
      return Promise.reject(new Error('offline'));
    };
  } }).window;
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const d = w.document, T = w.__test, tick = ms => new Promise(r => setTimeout(r, ms || 100));
  // NW5
  assert(['tsc-start', 'hl-search-btn', 'is-start', 'rt-go'].every(id => d.getElementById(id).classList.contains('go')) && /\.btn\.go\{/.test(html), 'NW5: Berechnen-Knöpfe hervorgehoben');
  // NW1
  assert(/b\.style\.color=b\.style\.borderColor=c/.test(main) && /S\.icColor \|\| '#e0b84a'/.test(main), 'NW1: Haken der Vorschau in Designfarbe');
  // NW2: gemeinsamer Besitzer – nie kurz „immer oben“ aus, sonst fallen alle Overlays hinter EVE (Jukebox-Titelanzeige)
  assert(/parent: satOwnerGet\(\)/.test(main) && main.indexOf("if (!w.isAlwaysOnTop()) w.setAlwaysOnTop(true, 'screen-saver'); else if (w.isVisible()) w.moveTop();") >= 0 && !/isAlwaysOnTop\(\)\) w\.setAlwaysOnTop\(false\)/.test(main), 'NW2: Overlays mit Besitzer, kein Aus-und-wieder-an, moveTop nur sichtbar');
  assert(/w\.getParentWindow\(\) === satOwner\) w\.on\('show', \(\) => setTimeout\(ownedResync/.test(main) && /function ownedResync\(\)\{ satIdsByZ\(\)\.forEach\(id => applySatState/.test(main), 'NW2: neues Fenster des Besitzers → Overlays wieder oben');
  { const tm = main.slice(main.indexOf('function jbToastMake()'), main.indexOf('function jbToastPre'));
    assert(tm && !/bparent:/.test(tm) && /setTimeout\(jbToastPre, 2000\)/.test(main), 'Jukebox-Anzeige ohne gemeinsamen Besitzer, beim Start vorbereitet'); }
  // NX2: Startbild 2 s mit Links, abschaltbar, nicht bei EVE vorne
  assert(/function splashShow\(tries\)/.test(main) && /parent: satOwnerGet\(\), x: wa\.x/.test(main) && /Date\.now\(\)-t>4000/.test(main) && /discord\.gg\/Tyxt6J8yPR/.test(main) && /'lang', 'splash'/.test(main) && d.getElementById('hs-splash'), 'NX2: Startbild mit Links, Einstellung');
  assert(html.indexOf('kMXBxjJaXr') < 0 && html.indexOf('discord.gg/Tyxt6J8yPR') > 0, 'richtiger EVE-Omni-Discord');
  // NX1: Schiffsauswahl mit Bild – eigenes Aufklappmenü, <select> bleibt die Quelle
  { const sel = d.getElementById('is-ship'), b = sel.parentNode.querySelector('.ss-btn');
    assert(sel.classList.contains('ss-hide') && b && d.getElementById('hl-max-ship').classList.contains('ss-hide'), 'NX1: beide Schiffsauswahlen ersetzt');
    b.click(); const items = [...sel.parentNode.querySelectorAll('.ss-pop .sys-ac-item')], it = items.find(x => /Obelisk/.test(x.textContent));
    it.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
    assert(items.length > 15 && /Obelisk/.test(sel.options[sel.selectedIndex].textContent) && /Obelisk/.test(b.textContent) && !sel.parentNode.querySelector('.ss-pop'), 'NX1: Liste mit allen Schiffen, Wahl landet im Feld (' + items.length + ')'); }
  // NX3: Funktionsliste unter Einstellungen › Funktionen, Suche, Klick öffnet die Seite
  d.querySelector('[data-set="features"]').click(); await tick(100);
  { const rows = d.querySelectorAll('#fx-list .fx-r'); const q = d.getElementById('fx-q');
    q.value = 'beenden'; q.dispatchEvent(new w.Event('input')); const hit = d.querySelectorAll('#fx-list .fx-r');
    assert(rows.length >= 50 && hit.length === 1 && /EVE-Clients beenden/.test(hit[0].textContent), 'NX3: Funktionsliste mit Suche (' + rows.length + ')');
    q.value = 'Marktbrowser'; q.dispatchEvent(new w.Event('input')); d.querySelector('#fx-list .fx-r').click(); await tick(100);
    assert(d.getElementById('panel-market').classList.contains('active'), 'NX3: Klick öffnet die Seite'); }
  { const hpf = (process.env.EVEOMNI_ROOT || '/dev/null') + '/EVE-Omni-Homepage/index.html', hp = fs.existsSync(hpf) ? fs.readFileSync(hpf, 'utf-8') : '';   // V6: im Repo/CI gibt es die Homepage nicht
    if (hp) assert(/id="all-functions"/.test(hp) && (hp.match(/<li><span data-en>/g) || []).length === (html.slice(html.indexOf('var FEATURES = ['), html.indexOf('];', html.indexOf('var FEATURES = ['))).match(/^    \["/gm) || []).length, 'NX3: Homepage-Liste aktuell (node tools/funktionsliste.js)'); }
  // NW3
  assert(html.indexOf('BB11: Suche wie im Trades-Overlay') < 0, 'NW3: Watchlist-Overlay ohne Markt-Suche');
  // NW4: Perimeter (kein Hub), Modus Umkreis → Eigenes System
  w.localStorage.setItem('eve-zentrale-handel-ziel-v1', JSON.stringify({ buy: 'jita', dest: 'umkreis', hubs: [] }));
  await T.nwBuyHere(); await tick(300);
  let v = T.kkwLoad();
  assert(v.buy === 'sys' && d.getElementById('hl-start').value === 'Perimeter' && /Taron Velkar/.test(d.getElementById('kk-here').textContent), 'NW4: außerhalb eines Hubs → Eigenes System = Standort (' + JSON.stringify(v) + ' ' + d.getElementById('hl-start').value + ' / ' + d.getElementById('kk-here').textContent + ')');
  // im Hub-System → Hub
  here = 30000142; await T.nwBuyHere(); await tick(300);
  v = T.kkwLoad();
  assert(v.buy === 'jita', 'NW4: im Hub-System → dieser Hub (' + JSON.stringify(v) + ')');
  // Zu festem Hub, Char nicht im Hub → Wahl bleibt, Hinweis
  w.localStorage.setItem('eve-zentrale-handel-ziel-v1', JSON.stringify({ buy: 'amarr', dest: 'hubs', hubs: ['jita'] }));
  here = 30000144; await T.nwBuyHere(); await tick(300);
  v = T.kkwLoad();
  assert(v.buy === 'amarr' && /nicht in einem Hub/.test(d.getElementById('kk-here').textContent), 'NW4: Zu festem Hub bleibt, Hinweis (' + JSON.stringify(v) + ')');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})();
