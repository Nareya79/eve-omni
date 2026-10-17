// KA (09.10.2026): Regionskarte wie DOTLAN – Kästchen an der Schema-Position, keine Überlappung, alle Ebenen, große Karte + Overlay
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
    const d = w.document, T = w.__test, D = T.mpsData(), adj = T.mpsAdj();
    const RID = 10000002;   // The Forge
    const ids = D.sys.filter(o => o.r === RID).map(o => o.id), inR = {}; ids.forEach(id => { inR[id] = 1; });
    const data = { sys: {}, ext: {}, edges: [] };
    D.sys.forEach((o, i) => { if (inR[o.id]) data.sys[o.id] = [o.n, 0, 0, o.s, o.c]; });
    D.sys.forEach((o, i) => { if (!inR[o.id]) return; adj[i].forEach(j => { const b = D.sys[j]; if (!inR[b.id]) data.ext[b.id] = [b.n, 0, 0, b.s, b.r]; if (o.id < b.id || !inR[b.id]) data.edges.push([o.id, b.id]); }); });
    const L0 = T.mpDlPos(RID), G = L0.G;
    assert(T.mpDlOk(data, RID) && Object.keys(L0.pos).length === ids.length + G.N.length, 'The Forge: jedes System und jeder Nachbar hat einen Platz');
    const P = Object.keys(L0.pos).map(k => L0.pos[k]); let hits = 0;
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) if (Math.abs(P[a][0] - P[b][0]) < G.BW && Math.abs(P[a][1] - P[b][1]) < G.BH) hits++;
    assert(hits <= 2, 'Kästchen liegen nicht übereinander (Überlappungen: ' + hits + ')');
    assert(!T.mpDlOk({ sys: { 1: ['X', 0, 0, 1, 1] }, ext: {}, edges: [] }, RID), 'unbekannte Systeme → alte Zeichnung');
    const jita = String(D.sys.find(o => o.n === 'Jita').id);
    T.setKillCache({ t: Date.now(), kills: { [jita]: { s: 7, p: 2, n: 0 } }, jumps: { [jita]: 3213 } });
    const mo = Object.assign(T.mpOpts(), { mn: false, gk: false, gr: false, me: false });
    const opt = ov => ({ ov, sel: jita, col: () => '#33aa55', rcol: null, bcol: k => k === jita ? '#aa3333' : null, showN: true, showK: true, mo, L: { route: [Number(jita), Number(Object.keys(data.sys).find(k => k !== jita))] }, need: () => {}, tctx: { as: {}, need: () => {} } });
    const big = T.mpDlSvg(data, RID, opt(false)), sv = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.innerHTML = big.svg;
    assert(sv.querySelectorAll('rect.bx').length === ids.length && sv.querySelectorAll('.nb').length === G.N.length, 'Große Karte: ein Kästchen je System + gestrichelte Nachbarn');
    const jb = sv.querySelector('rect.bx[data-sys="' + jita + '"]');
    assert(jb && /sel/.test(jb.getAttribute('class')) && /#aa3333/.test(jb.getAttribute('style')) && /#33aa55/.test(jb.getAttribute('style')), 'Jita: ausgewählt, Rahmen = Färbung, Füllung = zweite Ebene');
    assert(sv.querySelector('rect.kb') && [...sv.querySelectorAll('text.kt')].some(t => t.textContent === '9'), 'Kills als rotes Schild (9)');
    assert([...sv.querySelectorAll('text.l2')].some(t => /3,2k/.test(t.textContent)), 'Sprünge im Kästchen, gekürzt (3,2k)');
    assert(sv.querySelector('line.r') && sv.querySelectorAll('text.cn').length >= 5, 'Route als Linie, Konstellationsnamen');
    assert([...sv.querySelectorAll('text.imp')].some(t => t.textContent === 'Jita'), 'KA2: Namensschild für wichtige Systeme (Hub Jita) für weiten Zoom');
    assert(sv.querySelector('.nb rect[data-reg][data-ssys]'), 'Nachbar: Klick öffnet die Nachbarregion');
    const ov = T.mpDlSvg(data, RID, opt(true)), so = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); so.innerHTML = ov.svg;
    const ob = so.querySelector('rect.bx[data-msys="' + jita + '"]');
    assert(ob && ob.getAttribute('data-ova') === 'mapSel' && ob.hasAttribute('data-tip') && so.querySelector('.nb rect[data-ova="mapReg"]'), 'Overlay: Klick = Infos, Nachbar = Region wechseln, Tooltip');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
