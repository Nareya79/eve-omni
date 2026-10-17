// Smoke test 3: new OmniCom tabs (Orders/Contracts/Industry) + Wallet Journal + new render functions
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
    const doc = window.document;
    const T = window.__test;
    assert(T, '__test hook installed');

    // --- New OmniCom buttons + panels exist ---
    ['neo-btn-orders','neo-btn-contracts','neo-btn-industry'].forEach(id => {
      assert(doc.getElementById(id), 'neocom button ' + id + ' exists');
    });
    ['panel-orders','panel-contracts','panel-industry'].forEach(id => {
      assert(doc.getElementById(id), 'panel ' + id + ' exists');
    });

    // --- Tab switching wires up the 3 new tabs ---
    doc.getElementById('neo-btn-orders').onclick();
    assert(doc.getElementById('panel-orders').classList.contains('active'), 'orders panel active after click');
    doc.getElementById('neo-btn-contracts').onclick();
    assert(doc.getElementById('panel-contracts').classList.contains('active'), 'contracts panel active after click');
    assert(!doc.getElementById('panel-orders').classList.contains('active'), 'orders panel deactivated on switch');
    doc.getElementById('neo-btn-industry').onclick();
    assert(doc.getElementById('panel-industry').classList.contains('active'), 'industry panel active after click');

    // --- Wallet Journal ---
    assert(doc.getElementById('wv-view-journal'), 'wv-view-journal subtab button exists');
    assert(doc.getElementById('wv-journal-wrap'), 'wv-journal-wrap exists');
    assert(T.journalTypeLabel('bounty_prizes') === 'Bounty', 'journalTypeLabel translates known ref_type');
    assert(T.journalTypeLabel('some_unknown_ref_type') === 'some unknown ref type', 'journalTypeLabel falls back to humanized raw ref_type');

    doc.getElementById('wv-range').value = '30';
    const now = Date.now();
    T.setWalletJournalCache({entries: [
      {date: new Date(now - 1*86400000).toISOString(), ref_type:'bounty_prizes', amount: 1500000, balance: 50000000, _charName:'Alice'},
      {date: new Date(now - 2*86400000).toISOString(), ref_type:'transaction_tax', amount: -25000, balance: 48500000, _charName:'Alice'},
      {date: new Date(now - 200*86400000).toISOString(), ref_type:'bounty_prizes', amount: 999999, balance: 1, _charName:'Old'}, // outside 30d range
    ]});
    T.renderWalletJournal();
    const jBody = doc.getElementById('wv-journal-body');
    assert(jBody.querySelectorAll('tr').length === 2, 'renderWalletJournal shows only entries within the selected date range (' + jBody.querySelectorAll('tr').length + ')');
    assert(jBody.textContent.indexOf('Bounty') !== -1, 'renderWalletJournal shows translated ref_type label');

    T.setWalletJournalCache({entries: []});
    T.renderWalletJournal();
    assert(doc.getElementById('wv-journal-body').textContent.indexOf('Keine Journal') !== -1, 'renderWalletJournal empty state shown');

    // --- Orders ---
    T.renderOrdersActive([
      {_charName:'Alice', is_buy_order:false, _typeName:'Tritanium', _locName:'Jita IV - Moon 4', volume_remain:100, volume_total:500, price:5.5, issued:new Date().toISOString(), duration:90},
    ]);
    const orBody = doc.getElementById('or-active-body');
    assert(orBody.querySelectorAll('tr').length === 1, 'renderOrdersActive renders one row');
    assert(orBody.textContent.indexOf('Verkauf') !== -1, 'renderOrdersActive shows Verkauf for a sell order');
    T.renderOrdersActive([]);
    assert(doc.getElementById('or-active-body').textContent.indexOf('Keine aktiven Orders') !== -1, 'renderOrdersActive empty state shown');

    T.renderOrdersHistory([
      {_charName:'Bob', is_buy_order:true, _typeName:'PLEX', _locName:'Amarr VIII', volume_remain:0, volume_total:10, price:4500000, state:'expired', issued:new Date().toISOString()},
    ]);
    assert(doc.getElementById('or-history-body').textContent.indexOf('Abgelaufen') !== -1, 'renderOrdersHistory translates order state');

    // --- Contracts --- (renderContractsList: prefix-targeted, rows grouped per Charakter incl. a portrait header row)
    T.renderContractsList('ct-active', [
      {_charId:1, _charName:'Alice', type:'item_exchange', status:'outstanding', title:'Fit bundle', price:12000000, _startLocName:'Jita IV', _endLocName:'Jita IV', date_issued:new Date().toISOString(), date_expired:new Date().toISOString()},
      {_charId:1, _charName:'Alice', type:'courier', status:'outstanding', title:'Haul job', reward:2000000, _startLocName:'Rens', _endLocName:'Hek', date_issued:new Date().toISOString()},
    ], 'Keine laufenden Verträge gefunden.');
    const ctBody = doc.getElementById('ct-active-body');
    assert(ctBody.querySelectorAll('tr:not(.ct-detail-row):not(.ct-group-header)').length === 2, 'renderContractsList renders both rows');
    assert(ctBody.querySelector('tr.ct-group-header') && ctBody.querySelector('tr.ct-group-header').textContent.indexOf('Alice') !== -1,
      'renderContractsList groups rows under a per-character header (Alice)');
    assert(ctBody.textContent.indexOf('Kurierauftrag') !== -1, 'renderContractsList translates courier type');
    assert(ctBody.textContent.indexOf('2.000.000,00') !== -1 || ctBody.textContent.replace(/\D/g,'').indexOf('200000000')!==-1, 'renderContractsList uses reward field for courier price (' + ctBody.textContent + ')');

    // --- Industry jobs + mining ---
    T.renderIndustryJobs([
      {_charName:'Alice', activity_id:1, _bpName:'Rifter Blueprint', _productName:'Rifter', runs:1, status:'active', end_date:new Date().toISOString()},
    ]);
    assert(doc.getElementById('in-jobs-body').textContent.indexOf('Fertigung') !== -1, 'renderIndustryJobs translates activity_id');
    assert(doc.getElementById('in-jobs-body').textContent.indexOf('Aktiv') !== -1, 'renderIndustryJobs translates status');

    T.renderMiningLedger([
      {date:new Date().toISOString(), _charName:'Alice', _sysName:'Jita', _typeName:'Veldspar', quantity:12345},
    ]);
    assert(doc.getElementById('in-mining-body').textContent.indexOf('Veldspar') !== -1, 'renderMiningLedger shows ore type');

    console.log('\\nALL EVERNUS-FEATURE TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 300);
