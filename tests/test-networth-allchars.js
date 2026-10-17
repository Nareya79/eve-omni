// Verifies: (1) "Asset-Werte einbeziehen" defaults to checked, (2) the Gesamtwert/net-worth
// computation in wv-refresh runs for ALL logged-in characters, even ones unchecked in the
// wallet character filter (which should only affect transactions/journal).
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const CHARS = [
  { access_token: 'tokA', refresh_token: 'rA', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Alice' },
  { access_token: 'tokB', refresh_token: 'rB', expires_at: Date.now() + 3600000, character_id: '222', character_name: 'Bob' },
  { access_token: 'tokC', refresh_token: 'rC', expires_at: Date.now() + 3600000, character_id: '333', character_name: 'Carol' },
];

const netWorthCharIdsHit = new Set();

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '111');
    window.fetch = function(url, opts) {
      const u = String(url);
      if (/\/wallet\/transactions\//.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (/\/wallet\/journal\//.test(u)) return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve([]) });
      if (/\/characters\/(\d+)\/wallet\/\?/.test(u)) {
        const m = u.match(/\/characters\/(\d+)\/wallet\//);
        netWorthCharIdsHit.add(m[1]);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(1000000) });
      }
      if (/\/assets\//.test(u)) return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve([]) });
      return Promise.reject(new Error('unexpected fetch: ' + u));
    };
  }
});
const { window } = dom;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

setTimeout(async () => {
  try {
    const doc = window.document;
    const T = window.__test;

    assert(doc.getElementById('wv-networth-assets').checked === true, '"Asset-Werte einbeziehen" checkbox defaults to checked');

    const all = T.loadAllTokens();
    assert(all.length === 3, 'all 3 characters loaded from localStorage');

    // Uncheck Bob (222) in the wallet character filter row, as a real user would to exclude him
    // from transactions/journal — this must NOT exclude him from the Gesamtwert total.
    const boxes = doc.querySelectorAll('#sso-charlist input[type=checkbox]');
    let uncheckedOne = false;
    boxes.forEach(b => { if (b.value === '222') { b.checked = false; uncheckedOne = true; } });
    assert(uncheckedOne, 'found Bob\'s checkbox and unchecked it');

    const selected = T.getSelectedCharIds();
    assert(selected.length === 2 && selected.indexOf('222') === -1, 'getSelectedCharIds excludes the unchecked character (' + selected.join(',') + ')');

    // Now trigger the real wallet refresh flow
    await doc.getElementById('wv-refresh').onclick();

    assert(netWorthCharIdsHit.size === 3, 'Gesamtwert (computeNetWorth) ran for all 3 characters, including the unchecked one (' + Array.from(netWorthCharIdsHit).join(',') + ')');
    assert(netWorthCharIdsHit.has('222'), 'Bob (unchecked for transactions) is still included in the Gesamtwert total');

    console.log('\\nALL NET-WORTH-ALL-CHARS TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 300);
