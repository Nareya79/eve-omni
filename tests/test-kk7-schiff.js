// KK7–KK10: Schiffsbereich in Hauling und Hub-Handel – drei Wege, nur passende Felder, Laderaum als Wert, Gank-Schutz, „Gerechnet wird mit“, Overlay gleich
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if (!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window, d = w.document, $ = id => d.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms || 120));
const hid = id => $(id).closest('.field').hidden;
(async () => { try{
  await tick(700);
  for (const pre of ['hl', 'is']){
    const sm = $(pre + '-sm'), btn = m => sm.querySelector('[data-sm=' + m + ']');
    assert(sm && sm.querySelectorAll('[data-sm]').length === 3, pre + ': drei Knöpfe Automatisch / Bestimmtes Schiff / Nur Laderaum');
    const sel = pre === 'hl' ? $('hl-max-ship') : $('is-ship');
    assert([...sel.options].filter(o => o.value === 'auto' || o.value === '').every(o => o.hidden), pre + ': „Automatisch“/„Eigene Eingabe“ nicht mehr im Klappmenü');
    btn('auto').click(); await tick();
    assert(sel.value === 'auto' && btn('auto').getAttribute('aria-pressed') === 'true', pre + ': Automatisch gewählt');
    assert(hid(sel.id) && hid(pre + '-fit') && hid(pre + '-cargo') && !hid(pre + '-ship-info'), pre + ': Automatisch – Schiff, Fitting, Laderaum ausgeblendet, Info sichtbar');
    btn('cargo').click(); await tick();
    assert(hid(sel.id) && hid(pre + '-fit') && !hid(pre + '-cargo') && hid(pre + '-cargo-info'), pre + ': Nur Laderaum – nur das m³-Feld');
    assert(/ohne Schiff/.test($(pre + '-calc').textContent) && /Gank-Schutz normal/.test($(pre + '-calc').textContent), pre + ': „Gerechnet wird mit“ zeigt Laderaum ohne Schiff + Gank-Schutz normal (Standard)');
    assert(/nicht rechnen/.test($(pre + '-gk-info').textContent), pre + ': Gank-Schutz sagt, dass er ohne Schiff nicht rechnen kann');
    btn('ship').click(); await tick(300);
    assert(!hid(sel.id) && !hid(pre + '-fit') && hid(pre + '-cargo') && !hid(pre + '-cargo-info'), pre + ': Bestimmtes Schiff – Liste + Fitting, Laderaum als Wert statt Feld');
    $(pre + '-cargo-info').querySelector('[data-sb=edit]').click(); await tick();
    assert(!hid(pre + '-cargo') && $(pre + '-fit').value === 'manual', pre + ': ✎ = eigener Laderaum (Feld erscheint)');
    $(pre + '-cargo-info').querySelector('[data-sb=back]').click(); await tick();
    assert(hid(pre + '-cargo') && $(pre + '-fit').value === 'auto', pre + ': ✕ zurück = wieder aus Skills/Fitting');
    $(pre + '-budget').value = ''; $(pre + '-budget').dispatchEvent(new w.Event('input', { bubbles: true })); await tick(400);
    assert(/leer = ganzes Wallet/.test($(pre + '-budget').placeholder) && /Budget = Wallet/.test($(pre + '-calc').textContent), pre + ': leeres Budget = Wallet steht dran');
    assert($(pre + '-gksafe').closest('.field').querySelector('label').textContent === 'Gank-Schutz' && [...$(pre + '-gksafe').options].map(o => o.textContent).join() === 'aus,vorsichtig,normal,knapp', pre + ': Gank-Schutz mit klaren Stufen');
  }
  // KK2–KK5: drei Schritte, klare Namen, abhängige Felder nur wenn gültig, Route + Verkaufsart in „Gerechnet wird mit“
  for (const [pre, pan] of [['hl', 'panel-haul'], ['is', 'panel-intensiv']]){
    const h = [...d.querySelectorAll('#' + pan + ' .kk-steps > .opt-group:not([hidden]) > .opt-h')].map(x => x.textContent).filter(x => !/^①/.test(x));
    assert(h.length === 2 && /^② Womit fliegen/.test(h[0]) && /^③ Wie viel ISK/.test(h[1]) && /^① Wo kaufen/.test(d.querySelector('#kk-where > .opt-h').textContent), pre + ': drei nummerierte Schritte (① gemeinsam für beide Suchen)');
    assert(d.querySelector('#' + pan + ' .kk-steps').contains($(pre + '-sm')) && d.querySelector('#' + pan + ' .kk-steps').contains($(pre + '-budget')), pre + ': Schiff und Budget in den Schritten');
    assert(d.querySelector('label[for=' + pre + '-depth]').textContent === 'Waren prüfen (Anzahl, max. 2000)' && d.querySelector('label[for=' + pre + '-extra]').textContent === 'Andocken & Handeln (Min.)', pre + ': klare Namen');
    $(pre + '-sellmode').value = 'instant'; $(pre + '-sellmode').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
    assert(hid(pre + '-selldays') && /sofort an Kauforders/.test($(pre + '-calc').textContent), pre + ': „Verkauf darf dauern“ nur bei Verkaufsorder');
    $(pre + '-sellmode').value = 'order'; $(pre + '-sellmode').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
    assert(!hid(pre + '-selldays') && /als Verkaufsorder \(höchstens \d+ Tage\)/.test($(pre + '-calc').textContent), pre + ': Verkaufsorder zeigt Tage');
    assert(/Kaufe in .+ → /.test($(pre + '-calc').textContent), pre + ': Route steht in „Gerechnet wird mit“');
  }
  $('hl-target').value = ''; $('hl-target').onchange(); await tick();
  assert(!hid('hl-radius') && hid('hl-target-sys') && /alles im Umkreis von \d+ Sprüngen/.test($('hl-calc').textContent), 'Hauling: Umkreis nur ohne festes Ziel');
  $('hl-target').value = 'sys'; $('hl-target').onchange(); $('hl-target').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  assert(hid('hl-radius') && !hid('hl-target-sys') && /Ziel-System eintragen/.test($('hl-calc').textContent), 'Hauling: Ziel-System nur bei eigenem Ziel, Hinweis wenn leer');
  [...$('is-dst').querySelectorAll('input')].forEach(i => { i.checked = false; }); $('is-dst').dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  assert(/Mindestens ein Ziel/.test($('is-calc').textContent) && $('is-calc').classList.contains('warn'), 'Hub-Handel: ohne Ziel gelber Hinweis');
  // Overlay „Handel“: gleicher Schiffsbereich, nur sichtbare Felder
  const T = w.__test || {};
  const ovm = T.ovMirrorFields('hub-run');
  assert(/data-ova="sb" data-arg="is:auto"/.test(ovm) && /Gerechnet wird mit/.test(ovm) && !/data-ovf="is-cargo"/.test(ovm), 'Overlay: Modus-Knöpfe + „Gerechnet wird mit“, verstecktes Laderaum-Feld fehlt');
  T.ovSatAction('handel', { type: 'sb', arg: 'is:cargo' }); await tick();
  assert($('is-ship').value === '' && /data-ovf="is-cargo"/.test(T.ovMirrorFields('hub-run')), 'Overlay: Knopf „Nur Laderaum“ schaltet um, Laderaum-Feld erscheint');
  const en = JSON.parse(fs.readFileSync(require('path').join(process.env.EVEOMNI_ROOT || require('path').resolve(__dirname, '..'), 'Programm-Quellcode/i18n-en-4073-13.json'), 'utf8'));
  assert(Object.keys(en).every(k => html.includes(JSON.stringify(k) + ': ')), 'Alle neuen Texte im englischen Wörterbuch');
  console.log('\nALL KK7 TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack || e); process.exit(1); } })();
