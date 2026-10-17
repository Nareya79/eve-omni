// 10.10.2026: Bei 12 gespeicherten Regionen flog die neu geladene The Forge (kleinste Nummer) sofort wieder raus – Overlay hing bei „Lade …“
const fs = require('fs');
const src = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
const a = src.indexOf('  var mpRegMem = {};'), b = src.indexOf('  async function mpShow(');
let store = { r: {} };
for (let i = 0; i < 12; i++) store.r[10000010 + i] = { t: 1000 + i, sys: { 1: ['x', 0, 0, 1, 1] }, ext: {}, edges: [] };
const sysOf = id => ({ name: 'S' + id, position: { x: 1, z: 2 }, security_status: 0.9, constellation_id: 7, stargates: [] });
const fetch = async url => ({ json: async () => /regions/.test(url) ? { constellations: [7] } : /constellations/.test(url) ? { systems: [30000142] } : sysOf(30000142) });
const fn = new Function('mpLoadStore', 'mpSaveStore', 'fetch', 'ESI', 'tscPool', 'getStargateDestSystem', 'getConstellationRegion',
  src.slice(a, b) + '; return { mpRegion, mpRegData };');
const api = fn(() => JSON.parse(JSON.stringify(store)), o => { store = JSON.parse(JSON.stringify(o)); }, fetch, '', async (l, n, f) => { for (const x of l) await f(x); }, async () => null, async () => 1);
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
(async () => {
  await api.mpRegion(10000002);
  assert(store.r[10000002] && store.r[10000002].sys, 'The Forge bleibt gespeichert');
  assert(Object.keys(store.r).length === 12, 'weiter höchstens 12 Regionen');
  assert(!store.r[10000010], 'die am längsten geladene Region fliegt raus');
  assert(api.mpRegData(10000002), 'mpRegData findet die Region');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED');
})();
