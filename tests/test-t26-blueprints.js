// T26 (26.09.2026): Blueprints aller Charaktere + Industrie-Rollen mit Vorschlag des besten Charakters
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now();
function jwt(scopes, id){ const b = s => Buffer.from(JSON.stringify(s)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b({ alg: 'none' }) + '.' + b({ scp: scopes, sub: 'CHARACTER:EVE:' + id }) + '.x'; }
const CHARS = [
  { access_token: jwt(['esi-skills.read_skills.v1', 'esi-characters.read_blueprints.v1'], 111), refresh_token: 'r', expires_at: NOW + 3600000, character_id: '111', character_name: 'Orvan' },
  { access_token: jwt(['esi-skills.read_skills.v1'], 222), refresh_token: 'r', expires_at: NOW + 3600000, character_id: '222', character_name: 'Builder' }
];
const SK = { 111: [[3402, 5], [3406, 5], [24624, 4], [3380, 3]], 222: [[3380, 5], [3387, 5], [24625, 4], [3402, 1]] };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.fetch = u => { u = String(u);
      if (/characters\/111\/blueprints/.test(u)) return json([{ item_id: 1, type_id: 691, location_id: 60003760, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 10, time_efficiency: 20 },
                                                             { item_id: 2, type_id: 691, location_id: 99, location_flag: 'Unlocked', quantity: -2, runs: 5, material_efficiency: 8, time_efficiency: 16 }]);
      const m = u.match(/characters\/(\d+)\/skills/); if (m) return json({ skills: SK[m[1]].map(x => ({ skill_id: x[0], trained_skill_level: x[1] })) });
      if (/universe\/types\/691/.test(u)) return json({ name: 'Rifter Blueprint' });
      if (/universe\/stations\/60003760/.test(u)) return json({ name: 'Jita IV - Moon 4', system_id: 30000142 });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    assert(/esi-characters\.read_blueprints\.v1/.test(d.documentElement.innerHTML), 'T26: neue Berechtigung im Login');
    const st = { textContent: '' };
    const r = await T.inLoadBlueprints(['111', '222'], { 111: CHARS[0], 222: CHARS[1] }, st);
    assert(r.n === 2 && r.miss.join() === 'Builder', 'T26: Blueprints von Orvan, Builder braucht neuen Login');
    const rows = [...d.querySelectorAll('#in-bp-page .in-b')];
    const txt = rows.map(x => x.textContent);
    assert(rows.length === 2 && /Rifter Blueprint.*10%.*20%.*∞/.test(txt[0]) && /\/bp\?/.test(rows[0].querySelector('img:not(.in-ow)').src) && /8%.*16%.*5/.test(txt[1]) && /\/bpc\?/.test(rows[1].querySelector('img:not(.in-ow)').src), 'T26/X7: ME/TE, Original/Kopie (Icon), Läufe: ' + txt.join(' | '));
    const bps = JSON.parse(w.localStorage.getItem('eve-zentrale-listcache-v1')).industry.d.bps;
    assert(bps[0].loc === 'Jita IV - Moon 4' && bps[0].sys === 30000142 && bps[1].loc === 'in einem Container', 'T26/X7: Ort + System gespeichert');
    const roles = [...d.querySelectorAll('#in-roles-body tr')].map(tr => tr.textContent);
    assert(roles.some(x => /^Herstellen.*Builder am besten: Industry V, 10 Slots/.test(x)), 'T26: Herstellen → Builder (Industry V, 10 Slots): ' + roles[0]);
    assert(roles.some(x => /^Kopieren.*Orvan am besten: Science V, 10 Slots/.test(x)), 'T26: Kopieren → Orvan (Science V, 10 Slots)');
    const sel = d.querySelectorAll('#in-roles-body select')[0]; sel.value = '111'; sel.dispatchEvent(new w.Event('change'));
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-indroles-v1')).build === '111', 'T26: Rolle von Hand festgelegt und gemerkt');
    console.log('\nALL T26 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
