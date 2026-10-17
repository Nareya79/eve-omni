// B1: Verkaufsart waehlbar (sofort / als Verkaufsorder) in Hub-Handel und Hauling,
// Hub-Handel mit mehreren Ziel-Hubs und gemerkter Auswahl (eve-zentrale-hubhandel-v1).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const TID = 555, AMARR = 60008494, JITA = 60003760, DODI = 60011866;
const R_JITA = 10000002, R_DODI = 10000032, R_AMARR = 10000043;

// Markthistorie: 40 Tage rueckwaerts ab gestern, konstante Menge -> Ø 30 Tage = perDay
function hist(perDay, avg){
  const out = [];
  for (let i = 1; i <= 40; i++) out.push({ date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), volume: perDay, average: avg, highest: avg, lowest: avg });
  return out;
}
const ok = data => Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(data) });

// Hub-Handel-Welt: Amarr kauft zu 100; Jita/Dodixie als Ziele
const HUB_BOOK = {
  [R_AMARR]: { sell: [{ type_id: TID, location_id: AMARR, price: 100, volume_remain: 10000 }], buy: [] },
  [R_JITA]:  { sell: [{ type_id: TID, location_id: JITA, price: 300, volume_remain: 50 }], buy: [{ type_id: TID, location_id: JITA, price: 150, volume_remain: 500 }] },
  [R_DODI]:  { sell: [{ type_id: TID, location_id: DODI, price: 250, volume_remain: 50 }], buy: [{ type_id: TID, location_id: DODI, price: 200, volume_remain: 500 }] },
};
const HIST = { [R_JITA]: hist(100, 290), [R_DODI]: hist(10, 240), 7001: hist(50, 195) };

// Hauling-Welt: Alpha (Start, 5001) -> Beta (5002), eine Region 7001
const SYSTEMS = { 9001: { name: 'Alpha', constellation_id: 8001, stations: [5001], stargates: [71] }, 9002: { name: 'Beta', constellation_id: 8001, stations: [5002], stargates: [] } };
const STATIONS = { 5001: { name: 'Alpha Trade Post', system_id: 9001 }, 5002: { name: 'Beta Trade Post', system_id: 9002 } };
const HAUL_BOOK = { sell: [{ type_id: TID, location_id: 5001, price: 100, volume_remain: 1000 }, { type_id: TID, location_id: 5002, price: 200, volume_remain: 5 }],
                    buy: [{ type_id: TID, location_id: 5002, price: 110, volume_remain: 1000 }] };
let calls = [];

function fakeFetch(url, opts){
  const u = String(url); calls.push(u);
  if (u.includes('/universe/ids/') && opts && opts.method === 'POST')
    return ok(JSON.parse(opts.body)[0] === 'Alpha' ? { systems: [{ id: 9001, name: 'Alpha' }] } : {});
  let m;
  if ((m = u.match(/\/universe\/systems\/(\d+)\//))) return ok(SYSTEMS[m[1]]);
  if (u.match(/\/universe\/stargates\/71\//)) return ok({ destination: { system_id: 9002 } });
  if (u.match(/\/universe\/constellations\//)) return ok({ region_id: 7001 });
  if ((m = u.match(/\/universe\/stations\/(\d+)\//))) return ok(STATIONS[m[1]] || { name: 'Hub', system_id: 1 });
  if (u.match(/\/universe\/types\/555\//)) return ok({ name: 'Test Ore', volume: 10 });
  if ((m = u.match(/\/markets\/(\d+)\/history\//))) return ok(HIST[m[1]] || []);
  if ((m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=all/))){
    const b = HUB_BOOK[m[1]] || { sell: [], buy: [] };
    return ok(b.sell.map(o => ({ ...o, is_buy_order: false })).concat(b.buy.map(o => ({ ...o, is_buy_order: true }))));
  }
  if ((m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=(sell|buy)/))){
    const book = m[1] === '7001' ? HAUL_BOOK : (HUB_BOOK[m[1]] || { sell: [], buy: [] });
    return ok(book[m[2]]);
  }
  return Promise.reject(new Error('offline'));
}
function makeWindow(store){
  return new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ Object.keys(store || {}).forEach(k => w.localStorage.setItem(k, store[k])); w.fetch = fakeFetch; } }).window;
}
async function runHub(w){
  const $ = id => w.document.getElementById(id);
  $('is-status').textContent = ''; $('is-start').click();
  for (let i = 0; i < 100 && !/^Fertig|^Fehler|^Bitte/.test($('is-status').textContent); i++) await tick(50);
  return $('is-status').textContent;
}

(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let $ = id => w.document.getElementById(id);
    const doc = w.document, change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
    const cb = k => doc.querySelector('#is-dst input[value="' + k + '"]');

    // --- Auswahl + Speicher ---
    assert($('is-src').value === 'amarr' && cb('jita').checked && !cb('dodixie').checked, 'Standard: Amarr -> Jita');
    assert(cb('amarr').disabled && cb('amarr').parentNode.classList.contains('off'), 'Einkaufs-Hub ist als Ziel gesperrt');
    cb('dodixie').checked = true; change(cb('dodixie'));
    $('st-broker').value = '1.5'; $('is-tax').value = '3.375'; $('is-cargo').value = '100000'; $('is-budget').value = '1000000000';

    // --- Sofort an Kauforders, zwei Ziele: je Ziel das beste, Dodixie (200) vor Jita (150) ---
    let st = await runHub(w);
    assert(/Bestes Ergebnis je Ziel-Hub \(2 Ziele\)/.test(st), 'Status: bestes Ergebnis je Ziel (' + st + ')');
    let blocks = [...doc.querySelectorAll('#is-options .option-block')];
    assert(blocks.length === 2 && /Dodixie/.test(blocks[0].querySelector('.summary-box').textContent) && /Jita/.test(blocks[1].querySelector('.summary-box').textContent), 'zwei Bloecke, Dodixie zuerst');
    assert(/Verkaufssteuer eingerechnet: 3.375 %/.test(blocks[0].textContent) && !/Verkaufsorder/.test(blocks[0].textContent), 'Sofortverkauf-Texte unveraendert');
    assert(!calls.some(u => u.includes('/history/')), 'Sofortverkauf holt keine Markthistorie');

    // --- Als Verkaufsorder: Jita 299,9 (100/Tag), Dodixie 249,9 (10/Tag) ---
    $('is-sellmode').value = 'order'; change($('is-sellmode'));
    $('is-selldays').value = '7'; change($('is-selldays'));
    st = await runHub(w);
    blocks = [...doc.querySelectorAll('#is-options .option-block')];
    const netJ = 299.9 * (1 - 4.875 / 100), profJ = 700 * (netJ - 100);
    assert(blocks.length === 2 && /Jita/.test(blocks[0].querySelector('.summary-box').textContent), 'Verkaufsorder: Jita zuerst (mehr Umsatz)');
    const t0 = blocks[0].textContent;
    assert(/Steuer 3.375 % \+ Broker 1.5 % eingerechnet/.test(t0), 'Broker + Steuer im Text');
    assert(/700×/.test(t0), 'Menge = 100/Tag × 7 Tage = 700 (nicht das ganze Angebot)');
    assert(/als Verkaufsorder zu 299,9/.test(t0), 'Preis einen Schritt unter 300 (' + t0.match(/als Verkaufsorder zu [^ ]+/) + ')');
    assert(/≈ 7 Tage bis verkauft \(Region Ø 100\/Tag\)/.test(t0), 'Tage-Schaetzung');
    const H = w.__test.getOvHubLast();
    assert(Math.abs(H.profit - profJ) < 1 && H.dst.label.startsWith('Jita'), 'Gewinn = 700 × (299,9 − Gebuehren − 100) (' + H.profit + ' / ' + profJ + ')');
    const tD = blocks[1].textContent;
    assert(/70×/.test(tD) && /als Verkaufsorder zu 249,9/.test(tD), 'Dodixie: 10/Tag × 7 = 70 zu 249,9');

    // --- Speicher nach Neustart ---
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-hubhandel-v1'));
    assert(saved.src === 'amarr' && saved.dst.join() === 'jita,dodixie' && saved.sellmode === 'order', 'Auswahl gespeichert');
    w.close();
    w = makeWindow({ 'eve-zentrale-hubhandel-v1': JSON.stringify({ src: 'jita', dst: ['jita', 'hek'], sellmode: 'order', selldays: '3' }) }); await tick(500);
    $ = id => w.document.getElementById(id);
    const cb2 = k => w.document.querySelector('#is-dst input[value="' + k + '"]');
    assert($('is-src').value === 'jita' && cb2('hek').checked && !cb2('dodixie').checked && $('is-sellmode').value === 'order' && $('is-selldays').value === '3', 'Neustart: Einkauf, Ziele und Verkaufsart wieder da');
    assert(cb2('jita').disabled && w.__test.isDstKeys().join() === 'hek', 'Ziel = Einkaufs-Hub wird uebersprungen');
    cb2('hek').checked = false;
    assert(/mindestens einen Verkaufs-Hub/.test(await runHub(w)), 'ohne Ziel: Hinweis');
    w.close();

    // --- Hauling als Verkaufsorder: Beta-Angebot 200 -> 199,9, 50/Tag × 7 = 350 ---
    calls = [];
    w = makeWindow({ 'eve-zentrale-hauling-v1': JSON.stringify({ 'hl-sellmode': 'order', 'hl-selldays': '7' }) }); await tick(500);
    $ = id => w.document.getElementById(id);
    assert($('hl-sellmode').value === 'order', 'Hauling: Verkaufsart aus Speicher');
    $('hl-hub').value = ''; $('hl-hub').onchange(); $('hl-start').value = 'Alpha'; $('hl-radius').value = '2';
    $('hl-cargo').value = '5000'; $('hl-budget').value = '1000000000'; $('hl-tax').value = '3.375'; $('st-broker').value = '1.5';
    await w.__test.runHaulingSearch();
    const d = w.__test.getHlDestinations();
    const profB = 350 * (199.9 * (1 - 4.875 / 100) - 100);
    assert(d.length === 1 && d[0].stationId === 5002 && Math.abs(d[0].profit - profB) < 1, 'Hauling: Beta mit 350 Stueck (' + (d[0] && d[0].profit) + ' / ' + profB + ')');
    assert(calls.filter(u => /\/markets\/7001\/orders\//.test(u)).length === 1, 'Start-Region wird nicht doppelt geladen');
    assert(/Verkaufsorder, höchstens 7 Tage/.test($('hl-status').textContent), 'Hauling-Status nennt die Verkaufsart');
    await w.document.querySelector('#hl-dest-body tr button:not(.tsc-cp-b)').onclick();
    const dt = $('hl-detail-options').textContent;
    assert(/als Verkaufsorder zu 199,9/.test(dt) && /≈ 7 Tage bis verkauft \(Region Ø 50\/Tag\)/.test(dt) && /Broker 1.5 %/.test(dt), 'Hauling-Details: Preis, Tage, Broker');
    w.close();
    console.log('\nALL SELLMODE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.log(e.stack || e.message); console.log('SELLMODE TESTS FAILED'); process.exit(1); }
})();
