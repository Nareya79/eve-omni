// KK6: ein Formular statt zwei Reiter – „Verkaufen in“ entscheidet über Hub-Handel oder Hauling
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window, d = w.document, $ = id => d.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms || 120));
const mode = () => w.localStorage.getItem('eve-zentrale-handel-mode-v1') || 'hub';
const dest = k => d.querySelector('#kk-where [data-kkd="' + k + '"]');
const hid = id => $(id).closest('.field').hidden;
(async () => { try{
  await tick(700);
  d.getElementById('neo-btn-haul').click(); await tick();
  assert([...d.querySelectorAll('.hd-mode')].every(t => t.hidden), 'Reiter „Zu festem Hub/Station“ / „Im Umkreis“ ausgeblendet');
  assert($('kk-where') && d.querySelectorAll('#kk-where').length === 1 && $('kk-buy').options.length === 6, 'Ein gemeinsamer Kasten ①: Einkaufen in (5 Hubs + eigenes System)');
  $('kk-buy').value = 'jita'; $('kk-buy').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  dest('umkreis').click(); await tick();
  assert(mode() === 'haul' && $('hl-target').value === '' && $('hl-hub').value === 'jita' && $('panel-haul').classList.contains('active') && $('panel-haul').contains($('kk-where')), 'Alles im Umkreis → Hauling (Umkreis), Kasten wandert mit');
  assert(!hid('hl-radius') && hid('hl-target-sys') && hid('hl-start'), 'Umkreis: nur Sprünge sichtbar');
  dest('amarr').click(); await tick();
  assert(mode() === 'hub' && $('is-src').value === 'jita' && w.__test.isDstKeys().join() === 'amarr' && $('panel-intensiv').classList.contains('active') && $('panel-intensiv').contains($('kk-where')), 'Hub als Ziel → Hub-Handel Jita → Amarr');
  dest('dodixie').click(); await tick();
  assert(w.__test.isDstKeys().sort().join() === 'amarr,dodixie' && /die Ziel-Hubs/.test($('kk-where-hint').textContent), 'Mehrere Ziel-Hubs → Vergleich');
  assert(dest('jita').disabled, 'Einkaufs-Hub ist als Ziel gesperrt');
  dest('sys').click(); await tick();
  assert(mode() === 'haul' && $('hl-target').value === 'sys' && !hid('hl-target-sys') && hid('hl-radius'), 'Eigenes System als Ziel → Hauling mit Ziel-System');
  $('kk-buy').value = 'sys'; $('kk-buy').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  assert(mode() === 'haul' && $('hl-hub').value === '' && !hid('hl-start'), 'Einkaufen im eigenen System → Feld für das System');
  dest('amarr').click(); await tick();
  assert(mode() === 'haul' && $('hl-target').value === 'amarr', 'Eigenes System kaufen + Hub verkaufen → Hauling mit Ziel-Hub');
  const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-handel-ziel-v1'));
  assert(saved.buy === 'sys' && saved.dest === 'hubs' && saved.hubs.join() === 'amarr', 'Wahl wird gemerkt');
  // 5.0.6+: Suchoptionen im Overlay zu → nur Einkaufen in + Verkaufen in als kleine Knöpfe, Rest weg
  const T = w.__test, box = d.createElement('div');
  box.innerHTML = T.ovMirrorFields('haul-run', true);
  assert(box.querySelectorAll('.ovm-mini').length === 2 && box.querySelectorAll('[data-ova="kkb"]').length === 6, 'zu: Einkaufen in (5 Hubs + Eigenes System) als Knöpfe');
  assert(box.querySelector('[data-ova="kkb"][data-arg="sys"][aria-pressed="true"]'), 'zu: aktuelle Einkaufswahl markiert');
  assert(box.querySelectorAll('.ovm-mini [data-ova="kkd"]').length === 7 && !box.querySelector('[data-ovf="hl-budget"]') && !box.querySelector('.sb-info'), 'zu: Verkaufen-Knöpfe, ohne Budget und Hinweise');
  box.innerHTML = T.ovMirrorFields('haul-run', false);
  assert(!box.querySelector('.ovm-mini') && box.querySelector('select[data-ovf="kk-buy"]'), 'offen: alles wie bisher');
  assert(T.ovMirrorFields('scan-run', true) === '', 'Markt-Scanner: zu = nichts (kein Einkaufen/Verkaufen)');
  console.log('\nALL KK6 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } })();
