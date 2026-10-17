// V5 (03.10.2026, nach AUFTRAG-V3-V5-V8): Update-Hinweis über GitHub-Releases (api.github.com/repos/Nareya79/eve-omni/releases/latest)
// neuere / gleiche / ältere Version, Beta-Suffix, 404, offline, „überspringen“, „Später“, aus, höchstens 1× am Tag
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function mk(resp, pre){
  const calls = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); pre && pre(w.localStorage);
      w.fetch = u => { u = String(u); if (/api\.github\.com/.test(u)){ calls.push(u); return resp === 'offline' ? Promise.reject(new TypeError('offline')) : typeof resp === 'number' ? Promise.resolve({ ok: false, status: resp, json: () => Promise.resolve({}) })
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ tag_name: resp, name: 'EVE Omni ' + resp, html_url: 'https://github.com/Nareya79/eve-omni/releases/tag/' + resp, body: '## Neu\n- Wurmlöcher\n- Demo' }) }); }
        return Promise.reject(new Error('offline')); }; } }).window;
  return { w, calls };
}
(async () => {
  try{
    let { w, calls } = mk('v99.0.0'); await tick(700);
    let d = w.document, T = w.__test, bar = d.getElementById('upd-bar');
    assert(calls.length === 1 && /releases\/latest$/.test(calls[0]), 'V5: fragt GitHub-Releases (latest)');
    assert(T.verCmp('v4.1.0', '4.0.61') === 1 && T.verCmp('4.0.10', '4.0.9') === 1 && T.verCmp('v4.0.61', '4.0.61') === 0 && T.verCmp('4.1.0', '4.1.0-beta.2') === 1 && T.verCmp('4.1.0-beta.2', '4.1.0-beta.10') === -1, 'V5: Versionen vergleichen (v-Präfix, Beta-Suffix)');
    assert(!bar.hidden && /EVE Omni 99\.0\.0 ist da/.test(bar.textContent) && /Wurmlöcher/.test(bar.textContent) && bar.querySelector('[data-upd="go"]') && bar.querySelector('[data-upd="later"]') && bar.querySelector('[data-upd="skip"]'), 'V5: neuere Version → Hinweis mit Patchnotes und drei Knöpfen');
    bar.querySelector('[data-upd="later"]').click(); await tick(200);
    assert(bar.hidden, 'V5: „Später“ blendet bis zum nächsten Start aus');
    const saved = w.localStorage.getItem('eve-zentrale-update-v1'); w.close();
    ({ w, calls } = mk('v99.0.0', ls => ls.setItem('eve-zentrale-update-v1', saved))); await tick(700); d = w.document; bar = d.getElementById('upd-bar');
    assert(calls.length === 0 && !bar.hidden, 'V5: höchstens 1× am Tag fragen – zweiter Start nutzt die gemerkte Antwort');
    bar.querySelector('[data-upd="skip"]').click(); await tick();
    assert(bar.hidden && JSON.parse(w.localStorage.getItem('eve-zentrale-update-v1')).seen === 'v99.0.0', 'V5: „Diese Version überspringen“ merkt sich die Version');
    w.close();
    for (const [resp, name] of [['v4.0.0', 'ältere'], [404, '404 (noch kein Release)'], ['offline', 'offline']]){
      ({ w, calls } = mk(resp)); await tick(700);
      assert(w.document.getElementById('upd-bar').hidden && calls.length === 1, 'V5: ' + name + ' → kein Hinweis, kein Fehler');
      w.close();
    }
    ({ w, calls } = mk('v4.0.61')); await tick(700);
    assert(w.document.getElementById('upd-bar').hidden, 'V5: gleiche Version → kein Hinweis'); w.close();
    ({ w, calls } = mk('v99.0.0', ls => ls.setItem('eve-zentrale-update-v1', JSON.stringify({ off: true })))); await tick(700);
    d = w.document;
    assert(calls.length === 0 && d.getElementById('upd-bar').hidden && !d.getElementById('upd-on').checked, 'V5: aus → keine Abfrage, Schalter aus');
    d.getElementById('upd-now').onclick(); await tick(200);
    assert(calls.length === 1, 'V5: „Jetzt prüfen“ fragt sofort');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
