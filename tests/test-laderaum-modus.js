// 5.0 (GitHub #3, aaronmaynard / The_IllusiOnist): Hauling/Hub-Handel – der in „Nur Laderaum“ eingetippte Wert darf nach dem Wechsel auf
// „Bestimmtes Schiff“ oder „Automatisch“ die Suche nicht mehr begrenzen; beim Zurückwechseln ist er wieder da; alter Speicherstand lädt.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k])); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
}
const KEY = 'eve-zentrale-hauling-v1';
(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let $ = id => w.document.getElementById(id);
    const btn = (pre, m) => w.document.querySelector('#' + pre + '-sm [data-sm="' + m + '"]');
    const eff = pre => w.__sbCargoEff(pre);
    for (const pre of ['hl', 'is']) {
      const cargo = $(pre + '-cargo');
      // 1) Nur Laderaum: 10 m³ eintippen
      btn(pre, 'cargo').click(); await tick(100);
      cargo.value = '10'; cargo.dispatchEvent(new w.Event('input', { bubbles: true })); cargo.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(100);
      assert(eff(pre) === 10, pre + ': Nur Laderaum rechnet mit dem eingetippten Wert (10)');
      assert(/10 m³/.test($(pre + '-calc').textContent), pre + ': „Gerechnet wird mit“ nennt 10 m³');
      // 2) Bestimmtes Schiff: Laderaum des Schiffs (ohne Login: Grundwert der Charon), nicht 10
      btn(pre, 'ship').click(); await tick(400);
      const shipCap = eff(pre);
      assert(shipCap > 100000, pre + ': Bestimmtes Schiff rechnet mit dem Schiffs-Laderaum (' + shipCap + '), nicht mit 10');
      assert(!/ 10 m³/.test($(pre + '-calc').textContent), pre + ': „Gerechnet wird mit“ nennt nicht mehr 10 m³ (' + $(pre + '-calc').textContent + ')');
      // 3) Automatisch: eingetippter Wert begrenzt nicht (ohne bekannte Schiffe: unbegrenzt, die Suche nimmt die Hangar-Schiffe)
      btn(pre, 'auto').click(); await tick(200);
      assert(eff(pre) > 10, pre + ': Automatisch wird nicht durch die eingetippten 10 m³ begrenzt (' + eff(pre) + ')');
      // 4) zurück zu Nur Laderaum: der eingetippte Wert ist wieder da
      btn(pre, 'cargo').click(); await tick(200);
      assert(cargo.value === '10' && eff(pre) === 10, pre + ': zurück zu Nur Laderaum – 10 m³ wieder da (' + cargo.value + ')');
      // 5) eigener Wert je Schiff (✎) bleibt erlaubt und überschreibt den eingetippten Wert nicht
      btn(pre, 'ship').click(); await tick(300);
      const fit = $(pre + '-fit'); fit.value = 'manual'; fit.dispatchEvent(new w.Event('change')); await tick(200);
      cargo.value = '777.000'; cargo.dispatchEvent(new w.Event('input', { bubbles: true })); cargo.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(200);
      assert(eff(pre) === 777000, pre + ': eigener Wert je Schiff gilt (777.000)');
      fit.value = 'auto'; fit.dispatchEvent(new w.Event('change')); await tick(200);
      btn(pre, 'cargo').click(); await tick(200);
      assert(cargo.value === '10' && eff(pre) === 10, pre + ': danach Nur Laderaum wieder mit 10 m³ (' + cargo.value + ')');
    }
    // 6) gespeichert wird der eingetippte Wert, auch wenn gerade ein Schiff gewählt ist
    btn('hl', 'ship').click(); await tick(300);
    $('panel-haul').dispatchEvent(new w.Event('change'));
    const saved = JSON.parse(w.localStorage.getItem(KEY));
    assert(saved['hl-cargo'] === '10', 'Speicher: eingetippter Laderaum (10), nicht der Schiffs-Laderaum (' + saved['hl-cargo'] + ')');
    w.close();
    // 7) Neustart mit diesem Speicher: Schiff bleibt gewählt, Suche rechnet mit dem Schiff, Nur Laderaum zeigt 10
    w = makeWindow({ [KEY]: JSON.stringify(saved) }); await tick(700); $ = id => w.document.getElementById(id);
    assert(w.__sbCargoEff('hl') > 100000, 'Neustart: Schiff gewählt – Suche rechnet mit dem Schiffs-Laderaum');
    w.document.querySelector('#hl-sm [data-sm="cargo"]').click(); await tick(200);
    assert($('hl-cargo').value === '10' && w.__sbCargoEff('hl') === 10, 'Neustart: Nur Laderaum zeigt die gemerkten 10 m³');
    w.close();
    // 8) alter Speicherstand (4.0.78: hl-cargo = berechneter Schiffs-Laderaum, kein Extra-Feld) lädt fehlerfrei
    w = makeWindow({ [KEY]: JSON.stringify({ 'hl-max-ship': '', 'hl-cargo': '435.000', 'hl-budget': '1.000.000' }) }); await tick(600); $ = id => w.document.getElementById(id);
    assert($('hl-cargo').value === '435.000' && w.__sbCargoEff('hl') === 435000, 'alter Speicherstand: Laderaum 435.000 geladen');
    w.close();
    console.log('\nALL LADERAUM-MODUS TESTS PASSED');
  }catch(e){ console.log(e.message); console.log('LADERAUM-MODUS TESTS FAILED'); process.exit(1); }
})();
