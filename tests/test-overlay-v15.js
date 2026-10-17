// Overlays 1.5.0: Wallet mit Porträt, Gesamtwert, Orders, 24 Std; Navigation im Overlay (Route einfach wie in EVE + Sprungroute),
// Eingaben überleben das Neuzeichnen, Einzelfenster schickt Formular-Aktionen.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now();
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:NOW+3600000, character_id:'111', character_name:'Taron Velkar' },
               { access_token:'b', refresh_token:'r', expires_at:NOW+3600000, character_id:'222', character_name:'Nareya Mythec' }];
const SYS = { 30000142: ['Jita', 0.946], 30000144: ['Perimeter', 0.95], 30002187: ['Amarr', 1.0], 30002659: ['Dodixie', 0.87], 30000139: ['Urlen', 0.96] };
let POSTS = [];
function makeWindow(extra, host){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      if (host) w.evecoreHost = host;
      w.fetch = function(url, opts){
        const u = String(url); let m;
        if (opts && opts.method === 'POST') POSTS.push({ u, body: opts.body });
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/journal\//))) return ok(m[1] === '111' ? [{ date: new Date(NOW - 3600000).toISOString(), amount: 25e6 }, { date: new Date(NOW - 7200000).toISOString(), amount: -5e6 }, { date: new Date(NOW - 3 * 86400000).toISOString(), amount: 999e6 }] : []);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\//))) return ok(m[1] === '111' ? 1234567890.12 : 50e6);
        if ((m = u.match(/\/characters\/(\d+)\/orders\//))) return ok(m[1] === '111' ? [{ is_buy_order: false, price: 100e6, volume_remain: 3 }, { is_buy_order: false, price: 1e6, volume_remain: 10 }, { is_buy_order: true, price: 5e6, volume_remain: 4, escrow: 20e6 }] : []);
        if (/\/characters\/\d+\/location\//.test(u)) return ok({ solar_system_id: 30000142 });
        if (u.indexOf('/universe/ids/') >= 0){ const n = JSON.parse(opts.body); return ok({ systems: n.map(x => { const id = Object.keys(SYS).find(k => SYS[k][0].toLowerCase() === String(x).toLowerCase()); return id ? { id: +id, name: SYS[id][0] } : null; }).filter(Boolean) }); }
        if ((m = u.match(/esi\.evetech\.net\/route\/(\d+)\/(\d+)$/))){ const b = JSON.parse(opts.body); const pr = b.preference; return ok({ route: pr === 'Safer' ? [30000142, 30000144, 30000139, 30002187] : [30000142, 30000144, 30002187] }); }
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))){ const x = SYS[m[1]] || ['S' + m[1], 0.5]; return ok({ name: x[0], security_status: x[1], constellation_id: 20000020 }); }
        if (/\/universe\/constellations\//.test(u)) return ok({ region_id: 10000002 });
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: 'X' + id })));
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(700);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // ---------- Planeten im OmniCom ----------
    $('neo-btn-pi').onclick(); await tick(100);
    assert($('panel-chars').classList.contains('active') && !$('ch-pi').hidden && $('neo-btn-pi').getAttribute('aria-selected') === 'true', 'OmniCom „Planeten“ öffnet direkt die PI-Übersicht');
    // ---------- Wallet ----------
    await T.ovLoadWallet(); await tick(100);
    const box = d.createElement('div'); T.ovRenderViewInto('wallet', box);
    const tx = box.textContent;
    assert(/Gesamtwert1,61 Mrd\. ISK/.test(tx), "Gesamtwert = Kontostände + Verkaufsorders + Treuhand (1,28 Mrd + 310 Mio + 20 Mio): " + tx.slice(0, 80));
    assert(/Verkaufsorders310 Mio\. ISK/.test(tx) && /Kauf \(Treuhand\)20 Mio\. ISK/.test(tx), 'Summen der Orders');
    assert(/24 Std \(netto\)\+20 Mio\. ISK/.test(tx), 'Bewegung der letzten 24 Std netto (ältere Buchungen zählen nicht)');
    const cards = box.querySelectorAll('.ow-c');
    assert(cards.length === 2 && cards[0].querySelector('img.ow-p').getAttribute('src') === 'https://images.evetech.net/characters/111/portrait?size=64', 'Je Charakter eine Karte mit Porträt (reichster oben)');
    assert(/Verkauf \(2\)310 Mio\. ISK/.test(cards[0].textContent) && /Kauf \(1\)20 Mio\. ISK/.test(cards[0].textContent) && /1\.234\.567\.890,12 ISK/.test(cards[0].textContent), 'Karte: Verkauf/Kauf mit Anzahl, exakter Kontostand');
    assert(/Assets \(gesch\.\)–/.test(tx), 'Assets ohne Schätzung: Hinweis statt Zahl');
    // ---------- Navigation: Route einfach ----------
    T.ovSetMode('compact'); await tick(100);
    const s0 = T.ovLoad(); s0.view = 'route'; T.ovSave(s0); T.ovRender(); await tick(50);
    let ob = $('ov-body');
    assert([...d.querySelectorAll('#ov-tabs .ov-tab')].some(b => b.textContent === 'Navigation'), 'Tab heißt jetzt „Navigation“');
    assert(ob.querySelector('.ov-form [data-ovf="from"]') && ob.querySelector('[data-ovf="to"]') && ob.querySelectorAll('.ovn-pref [data-ova="rtGo"]').length === 3, 'Formular: Start, Ziel, Kürzeste/Sicherste/Unsicherer');
    // Getipptes bleibt beim Neuzeichnen erhalten
    const fi = ob.querySelector('[data-ovf="from"]'); fi.value = 'Jita'; fi.dispatchEvent(new w.Event('input', { bubbles: true })); fi.focus();
    T.ovRender(); await tick(20);
    assert($('ov-body').querySelector('[data-ovf="from"]').value === 'Jita' && d.activeElement === $('ov-body').querySelector('[data-ovf="from"]'), 'Getippter Start bleibt beim Neuzeichnen stehen (mit Cursor)');
    const ti = $('ov-body').querySelector('[data-ovf="to"]'); ti.value = 'Amarr'; ti.dispatchEvent(new w.Event('input', { bubbles: true }));
    $('ov-body').querySelector('[data-ova="rtGo"][data-arg="secure"]').click(); await tick(500);
    let L = T.rtLoad().last;
    assert(L && L.route.join() === '30000142,30000144,30000139,30002187' && L.pref === 'secure' && T.rtLoad().from === 'Jita' && $('rt-to').value === 'Amarr', 'Klick auf „Sicherste“ berechnet die Route (auch in der großen Ansicht eingetragen)');
    ob = $('ov-body');
    assert(ob.querySelector('[data-arg="secure"]').getAttribute('aria-pressed') === 'true' && /Jita → Amarr/.test(ob.textContent) && ob.querySelectorAll('.ov-route-row').length === 4 && ob.querySelectorAll('.ovn-secbar i').length === 4, 'Overlay: gewählte Art markiert, Route mit Sicherheitsbalken');
    assert(/Kürzeste <small>2<\/small>/.test(ob.innerHTML), 'Andere Arten zeigen ihre Sprungzahl');
    // Enter = gewählte Art
    const ti2 = ob.querySelector('[data-ovf="to"]'); ti2.value = 'Amarr'; ti2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick(400);
    assert(T.rtLoad().last.pref === 'secure', 'Enter rechnet mit der gewählten Art');
    // Tauschen
    T.ovSatAction('route', { type: 'rtSwap', form: { from: 'Jita', to: 'Amarr' } }); await tick(50);
    assert(T.rtLoad().from === 'Amarr' && T.rtLoad().to === 'Jita' && $('rt-from').value === 'Amarr', 'Start und Ziel tauschen');
    // Mein Standort
    T.ovSatAction('route', { type: 'rtLoc', form: { from: '', to: 'Dodixie' } }); await tick(400);
    assert($('rt-from').value === 'Jita' && T.rtLoad().to === 'Dodixie', 'Standort-Knopf trägt das aktuelle System als Start ein, getipptes Ziel bleibt');
    // ---------- Navigation: Sprungroute ----------
    T.ovSatAction('route', { type: 'navMode', arg: 'jump' }); await tick(50);
    ob = $('ov-body');
    assert(ob.querySelector('[data-ovf="jfrom"]') && ob.querySelector('select[data-ovf="jship"]') && ob.querySelector('[data-ova="jpGo"]'), 'Sprung-Modus: Start, Ziel, Schiff, „Sprungroute“');
    T.ovSatAction('route', { type: 'jpGo', form: { jfrom: 'Amamake', jto: '1DQ1-A', jship: 'Nyx' } }); await tick(300);
    const url = T.ovLoad().jpUrl;
    assert(/evemaps\.dotlan\.net\/jump\/Nyx,/.test(url) && /Amamake:1DQ1-A/.test(url), 'Sprungroute über DOTLAN: ' + url);
    const fr = d.querySelector('#ov-root .ov-frame');
    assert(fr && !fr.hidden && fr.getAttribute('src') === url && $('ov-root').classList.contains('has-frame'), 'DOTLAN-Route erscheint unter dem Formular');
    T.ovRender(); assert(d.querySelector('#ov-root .ov-frame') === fr && fr.getAttribute('src') === url, 'Neuzeichnen lädt die Seite nicht neu');
    T.ovSatAction('route', { type: 'navMode', arg: 'route' }); await tick(50);
    assert(fr.hidden && !$('ov-root').classList.contains('has-frame'), 'Zurück zu „Route“: eingebettete Seite ausgeblendet');
    // ---------- Einzelfenster ----------
    const H = { pub: {} };
    const host = { getSettings: () => Promise.resolve({ windows: { route: { open: true } } }), setSettings: () => Promise.resolve({ windows: {} }), onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(){},
      publishView(id, data){ H.pub[id] = data; } };
    w.close(); w = makeWindow({}, host); await tick(700); T = w.__test;
    T.getOvSatOpen().route = true; T.getOvSatOpen().wallet = true;
    const o3 = T.ovLoad(); o3.navMode = 'jump'; o3.jpUrl = 'https://evemaps.dotlan.net/jump/Rhea,544/A:B'; T.ovSave(o3);
    T.ovPublishSatellites(); await tick(100);
    assert(H.pub.route.title === 'Navigation' && H.pub.route.frame === o3.jpUrl && /data-ova="jpGo"/.test(H.pub.route.html), 'Einzelfenster „Navigation“ bekommt Formular + Jump-Seite');
    console.log('\nALL OVERLAY 1.5 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
