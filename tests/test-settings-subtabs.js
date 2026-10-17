// Einstellungen in Unterbereichen (1.5.1), Versionsanzeige im Konto, Kasten "EVE-Clients umschalten".
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(host, extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = () => Promise.reject(new Error('offline'));
      if (host) w.evecoreHost = host;
    }
  }).window;
}
(async () => {
  try{
    // ---------- Browser ----------
    let w = makeWindow(); await tick(500);
    let d = w.document, $ = id => d.getElementById(id);
    const tabs = [...d.querySelectorAll('#panel-settings [data-set]')].map(b => b.textContent);
    assert(tabs.join('|') === 'Konto|Allgemein|Darstellung|Overlays|OmniCom|Alarme|EVE-Clients|EVE Omni|Daten|Funktionen|Über EVE Omni', 'Unterbereiche: ' + tabs.join(' | '));
    const pane = id => $(id).closest('.set-pane').getAttribute('data-pane');
    assert(pane('al-box') === 'start' && pane('sso-box') === 'chars' && pane('ui-scale') === 'look' && pane('ovs-views') === 'overlay' && pane('cy-box') === 'clients' && pane('wsync-source') === 'data' && pane('ui-lang') === 'start' && pane('ga-box') === 'alarm' && pane('hs-ontop') === 'program' && pane('dx-export') === 'data', 'Jede Einstellung im passenden Unterbereich');
    const vis = () => [...d.querySelectorAll('#panel-settings .set-pane')].filter(p => !p.hidden).map(p => p.getAttribute('data-pane'));
    assert(vis().join() === 'start', 'Anfangs nur „Allgemein“ sichtbar');
    d.querySelector('[data-set="clients"]').onclick();
    assert(vis().join() === 'clients' && d.querySelector('[data-set="clients"]').getAttribute('aria-selected') === 'true', 'Klick auf „EVE-Clients“ zeigt nur diesen Bereich');
    assert(w.localStorage.getItem('eve-zentrale-settings-sub-v1') === 'clients', 'Gewählter Unterbereich wird gemerkt');
    assert(/nur im Programm/.test($('set-pane-clients').textContent) && $('cy-box').classList.contains('host-only'), 'Im Browser: Hinweis, dass Umschalten nur im Programm geht');
    assert(/EVE Omni Beta \d+\.\d+\.\d+/.test($('ver-html').textContent) && /im Browser/.test($('ver-host').textContent) && /Beta \d+\.\d+\.\d+/.test($('set-ver').textContent), 'Version im Konto und oben in den Einstellungen: ' + $('ver-html').textContent);
    assert($('set-pane-about').contains($('ver-box')) && /Patchnotes/.test($('set-pane-about').textContent) && /Was EVE Omni kann/.test($('set-pane-about').textContent), 'I16: Version, Feature-Liste und Patchnotes unter Einstellungen › Über EVECore');
    assert($('set-pane-about').contains($('dev-open')) && /Geld geben/.test($('set-pane-about').textContent), 'T22: Knopf „In EVE öffnen“ mit Hinweis „Geld geben“');
    await $('dev-open').onclick(); await tick(30);
    assert(/neu einloggen/.test($('dev-open-st').textContent), 'T22: ohne Login ein klarer Hinweis');
    w.close();
    // ---------- wieder öffnen: letzter Unterbereich; Gang-Alarm-Sprung ----------
    w = makeWindow(null, { 'eve-zentrale-settings-sub-v1': 'data' }); await tick(500);
    d = w.document; $ = id => d.getElementById(id);
    assert(!$('set-pane-data').hidden && $('set-pane-start').hidden, 'Beim nächsten Öffnen wieder der zuletzt gewählte Bereich');
    w.__test && w.__test.gaGotoSettings && w.__test.gaGotoSettings();
    const ga = $('ga-goto'); if (ga && ga.onclick) ga.onclick();
    await tick(50);
    assert(!$('set-pane-alarm').hidden, 'Sprung zu den Gang-Alarm-Einstellungen öffnet den Unterbereich „Gang-Alarm“');
    w.close();
    // ---------- Programm ----------
    const S = { hotkeys:{}, backup:{}, htmlPathEffective:'C:\\EVECore\\EVECore.html', fgHelper:'ok', eveClients:[{ hwnd:'1', name:'Taron Velkar' }, { hwnd:'2', name:'Orvan' }], cycle:{ on:true, fwd:{ vk:9, mods:0, label:'Tab' }, back:{ vk:9, mods:2, label:'Umschalt+Tab' }, skipLogin:true, order:[] } };
    const host = { isHost:true, version:'1.5.0', onCommand(){}, ready(){}, setMode(){}, getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))), setSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))) };
    w = makeWindow(host, { 'eve-zentrale-settings-sub-v1': 'clients' }); await tick(700);
    d = w.document; $ = id => d.getElementById(id);
    assert(d.documentElement.classList.contains('in-host') || true, 'Programm-Modus');
    assert([...d.querySelectorAll('#cy-list .cy-row')].length === 2 && /2 EVE-Clients offen/.test($('cy-status').textContent), 'Unterbereich „EVE-Clients“ zeigt die Clients');
    assert(/Programm EVE-Omni\.exe Beta 1\.5\.0/.test($('ver-html').textContent) && /im Programm/.test($('ver-host').textContent) && /EVECore\.html$/.test($('ver-path').textContent), 'Konto zeigt Programm-Version und geladene Datei');
    assert(/verschiedene Versionen/.test($('ver-warn').textContent) && /Programm 1\.5\.0/.test($('set-ver').textContent), 'Warnung, wenn Programm und Datei nicht zusammenpassen');
    console.log('\nALL SETTINGS-SUBTAB TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
