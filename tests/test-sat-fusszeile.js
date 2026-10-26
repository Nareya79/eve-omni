// 25.10.2026: Overlay-Einzelfenster (fenster=track, fenster=karte) zeigen die Fußzeile mit Countdown ohne Fehler.
// Vorher: esiCdTxt las eine var, die im Einzelfenster-Modus nie zugewiesen wird → „Fehler beim Zeichnen: Cannot read properties of undefined (reading 'Markt')“.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    for (const id of ['track', 'karte']){
      for (const lang of ['de', 'en']){
        const SH = {}, errs = [];
        const shost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(){}, resizeTo(){}, resizeEnd(){} };
        const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=' + id, pretendToBeVisual: true,
          beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.evecoreHost = shost; w.addEventListener('error', e => errs.push(e.message)); } }).window;
        await tick(400);
        w.document.documentElement.lang = lang;
        const n = Date.now();
        SH.cmd({ type: 'view', data: { title: id, html: '<div class="ov-card">x</div>', foot: { age: 'Markt neu', next: '', cd: [['Markt', n + 120e3], ['Orders', n - 1], ['Ort', n + 30e3]] }, look: { style: 'eve' } } });
        await tick(60);
        const t = (w.document.querySelector('.ov-empty') || {}).textContent || '';
        assert(!/Fehler beim Zeichnen|Cannot read/.test(t) && !errs.length, id + ' (' + lang + '): kein Fehler beim Zeichnen ' + (errs[0] || ''));
        const foot = (w.document.querySelector('.ov-age') || {}).textContent || '';
        assert(lang === 'de' ? /Markt \d:\d\d/.test(foot) && /Orders neu/.test(foot) : /Market \d:\d\d/.test(foot) && /Orders new/.test(foot) && /Location/.test(foot), id + ' (' + lang + '): Countdown in der Fußzeile (' + foot.trim() + ')');
        w.close();
      }
    }
    console.log('\nALL SAT-FUSSZEILE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
