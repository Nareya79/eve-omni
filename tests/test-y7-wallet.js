// Y7 (27.09.2026): Wallet wie in EVE – Reiter Wallets/Übersicht/Buchungen, Corp-Divisionen, große Seite „Wie in EVE“
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now();
const jwt = sc => 'x.' + Buffer.from(JSON.stringify({ scp: sc })).toString('base64') + '.y';
const CHARS = [
  { access_token: 'a', refresh_token: 'r', expires_at: NOW + 3600000, character_id: '111', character_name: 'Taron Velkar' },
  { access_token: jwt(['esi-wallet.read_character_wallet.v1']), refresh_token: 'r', expires_at: NOW + 3600000, character_id: '222', character_name: 'Alt Char' }
];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.fetch = (url) => {
      const ok = d => Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(d) });
      if (/\/characters\/(111|222)\/\?/.test(url)) return ok({ corporation_id: 98000001 });
      if (/\/corporations\/98000001\/\?/.test(url)) return ok({ name: 'Test Corp' });
      if (/\/corporations\/98000001\/wallets\//.test(url)) return ok([{ division: 1, balance: 5e9 }, { division: 2, balance: 1e6 }]);
      if (/\/corporations\/98000001\/divisions\//.test(url)) return ok({ wallet: [{ division: 2, name: 'Steuern' }] });
      return Promise.reject(new Error('offline'));
    };
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert(T.owCat('market_transaction') === 'trade' && T.owCat('agent_mission_reward') === 'agent' && T.owCat('player_donation') === 'xfer' && T.owCat('bounty_prizes') === 'bounty' && T.owCat('skill_purchase') === 'misc', 'Arten → Kategorien wie in EVE');
    const c = await T.owLoadCorps();
    assert(c.length === 1 && c[0].name === 'Test Corp' && c[0].divs.length === 2 && c[0].divs[0].n === 'Haupt-Wallet' && c[0].divs[1].n === 'Steuern' && c[0].divs[1].bal === 1e6, 'Corp-Wallet: Divisionen mit Namen, Charakter ohne Scope übersprungen');
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1e9, sell: 0, escrow: 0, d24: 0 }, { id: '222', name: 'Alt Char', bal: 2e6, sell: null, escrow: null, d24: null }],
      j: [{ d: NOW - 3600e3, a: 3e6, b: 1e9, r: 'market_transaction', p: 98000002, c: '111' },
          { d: NOW - 7200e3, a: 1e6, b: 997e6, r: 'bounty_prizes', p: 1000125, c: '111' },
          { d: NOW - 7200e3, a: -5e5, b: 2e6, r: 'player_donation', p: 90000001, c: '222' },
          { d: NOW - 10 * 86400e3, a: 9e9, b: 1, r: 'market_transaction', p: 1, c: '111' }],
      nm: { 98000002: 'Käufer Corp', 1000125: 'CONCORD', 90000001: 'Freund Pilot' }, corps: c });
    const view = () => { const b = d.createElement('div'); T.owView(b, false); return b; };
    let b = view();
    assert(b.querySelector('.ow-tabs [data-arg="w"][aria-pressed="true"]') && b.querySelector('.ow-corp') && b.querySelectorAll('.ow-divs > div').length === 2 && /Steuern/.test(b.querySelector('.ow-divs').textContent) && b.querySelectorAll('.ow-c').length === 2, 'Reiter Wallets: Corp-Kachel mit Divisionen + Charakterkarten');
    T.owAction({ type: 'owTab', arg: 'o' });
    b = view();
    assert(/conic-gradient/.test(b.querySelector('.ow-don').getAttribute('style')) && /4 Mio. ISK/.test(b.querySelector('.ow-don').textContent), 'Übersicht: Ring-Diagramm, Einnahmen der Woche in der Mitte (9 Mrd. von vor 10 Tagen nicht drin)');
    assert(/75 %/.test(b.querySelector('.ow-leg2 [data-arg="trade"]').textContent) && /25 %/.test(b.querySelector('.ow-leg2 [data-arg="bounty"]').textContent), 'Legende mit Anteilen');
    assert(/Saldo/.test(b.querySelector('.ov-sum').textContent) && /3 Buchungen von 2 Wallets/.test(b.textContent), 'Einnahmen/Ausgaben/Saldo + Anzahl');
    T.owAction({ type: 'owDir', arg: 'out' });
    assert(/Überweisungen\s*100 %/.test(view().querySelector('.ow-leg2 [data-arg="xfer"]').textContent), 'Umschalter Ausgaben');
    T.owAction({ type: 'owDays', arg: '30' });
    T.owAction({ type: 'owDir', arg: 'in' });
    assert(/9 Mrd/.test(view().querySelector('.ow-don').textContent), '30 Tage nimmt ältere Buchungen mit');
    T.owAction({ type: 'owCat', arg: 'bounty' });
    b = view();
    assert(b.querySelector('.ow-tabs [data-arg="j"][aria-pressed="true"]') && b.querySelectorAll('.owj').length === 1 && /CONCORD/.test(b.querySelector('.owj-p').textContent) && /corporations\/1000125\/logo/.test(b.querySelector('.owj-p img').src), 'Klick auf Legende → Buchungen dieser Art, NPC-Corp mit Logo');
    T.owAction({ type: 'owCat', arg: 'all' });
    T.owAction({ type: 'owFind', form: { q: 'freund' } });
    b = view();
    const r = b.querySelector('.owj');
    assert(b.querySelectorAll('.owj').length === 1 && r.querySelector('b.bad') && /−500\.000,00/.test(r.textContent) && /characters\/90000001\/portrait/.test(r.querySelector('img').src) && /Alt Char/.test(r.querySelector('.owj-r').textContent), 'Suche; Betrag rot, Pilot mit Porträt, Charakter rechts');
    T.owAction({ type: 'owFind', form: { q: '' } });
    T.switchTab('wallet'); T.wvSetView('eve');
    assert(!$('wv-eve-wrap').hidden && $('wv-overview-wrap').hidden && $('wv-view-eve').getAttribute('aria-selected') === 'true' && $('ow-page').querySelectorAll('.owj').length === 4, 'Große Seite: Unterreiter „Wie in EVE“ mit denselben Buchungen');
    $('ow-page').querySelector('[data-ova="owTab"][data-arg="o"]').click();
    await tick();
    assert($('ow-page').querySelector('.ow-don'), 'Klick auf Reiter der großen Seite wirkt');
    T.owAction({ type: 'owTab', arg: 'w' });
    console.log('\nALL Y7 WALLET TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
