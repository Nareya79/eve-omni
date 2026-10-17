// 14.10.2026 DC2: Discord-Meldungen im Alert – Seite: Meldung je Anstieg (vom Programm), Einstellung aus = nichts, Ton, Klick-Aktion „discord“, DE/EN.
// Programmteil (Titel-Zähler, Ausblenden statt Schließen, Durchsichtigkeit, Rückfall) live geprüft mit Testinstanz (EVECORE_DISCORD_URL = nachgebaute Seite).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function open(lang){
  const sent = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.localStorage.setItem('eve-zentrale-lang-v1', lang); w.fetch = () => Promise.reject(new Error('offline'));
      let cb = null; w.evecoreHost = { isHost: true, notify: (t, b, a) => sent.push([t, b, a]), getSettings: () => Promise.resolve({ windows: {}, hotkeys: {} }), setSettings: () => Promise.resolve({}), onCommand: f => { cb = f; }, toggleDiscord: () => {} };
      w.__cmd = c => cb && cb(c); } }).window;
  return { w, sent };
}
(async () => {
  try{
    let { w, sent } = open('de'); await tick(800);
    const d = w.document, $ = id => d.getElementById(id);
    assert($('dca-on') && $('dca-on').checked && $('dca-notify').checked && $('dca-sound').checked && $('dca-tone').options.length > 3, 'Einstellung vorhanden, Standard an (Meldung + Ton)');
    assert(/Rechtsklick auf Kanal oder Server › Benachrichtigungseinstellungen/.test($('dc-alarm-box').textContent), 'Hilfetext erklärt die Kanalwahl in Discord');
    w.__cmd({ type: 'discordUnread', n: 3 }); await tick(30);
    assert(sent.length === 1 && sent[0][0] === 'EVE Omni: Discord' && sent[0][1] === 'Discord: 3 ungelesen – Klick: Discord öffnen' && sent[0][2] === 'discord', 'Meldung „Discord: 3 ungelesen“ mit Klick-Aktion');
    w.__cmd({ type: 'discordUnread', n: 4 }); await tick(30);
    assert(sent.length === 2, 'jeder Anstieg (vom Programm gemeldet) = eine Meldung');
    $('dca-on').checked = false; $('dca-on').onchange(); w.__cmd({ type: 'discordUnread', n: 5 }); await tick(30);
    assert(sent.length === 2, 'Einstellung aus → nichts');
    $('dca-test').click(); await tick(30);
    assert(sent.length === 3, '„Meldung testen“ geht auch bei ausgeschaltetem Alarm');
    $('dca-on').checked = true; $('dca-on').onchange(); $('dca-notify').checked = false; $('dca-notify').onchange();
    w.__cmd({ type: 'discordUnread', n: 6 }); await tick(30);
    assert(sent.length === 3, 'Windows-Meldung aus → keine Meldung (nur Ton)');
    w.close();
    ({ w, sent } = open('en')); await tick(800);
    w.__cmd({ type: 'discordUnread', n: 2 }); await tick(30);
    assert(sent.length === 1 && sent[0][1] === 'Discord: 2 unread – click: open Discord', 'EN: ' + (sent[0] || [])[1]);
    assert(/Discord messages in the alert/.test(w.document.getElementById('dc-alarm-h').textContent), 'EN: Überschrift übersetzt');
    console.log('\nALL DC-ALERT TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
})();
