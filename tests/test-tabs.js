// Smoke test 1: OmniCom tab switching + basic DOM wiring
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');

// Stub fetch so refreshStation()/refreshHaul() etc. don't hit the network but also don't throw unhandled.
global.fetch = undefined;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = function(url, opts) {
      // Return a never-resolving-but-safe rejected promise wrapped so unhandled rejections don't crash jsdom hard;
      // most refresh functions have try/catch around await fetch calls.
      return Promise.reject(new Error('network disabled in test'));
    };
    window.localStorage.clear();
  }
});

const { window } = dom;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

// Give the IIFE a tick to run (refreshStation is async-fired at the end)
setTimeout(() => {
  try {
    const doc = window.document;

    // 1. OmniCom buttons exist
    const ids = ['neo-btn-station','neo-btn-haul','neo-btn-wallet','neo-btn-assets','neo-btn-sell'];
    ids.forEach(id => assert(doc.getElementById(id), 'neocom button ' + id + ' exists'));

    // 2. Old tab-btn-* / panel-sales must NOT exist
    assert(!doc.getElementById('tab-btn-station'), 'old tab-btn-station removed');
    assert(!doc.getElementById('tab-btn-sales'), 'old tab-btn-sales removed');
    assert(!doc.getElementById('panel-sales'), 'old panel-sales removed');

    // 3. Panels exist
    ['panel-station','panel-haul','panel-intensiv','panel-wallet','panel-assets','panel-sell'].forEach(id => {
      assert(doc.getElementById(id), 'panel ' + id + ' exists');
    });

    // 4. Default state: station tab active
    assert(doc.getElementById('neo-btn-station').getAttribute('aria-selected') === 'true', 'station tab selected by default');
    assert(doc.getElementById('panel-station').classList.contains('active'), 'station panel active by default');

    // 5. Click wallet tab -> should switch
    doc.getElementById('neo-btn-wallet').onclick();
    assert(doc.getElementById('neo-btn-wallet').getAttribute('aria-selected') === 'true', 'wallet tab selected after click');
    assert(doc.getElementById('panel-wallet').classList.contains('active'), 'wallet panel active after click');
    assert(doc.getElementById('neo-btn-station').getAttribute('aria-selected') === 'false', 'station tab deselected after switch');
    assert(!doc.getElementById('panel-station').classList.contains('active'), 'station panel inactive after switch');

    // 6. Click assets tab
    doc.getElementById('neo-btn-assets').onclick();
    assert(doc.getElementById('panel-assets').classList.contains('active'), 'assets panel active after click');

    // 7. Click haul tab -> should switch (no lazy-load flag anymore since the Hauling rebuild -
    // the tab is destination-driven now, nothing auto-fetches on tab activation)
    doc.getElementById('neo-btn-haul').onclick();
    assert(doc.getElementById('panel-intensiv').classList.contains('active'), 'Handel (O2) opens the hub search first');
    doc.querySelector('#panel-intensiv [data-hd="haul"]').onclick();
    assert(doc.getElementById('panel-haul').classList.contains('active'), 'haul panel active after mode switch');

    // 7b. Click the new sell (Verkaufsscan) tab
    doc.getElementById('neo-btn-sell').onclick();
    assert(doc.getElementById('panel-sell').classList.contains('active'), 'sell panel active after click');
    assert(doc.getElementById('neo-btn-sell').getAttribute('aria-selected') === 'true', 'sell tab selected after click');
    assert(!doc.getElementById('panel-haul').classList.contains('active'), 'haul panel deselected after switching to sell');

    // 8. Wallet sub-elements present (merged Wallet+Sales)
    ['wv-range','wv-networth-assets','wv-refresh','wv-view-overview','wv-view-list',
     'wv-view-wa','wa-page',
     'wv-networth-card','wtx-page'].forEach(id => {
      assert(doc.getElementById(id), 'wallet element ' + id + ' exists');
    });

    console.log('\nALL TAB/DOM TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 300);
