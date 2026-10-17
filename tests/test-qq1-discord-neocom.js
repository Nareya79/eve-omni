// 14.10.2026 QQ1: Discord im OmniCom – Symbol im Symbolpaket (gleiche Farbe wie die anderen), Knopf auch im Hauptfenster-OmniCom (nur im Programm),
// Zahl ungelesener Nachrichten am Knopf bzw. roter Punkt im OmniCom-Overlay (Programm meldet „discordCount“ bei jeder Änderung), DE/EN.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function open(lang, host){
  let toggled = 0;
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.localStorage.setItem('eve-zentrale-lang-v1', lang); w.fetch = () => Promise.reject(new Error('offline'));
      if (!host) return;
      let cb = null; w.evecoreHost = { isHost: true, notify: () => {}, getSettings: () => Promise.resolve({ windows: {}, hotkeys: {} }), setSettings: () => Promise.resolve({}), onCommand: f => { cb = f; }, toggleDiscord: () => { toggled++; } };
      w.__cmd = c => cb && cb(c); } }).window;
  return { w, toggled: () => toggled };
}
(async () => {
  try{
    assert(/if \(n !== dcUnread\) send\(\{ type: 'discordCount', n \}\)/.test(main) && /dcUnread = -1; send\(\{ type: 'discordCount', n: 0 \}\)/.test(main), 'main.js meldet jede Änderung der Zahl und 0 beim Schließen');
    let { w, toggled } = open('de', true); await tick(800);
    let d = w.document, T = w.__test, b = d.getElementById('neo-btn-discord');
    assert(b && d.getElementById('neocom').contains(b), 'Programm: Discord-Knopf im OmniCom des Hauptfensters');
    const sv = b.querySelector('svg'), ref = d.getElementById('neo-btn-wallet').querySelector('svg');
    assert(sv.classList.contains('ic2') && sv.getAttribute('data-icl') === ref.getAttribute('data-icl'), 'Symbol aus dem Symbolpaket, gleiche Linienfarbe wie Wallet (' + sv.getAttribute('data-icl') + ')');
    const ov = d.createElement('div'); ov.innerHTML = T.neoOverlayHtml();
    const ob = ov.querySelector('[data-neo="discord"]');
    assert(ob && ob.querySelector('svg.ic2') && ov.querySelectorAll('[data-neo="discord"]').length === 1, 'OmniCom-Overlay: Discord genau einmal, ebenfalls mit Paket-Symbol');
    b.click(); await tick(20);
    assert(toggled() === 1, 'Klick im Hauptfenster schaltet das Discord-Fenster');
    w.__cmd({ type: 'discordCount', n: 3 }); await tick(30);
    assert(b.querySelector('.neo-cnt') && b.querySelector('.neo-cnt').textContent === '3' && /3 ungelesen/.test(b.title), 'Zahl 3 am Knopf, Tooltip „3 ungelesen“');
    ov.innerHTML = T.neoOverlayHtml();
    assert(ov.querySelector('[data-neo="discord"]').classList.contains('dc-unread') && /3 ungelesen/.test(ov.querySelector('[data-neo="discord"]').getAttribute('aria-label')), 'Overlay: roter Punkt + Tooltip');
    assert(/\.neo-ov button\.dc-unread::after\{/.test(html), 'Punkt per CSS');
    const gh = b.closest('.neo-fly') && d.getElementById('neo-grp-' + b.closest('.neo-fly').id.replace('neo-fly-', ''));
    if (gh) assert(gh.classList.contains('dc-unread'), 'Hauptfenster: zugeklappte Gruppe (' + gh.id + ') zeigt den Punkt');
    w.__cmd({ type: 'discordCount', n: 0 }); await tick(30);
    ov.innerHTML = T.neoOverlayHtml();
    assert(!b.querySelector('.neo-cnt') && !ov.querySelector('.dc-unread') && !d.querySelector('#neocom .dc-unread'), 'Zahl 0 (gelesen oder Fenster zu): Markierung weg');
    w.close();
    ({ w } = open('de', false)); await tick(800);
    assert(!w.document.getElementById('neo-btn-discord'), 'Browser ohne Programm: kein Discord-Knopf');
    w.close();
    ({ w } = open('en', true)); await tick(800);
    d = w.document; b = d.getElementById('neo-btn-discord');
    w.__cmd({ type: 'discordCount', n: 2 }); await tick(300);
    assert(b.title === 'Discord: 2 unread – click: chat window on/off', 'EN Tooltip: ' + b.title);
    console.log('\nALL QQ1 DISCORD-OMNICOM TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
})();
