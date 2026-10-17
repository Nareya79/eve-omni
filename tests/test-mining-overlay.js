// Mining-Overlay (14.10.2026): Tagebuch je Charakter mit Erzen (Overlay Top 3 + „+ N weitere“, Hauptfenster alle), Knopf „Heute“,
// Reiter in zwei Gruppen (alte gespeicherte Ansicht gilt weiter), Tooltip an jedem Mining-Knopf in DE und EN
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const day = o => new Date(Date.now() - o * 864e5).toISOString().slice(0, 10);
const JWT = scopes => 'x.' + Buffer.from(JSON.stringify({ scp: scopes })).toString('base64') + '.y';
const JITA = 60003760, SC = ['esi-industry.read_character_mining.v1'];
// 2 Charaktere, 3 Erze (Veldspar 1230, Scordite 1228, Pyroxeres 1224), 2 Systeme (Jita, Perimeter)
const ledger = {
  111: [{ date: day(0), solar_system_id: 30000142, type_id: 1230, quantity: 1000 }, { date: day(0), solar_system_id: 30000142, type_id: 1228, quantity: 2000 },
        { date: day(0), solar_system_id: 30000144, type_id: 1224, quantity: 500 }, { date: day(0), solar_system_id: 30000144, type_id: 1230, quantity: 300 },
        { date: day(1), solar_system_id: 30000142, type_id: 1230, quantity: 5000 }],
  222: [{ date: day(0), solar_system_id: 30000144, type_id: 1228, quantity: 800 }]
};
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: k => /x-pages/i.test(k) ? '1' : null }, json: () => Promise.resolve(x) });
function win(lang){
  return new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
    x.localStorage.setItem('eve-zentrale-lang-v1', lang);
    x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
      { access_token: JWT(SC), refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' },
      { access_token: JWT(SC), refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '222', character_name: 'Zwei' }]));
    x.localStorage.setItem('eve-zentrale-miningledger-v1', JSON.stringify({ e: {}, cn: {} }));
    x.fetch = (u) => { u = String(u); let m;
      if ((m = /characters\/(\d+)\/mining\//.exec(u))) return json(ledger[m[1]] || []);
      if ((m = /universe\/systems\/(\d+)/.exec(u))) return json({ name: m[1] === '30000142' ? 'Jita' : 'Perimeter', security_status: 0.95, constellation_id: 20000020 });
      if (/universe\/constellations\//.test(u)) return json({ region_id: 10000002 });
      if (/universe\/names/.test(u)) return json([{ id: 10000002, name: 'The Forge' }]);
      if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))){ const p = { 1230: 20, 1228: 15, 1224: 30 }[m[1]]; return json(p ? [{ is_buy_order: true, location_id: JITA, system_id: 30000142, range: 'station', price: p, volume_remain: 1e9, min_volume: 1 }] : []); }
      return Promise.reject(new Error('offline')); };
  } }).window;
}
const VIEWS = ['log', 'moon', 'calc', 'table', 'sell'];
async function eachView(w, fn){   // jede Mining-Ansicht im Overlay (klein) und im Hauptfenster (groß)
  const T = w.__test;
  for (const v of VIEWS){
    const d0 = T.miLoad(); d0.view = v; d0.stid = 1230; w.localStorage.setItem('eve-zentrale-mining-v1', JSON.stringify(d0));
    const box = w.document.createElement('div'); w.document.body.appendChild(box); T.ovRenderViewInto('mining', box); await tick(30);
    T.miPageRender(); await tick(30);
    fn(v, box, false); fn(v, w.document.getElementById('mi-page'), true);
    box.remove();
  }
}
(async () => {
  try{
    let w, d, $;
    w = win('de'); await tick(800); d = w.document; $ = id => d.getElementById(id);
    const T = w.__test;
    $('neo-btn-mining').click(); await tick(100);
    d.querySelector('#mi-page [data-ova="miView"][data-arg="log"]').click(); await tick(500);
    const pg = $('mi-page');
    // c) Reiter: zwei Gruppen, neue Reihenfolge
    const grp = [...pg.querySelectorAll('.mi-view .mi-grp')];
    assert(grp.length === 2 && /Mein Mining/.test(grp[0].querySelector('.mi-grp-t').textContent) && /Planen & Verkaufen/.test(grp[1].querySelector('.mi-grp-t').textContent), 'Reiter in Gruppen „Mein Mining“ und „Planen & Verkaufen“');
    assert([...pg.querySelectorAll('.mi-view [data-ova="miView"]')].map(b => b.getAttribute('data-arg')).join() === 'log,moon,calc,table,sell', 'Reihenfolge Tagebuch, Mond | Erz-Rechner, Erz-Tabelle, Verkaufen');
    // a) Overlay: je Charakter die Erze, Top 3 + „+ 1 weitere“
    let box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    const cr = [...box.querySelectorAll('.ml-row')];
    assert(cr.length === 2 && /Eins/.test(cr[0].textContent) && /Zwei/.test(cr[1].textContent), 'Overlay: „Heute abgebaut“ je Charakter (Eins vor Zwei, nach Wert)');
    const oresOf = root => { const out = {}; let c = null; root.querySelectorAll('.ml-row, .ml-ore').forEach(e => { if (e.classList.contains('ml-row')) c = /Eins/.test(e.textContent) ? 'Eins' : 'Zwei'; else if (!e.querySelector('.ml-more')) (out[c] = out[c] || []).push(e.textContent); }); return out; };
    let o = oresOf(box);
    assert(o.Eins.length === 3 && o.Zwei.length === 1 && /\+ 1 weitere/.test(box.textContent), 'Overlay: Eins zeigt Top 3 Erze + „+ 1 weitere“, Zwei 1 Erz');
    assert(o.Eins.some(t => /Veldspar/.test(t) && /Jita/.test(t) && /1\.000 Stück/.test(t)) && o.Eins.some(t => /Pyroxeres/.test(t) && /Perimeter/.test(t)) && /Scordite/.test(o.Zwei[0]) && /Perimeter/.test(o.Zwei[0]), 'Overlay: Erz-Name, System und Stückzahl je Zeile');
    box.querySelector('[data-ova="mlMore"]').click(); await tick(30);
    await T.mlAction({ type: 'mlMore', arg: '111' }); box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    assert(oresOf(box).Eins.length === 4 && /weniger/.test(box.textContent), '„+ 1 weitere“ klappt alle 4 Erze auf');
    // Kopf mit Summe über alle Charaktere
    const all0 = T.mlRows(day(0)), m3 = all0.reduce((s, r) => s + r.m3, 0);
    assert(all0.length === 5 && /Heute abgebaut/.test(box.querySelector('.ml-head').textContent) && box.querySelector('.ml-head').textContent.indexOf(T.fmtNum(m3, 0) + ' m³') >= 0, 'Kopf „Heute abgebaut“ mit Summe m³ aller Charaktere (' + m3 + ')');
    // Hauptfenster: alle Erze, kein „weitere“
    T.miPageRender(); await tick(30);
    o = oresOf(pg);
    assert(o.Eins.length === 4 && o.Zwei.length === 1 && !pg.querySelector('[data-ova="mlMore"]'), 'Hauptfenster: alle Erze je Charakter');
    assert(pg.querySelector('.ml-chart rect title') && /m³ · Top-Erz: /.test(pg.querySelector('.ml-chart rect:last-child title').textContent), 'Balken-Tooltip: Datum, Wert, m³, Top-Erz');
    // b) Knopf „Heute“
    const hb = [...pg.querySelectorAll('[data-ova="mlDays"]')];
    assert(hb[0].getAttribute('data-arg') === '1' && hb[0].textContent === 'Heute' && hb[1].getAttribute('data-arg') === '7', '„Heute“ steht links von „7 Tage“');
    hb[0].click(); await tick(50);
    const dh = pg.querySelectorAll('.ml-t tr.ml-dh'), rows = [...pg.querySelectorAll('.ml-t tr:not(.ml-dh)')].slice(1);
    assert(dh.length === 1 && rows.length === 5 && !pg.querySelector('.ml-chart'), 'Heute: nur der heutige Tag (1 Gruppe, 5 Zeilen, kein Balken)');
    const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
    const rm3 = rows.reduce((s, r) => s + num(r.children[5].textContent), 0), gm3 = num(dh[0].children[1].textContent);
    assert(Math.abs(rm3 - gm3) <= rows.length && Math.abs(gm3 - m3) <= 1, 'Heute: Tagessumme m³ = Summe der Zeilen (' + gm3 + ')');
    const s0 = all0.reduce((s, r) => s + r.val, 0);
    assert(dh[0].children[2].textContent === T.shortIsk(s0) && pg.querySelector('.ml-sum').textContent.indexOf('Heute ' + T.shortIsk(s0)) >= 0, 'Heute: Wert-Summe in Gruppenzeile und Kopfzeile = Summe der Zeilen');
    // c) alte gespeicherte Ansichten bleiben gültig, ohne Wahl: Tagebuch wenn Daten da
    for (const v of ['calc', 'sell', 'log', 'moon', 'table']){ w.localStorage.setItem('eve-zentrale-mining-v1', JSON.stringify({ view: v })); assert(T.miLoad().view === v, 'gespeicherte Ansicht „' + v + '“ bleibt'); }
    w.localStorage.setItem('eve-zentrale-mining-v1', '{}');
    assert(T.miLoad().view === 'log', 'ohne gespeicherte Wahl + Tagebuch-Daten: Tagebuch');
    const lg = w.localStorage.getItem('eve-zentrale-miningledger-v1'); w.localStorage.removeItem('eve-zentrale-miningledger-v1');
    assert(T.miLoad().view === 'calc', 'ohne Tagebuch-Daten: Erz-Rechner'); w.localStorage.setItem('eve-zentrale-miningledger-v1', lg);
    // Beschreibungszeile (Erz-Rechner, Erz-Tabelle) einklappbar, Zustand gemerkt
    w.localStorage.setItem('eve-zentrale-mining-v1', JSON.stringify({ view: 'calc' })); T.miPageRender(); await tick(30);
    assert(/Rechnet für Schiff/.test(pg.querySelector('.mi-desc').textContent), 'Erz-Rechner: Beschreibungszeile');
    pg.querySelector('.mi-desc').click(); await tick(50);
    assert(T.miLoad().hideDesc.calc === true && /Was macht dieser Reiter/.test(pg.querySelector('.mi-desc').textContent), 'Beschreibung eingeklappt und gemerkt');
    w.localStorage.setItem('eve-zentrale-mining-v1', JSON.stringify({ view: 'log' }));
    // d) jeder Knopf + Tabellenkopf in allen Mining-Ansichten hat einen Tooltip (DE)
    const miss = [];
    await eachView(w, (v, root, big) => root.querySelectorAll('button, th, select').forEach(b => { if (!(b.getAttribute('title') || '').trim() && b.textContent.trim() && !(b.tagName === 'TH' && !b.textContent.trim())) miss.push(v + (big ? '/groß' : '/klein') + ': ' + b.tagName + ' ' + b.textContent.trim().slice(0, 30)); }));
    assert(!miss.length, 'jeder Mining-Knopf, jede Auswahl und jeder Spaltenkopf hat ein title (DE)' + (miss.length ? ': ' + miss.join(' | ') : ''));
    // d) EN: im englischen Modus kein deutsches Wort in den Tooltips
    w.close();
    w = win('en'); await tick(800); d = w.document;
    d.getElementById('neo-btn-mining').click(); await tick(100);
    await w.__test.mlAction({ type: 'mlGo' }); await tick(300);
    const DE = /[äöüÄÖÜß]|\b(und|nicht|oder|für|wird|mit|auf|ist|der|die|das|dem|den|des|je|wie|wenn|zeigen|Erz|Erze|Stück|weitere|Tage|Heute|abgebaut|Klasse|Menge|Wert|Tag|Charakter)\b/;
    const de = [];
    for (const v of VIEWS){
      const d0 = w.__test.miLoad(); d0.view = v; d0.stid = 1230; w.localStorage.setItem('eve-zentrale-mining-v1', JSON.stringify(d0));
      const box2 = d.createElement('div'); d.body.appendChild(box2); w.__test.ovRenderViewInto('mining', box2); w.__test.miPageRender(); await tick(60);
      [box2, d.getElementById('mi-page')].forEach(root => root.querySelectorAll('[title]').forEach(e => { const t = e.getAttribute('title'); if (DE.test(t)) de.push(v + ': ' + t); }));
      [box2, d.getElementById('mi-page')].forEach(root => root.querySelectorAll('.mi-view, .mi-desc, .ml-head, .ml-ore').forEach(e => { if (DE.test(e.textContent)) de.push(v + ' Text: ' + e.textContent.trim().slice(0, 80)); }));
      box2.remove();
    }
    assert(!de.length, 'EN: Mining-Tooltips und neue Texte ohne Deutsch' + (de.length ? ': ' + [...new Set(de)].join(' | ') : ''));
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
