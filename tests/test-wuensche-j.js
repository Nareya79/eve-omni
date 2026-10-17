// Abschnitt J (Wuensche vom 24.09.2026, 3. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // J4: Sortierung – Standard, Umschalten, zweiter Klick dreht um, leere Werte ans Ende
    const W = [{ name: 'beta', bal: 5 }, { name: 'Alpha', bal: 9 }, { name: 'gamma', bal: null }];
    const K = { name: x => x.name, bal: x => x.bal };
    assert(T.sortList('wallet', W, K).map(x => x.name).join() === 'Alpha,beta,gamma', 'J4: Wallet Standard Kontostand groß → klein, leer am Ende');
    T.sortClick('wallet:name');
    assert(T.sortGet('wallet').by === 'name' && !T.sortGet('wallet').desc, 'J4: erster Klick auf Name = A–Z');
    assert(T.sortList('wallet', W, K).map(x => x.name).join() === 'Alpha,beta,gamma', 'J4: A–Z ohne Groß/klein-Unterschied');
    T.sortClick('wallet:name');
    assert(T.sortGet('wallet').desc && T.sortList('wallet', W, K)[0].name === 'gamma', 'J4: zweiter Klick dreht um (Z–A)');
    T.sortClick('wallet:quatsch');
    assert(T.sortGet('wallet').by === 'name', 'J4: unbekannte Sortierung wird ignoriert');
    // Hauling: Tabelle im Hauptfenster mit Spaltenkoepfen, Overlay mit Leiste, „beste“ bleibt die mit dem meisten Gewinn
    const L = [{ stationId: 1, stationName: 'Zeta', systemName: 'Z', jumps: 9, itemCount: 1, profit: 9e6 }, { stationId: 2, stationName: 'Amarr', systemName: 'A', jumps: 1, itemCount: 1, profit: 2e6 }];
    T.renderDestinations(L);
    assert(d.querySelector('#hl-dest-table thead [data-arg="haul:iskh"]').classList.contains('on') && $('hl-dest-body').rows[0].cells[0].querySelector('.tsc-cp-v').textContent === 'Zeta', 'J4/T9: Hauling Standard nach Gewinn pro Std. (ohne Zeit nach Gewinn), Spaltenkopf markiert');
    d.querySelector('#hl-dest-table thead [data-arg="haul:perJump"]').click();
    T.setOvData({ haul: { t: Date.now(), origin: 'Jita', originSys: 'Jita', list: L } });
    T.renderDestinations(L);
    assert($('hl-dest-body').rows[0].cells[0].querySelector('.tsc-cp-v').textContent === 'Amarr', 'J4: Klick auf „Gewinn je Sprung“ sortiert um (2 Mio/1 Sprung vor 9 Mio/9)');
    const box = d.createElement('div'); T.ovRenderViewInto('hauling', box);
    const cards = box.querySelectorAll('.ov-card');
    assert(box.querySelector('.sort-bar [data-arg="haul:perJump"][aria-pressed="true"]') && /Amarr/.test(cards[0].textContent), 'J4: Overlay nutzt dieselbe Sortierung');
    assert(/beste/.test(cards[1].textContent) && !/beste/.test(cards[0].textContent), 'J4: „beste“ bleibt beim höchsten Gewinn');
    assert(/data-arg="0"/.test(cards[1].innerHTML), 'J4: Route-Knopf zeigt weiter auf das richtige Ziel');
    // Trades: Name A–Z im Hauptfenster
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify([
      { id: 'a', tid: 34, name: 'Zydrine', hub: 'jita', qty: 5, buy: 1, sell: 2, unit: 1, created: 2, status: 'active' },
      { id: 'b', tid: 35, name: 'Pyerite', hub: 'jita', qty: 9, buy: 1, sell: 2, unit: 1, created: 1, status: 'active' }]));
    T.trRender();
    const names = () => Array.from($('trades-list').querySelectorAll('.tr-title')).map(e => e.textContent.trim()).join();
    assert(/^Zydrine.*Pyerite/.test(names()) && $('trades-list').querySelector('.sort-sel select').value === 'created', 'J4: Trades Standard neueste zuerst');
    const tsel = $('trades-list').querySelector('.sort-sel select'); tsel.value = 'name'; tsel.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(/^Pyerite.*Zydrine/.test(names()), 'J4: Trades nach Name A–Z per Klick');
    // J6: „＋ Lauf merken“ im Hauling- und Hub-Overlay
    w.localStorage.removeItem('eve-zentrale-haulruns-v1');
    const HL = { t: 111, origin: 'Jita', originSys: 'Jita', originStation: 60003760, originLabel: 'Jita IV - 4', list: [
      { stationId: 7, stationName: 'Amarr VIII', systemName: 'Amarr', jumps: 9, itemCount: 1, profit: 5e6, items: [{ tid: 34, name: 'Tritanium', q: 100, sp: 500, p: 200 }] }] };
    T.setOvData({ haul: HL });
    let ob = d.createElement('div'); T.ovRenderViewInto('hauling', ob);
    assert(ob.querySelector('[data-ova="hrAdd"][data-arg="0"]'), 'J6: Hauling-Overlay hat „＋ Lauf merken“');
    T.ovSatAction('hauling', { type: 'hrAdd', arg: '0' });
    let runs = JSON.parse(w.localStorage.getItem('eve-zentrale-haulruns-v1'));
    assert(runs.length === 1 && runs[0].from === 60003760 && runs[0].to === 7 && runs[0].items[0].sp === 500, 'J6: Lauf aus dem Hauling-Overlay gespeichert (mit Einkaufswert)');
    ob = d.createElement('div'); T.ovRenderViewInto('hauling', ob);
    assert(!ob.querySelector('[data-ova="hrAdd"]') && /✓ gemerkt/.test(ob.textContent), 'J6: danach „✓ gemerkt“');
    T.setOvData({ hub: { t: 222, src: { label: 'Jita', station: 1, stationName: 'Jita IV' }, dst: { label: 'Amarr', station: 2, stationName: 'Amarr VIII' },
      profit: 1, spend: 1, volUsed: 1, cargo: 10, rows: [{ tid: 35, name: 'Pyerite', q: 5, sp: 50, p: 10 }] } });
    ob = d.createElement('div'); T.ovRenderViewInto('hubhandel', ob);
    assert(ob.querySelector('[data-ova="hrAdd"][data-arg="hub"]'), 'J6: Hub-Overlay hat „＋ Lauf merken“');
    T.ovSatAction('hubhandel', { type: 'hrAdd', arg: 'hub' });
    runs = JSON.parse(w.localStorage.getItem('eve-zentrale-haulruns-v1'));
    assert(runs.length === 2 && runs[0].from === 1 && runs[0].to === 2, 'J6: Lauf aus dem Hub-Overlay gespeichert');
    // J3: Wallet-Overlay zeigt den gespeicherten Stand sofort (neues Fenster = Programmstart), mit Uhrzeit
    const now = Date.now(), t0 = now - 3 * 60000;
    const w2 = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
      x.fetch = () => new Promise(() => {});   // Nachladen haengt → es zaehlt nur der gespeicherte Stand
      x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token:'a', refresh_token:'r', expires_at: now + 3600000, character_id: 111, character_name: 'Taron' }]));
      x.localStorage.setItem('eve-zentrale-ovwallet-v1', JSON.stringify({ t: t0, list: [{ id: '111', name: 'Taron', bal: 2.5e9, sell: null, sellN: 0, escrow: null, buyN: 0, d24: null }, { id: '999', name: 'Weg', bal: 1, d24: null }] }));
    } }).window;
    await tick(600);
    const wb = w2.document.createElement('div'); w2.__test.ovRenderViewInto('wallet', wb);
    assert(/Taron/.test(wb.textContent) && /2,5 Mrd/.test(wb.textContent) && !/Weg/.test(wb.textContent), 'J3: gespeicherter Stand sofort da, abgemeldete Charaktere weg');
    const hm = new Date(t0).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    assert(w2.__test.ovFootText('wallet').age.indexOf('Stand ' + hm) === 0, 'J3: Fußzeile „Stand hh:mm“');
    w2.close();
    // J1: Miniplayer – voller Titel als Tooltip, Playlist-Auswahl mit aktueller Liste
    w.localStorage.setItem('eve-zentrale-jukebox-v1', JSON.stringify({ streams: [{ name: 'Sehr langer Titel eines Radiosenders', url: 'http://x/1' }], favs: ['http://x/1'], lists: [{ name: 'Kampf', urls: ['http://x/1'] }], list: 'p0' }));
    const jb = d.createElement('div'); T.ovRenderViewInto('musik', jb);
    const sel = jb.querySelector('select[data-jb-list]');
    assert(sel && sel.options.length === 3 && sel.value === 'p0', 'J1: Playlist-Auswahl (Alle, Favoriten, Kampf) mit aktueller Liste');
    assert(/Titel bereit/.test(jb.querySelector('.ov-name').title), 'J1: Titel hat Tooltip mit vollem Text');
    console.log('\nALL WUENSCHE-J TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
