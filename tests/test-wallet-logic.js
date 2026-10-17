// Smoke test 2: pie chart / networth / stats logic using injected test hooks
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = function() { return Promise.reject(new Error('network disabled in test')); };
    window.localStorage.clear();
  }
});
const { window } = dom;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

setTimeout(async () => {
  try {
    const T = window.__test;
    assert(T, '__test hook installed');

    const txs = [
      {_charId:'1', _charName:'Alice', is_buy:false, unit_price:100, quantity:10},
      {_charId:'1', _charName:'Alice', is_buy:true,  unit_price:50,  quantity:4},
      {_charId:'2', _charName:'Bob',   is_buy:true,  unit_price:900, quantity:1},
    ];
    // --- computeWalletStats ---
    const series = [
      {date:'2026-09-18', income:1000, expense:200, profit:800},
      {date:'2026-09-19', income:0, expense:900, profit:-900},
    ];
    const stats = T.computeWalletStats(series, txs.map(t => ({...t, date:'2026-09-19T00:00:00Z'})));
    assert(stats.totalIncome === 1000, 'computeWalletStats totalIncome sums series income');
    assert(stats.totalExpense === 1100, 'computeWalletStats totalExpense sums series expense');
    assert(stats.totalProfit === -100, 'computeWalletStats totalProfit = income-expense (-100)');

    // WA 09.10.2026: Kreisdiagramm „Aufteilung“ entfernt (Wallet › Auswertung ersetzt es)
    const doc = window.document;
    assert(!doc.getElementById('wv-pie-svg') && doc.getElementById('wa-page'), 'Aufteilung raus, Auswertung da');

    // --- renderNetWorth ---
    T.renderNetWorth([
      {name:'Alice', cash: 1000000, assetValue: 500000},
      {name:'Bob', cash: 250000, assetValue: null},
    ]);
    const nwBody = doc.getElementById('wv-networth-body');
    assert(nwBody.querySelector('.nw-total-hero'), 'net worth hero total rendered');
    assert(nwBody.querySelector('table.nw-table'), 'net worth table rendered');
    const heroText = nwBody.querySelector('.nw-total-hero').textContent;
    assert(heroText.indexOf('1.750.000') !== -1 || heroText.replace(/\\./g,'').indexOf('1750000') !== -1,
      'net worth hero shows combined total across characters (' + heroText + ')');

    // --- renderNetWorth empty state ---
    T.renderNetWorth([]);
    assert(nwBody.textContent.indexOf('Noch keine Daten') !== -1, 'net worth empty state message shown');

    console.log('\\nALL WALLET LOGIC TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 300);
