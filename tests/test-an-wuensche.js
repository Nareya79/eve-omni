// AN (20.10.2026): Preisverlauf nur im Hauptfenster (AN1), Discord/Browser-Leiste in der Designfarbe (AN2),
// Mirabox-Plugin nicht mehr aus Testinstanzen/ohne Stream-Tasten umschreiben (AN3), EVE starten/beenden im OmniCom-Overlay (AN4).
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const br = fs.readFileSync('/home/claude/browser.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    // AN2 + AN3 (Quelltext)
    assert(/look: S\.popLook \|\| null, act: extAct === 'discord'/.test(main) && /look: S\.popLook \|\| null, actv:/.test(main) && /if \('popLook' in patch \|\| 'ovMark' in patch\)\{ browserPush\(\); dcBarPush\(\);/.test(main), 'AN2: Designfarben gehen an Discord- und Browser-Leiste, auch bei Änderung');
    assert(/lookApply\(s && s\.look\)/.test(br) && /background:var\(--lk-bg,#0b0f14\)/.test(br), 'AN2: Browser-Leiste nutzt die Designfarben');
    assert(/function deckLangSync\(\)\{ if \(TEST \|\| !\(S\.deck && S\.deck\.on\)\) return;/.test(main), 'AN3: Plugin wird nur mit eingeschalteten Stream-Tasten und nie aus Testinstanzen umgeschrieben');
    // Nachtrag Nutzer 20.10.: Discord/Browser aktiv wie Overlays, EVE-Rahmen + EVE-Symbole
    const dch = fs.readFileSync('/home/claude/discord.html', 'utf-8');
    assert(/function extActSet\(k\)/.test(main) && /extActSet\(''\);\n\}/.test(main) && /wc\.on\('focus', \(\) => extActSet\('discord'\)\)/.test(main) && /wc\.on\('focus', \(\) => extActSet\('browser'\)\)/.test(main), 'Aktiv: Klick in Discord/Browser macht sie aktiv, Overlay-Klick nimmt es zurück');
    assert(/actv: extAct === 'browser'/.test(main) && /var ACT = s && s\.actv;/.test(br), 'Aktiv: eigenes Feld actv (act = aktiver Tab im Browser)');
    assert(/img-src data:/.test(dch) && /<button id="close" class="eic"/.test(dch) && /<button id="close" class="eic"/.test(br) && /html\.eve body::before\{left:0;top:0;bottom:0;width:1px\}/.test(dch) && /html\.eve body::after\{right:0;top:0;bottom:0;width:1px\}/.test(br) && !/inset:0/.test(dch + br) && !/100vh/.test(dch + br) && !/100vh/.test(dch) && !/100vh/.test(br), 'EVE-Stil: Rahmen + Symbole (Masken brauchen img-src data:)');
    assert(/S\.popLook && S\.popLook\.eve \? 1 : 0/.test(main), 'EVE-Stil: Seite 1 px eingerückt, damit der Rahmen sichtbar ist');
    // AN4
    const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); if (!localStorage.getItem('eve-zentrale-lang-v1')) localStorage.setItem('eve-zentrale-lang-v1', 'de'); });
    await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1000);
    const r = await p.evaluate(() => { const T = window.__test, calls = [];
      window.__evh = { launchEve: () => calls.push('start'), quitEve: () => calls.push('quit') };
      const c = document.getElementById('neo-evebtn'), def = c.checked && T.ovLoad().neoEve !== false; c.checked = false; c.onchange();
      const off = T.neoOverlayHtml ? T.neoOverlayHtml() : null; c.checked = true; c.onchange();
      const on = T.neoOverlayHtml ? T.neoOverlayHtml() : null;
      return { def, hasBox: !!c, saved: !!T.ovLoad().neoEve, off: off && /data-neo="eveStart"/.test(off), on: on && /class="neo-evek"><button[^>]*data-neo="eveStart"[^>]*><\/button><button[^>]*data-neo="eveQuit"/.test(on) }; });
    assert(r.def, 'AN4: Knöpfe ab Werk eingeschaltet');
    assert(r.hasBox && r.saved, 'AN4: Haken in den Einstellungen speichert neoEve');
    if (r.on !== null){ assert(r.off === false && r.on === true, 'AN4: Knöpfe nur mit Haken im OmniCom-Kopf'); }
    assert(/if \(\/\^eve\(Start\|Quit\)\$\/\.test\(target\)\)\{ if \(!\(window\.EVE_DEMO && window\.EVE_DEMO\.on\) && EVH\)/.test(html) && /\[data-neo="eveStart"\],\[data-neo="eveQuit"\]/.test(html), 'AN4: Aktion ruft launchEve/quitEve, in der Demo gesperrt');
    assert(/\.neo-hd \.neo-evek button\{width:11px;height:11px;padding:0;border-radius:50%/.test(html), 'AN4: kleine runde Knöpfe (11 px, kleiner als die 18-px-Symbole im Balken)');
    const dp = await p.evaluate(() => { const e = document.getElementById('hl-depth'); e.value = 3000; e.dispatchEvent(new Event('change')); const v = e.value; e.value = 300; return v + '|' + document.querySelector('label[for=is-depth]').textContent; });
    assert(dp === '2000|Waren prüfen (Anzahl, max. 2000)', 'Waren prüfen: Hinweis max. 2000, Eingabe darüber wird sichtbar auf 2000 gesetzt (' + dp + ')');
    // AN1
    assert(/#ov-root :is\(\.hc-btn, \.hc-box\)\{display:none !important\}/.test(html) && /m\.lastChild\.appendChild\(mkBtn\(x\.tid\)\);/.test(html), 'AN1: Preisverlauf im Overlay aus, im Hauptfenster auch bei Läufen');
    // EN
    await p.evaluate(() => localStorage.setItem('eve-zentrale-lang-v1', 'en')); await p.reload(); await p.waitForTimeout(1200);
    const en = await p.evaluate(() => document.getElementById('neo-evebtn').parentNode.textContent.trim());
    assert(/^Start\/quit EVE at the top of the OmniCom overlay/.test(en), 'EN: ' + en);
    assert(!errs.length, 'keine Seitenfehler ' + errs.join(' | '));
    console.log('\nALL AN TESTS PASSED');
  }catch(e){ console.error(e); process.exitCode = 1; }
  finally{ await b.close(); }
})();
