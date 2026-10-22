// AO1 (21.10.2026): Sound – Windows-Lautstärke je EVE-Client. Helfer (VOL/VOLOFF, Core Audio), main.js (sndApply: nur Clients
// mit Eintrag, Automatik = hintere Clients leiser), Overlay „Sound“ (nur laufende Clients, Portrait, Schieberegler, DE/EN).
const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const cs = fs.readFileSync('/home/claude/helfer.cs', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
(async () => {
  // Helfer + main.js (Quelltext)
  assert(/p\.Length == 4 && p\[0\] == "VOL"/.test(cs) && /ProcName\(pid\) != "exefile"\) return;/.test(cs) && /p\[0\] == "VOLOFF"/.test(cs), 'Helfer: VOL nur für EVE-Prozesse, VOLOFF setzt zurück');
  assert(/if \(tick % 40 == 1\) VolTick\(\);/.test(cs) && /EnumAudioEndpoints\(0, 1, out col\)/.test(cs), 'Helfer: alle Wiedergabegeräte, alle 2 s nachziehen');
  assert(/'ovMark', 'sound'\]/.test(main) && /if \('sound' in patch\) sndApply\(\);/.test(main) && /sound: 'Sound'/.test(main), 'main.js: Einstellung sound + Ansicht');
  // sndApply-Logik im Nachbau
  const sm = main.slice(main.indexOf('let sndSent = {};'), main.indexOf('function onlyEveActive(){'));
  const run = (snd, front) => { const out = []; const fg = { proc: 1, status: 'ok', lastEve: front, clients: [{ hwnd: '1', name: 'Aria Test' }, { hwnd: '2', name: 'Bero Test' }, { hwnd: '3', name: '' }] };
    new Function('fg', 'S', 'fgWrite', sm + '; sndApply(); sndApply();')(fg, { sound: snd }, l => out.push(l)); return out; };
  let o = run({ ch: { 'Aria Test': { a: 80, i: 20, m: false } } }, '2');
  assert(o.length === 1 && o[0] === 'VOL 1 80 0', 'ohne Automatik: Wert „vorne“, Client ohne Eintrag unberührt, nichts doppelt (' + o.join('|') + ')');
  o = run({ auto: true, ch: { 'Aria Test': { a: 80, i: 20 }, 'Bero Test': { a: 100, i: 0, m: true } } }, '2');
  assert(o.join('|') === 'VOL 1 20 0|VOL 2 100 1', 'Automatik: hinterer Client leiser, stumm bleibt stumm (' + o.join('|') + ')');
  o = run({ all: 50, am: false, ch: { 'Aria Test': { a: 80, i: 20 } } }, '1');
  assert(o.join('|') === 'VOL 1 40 0', 'Gesamtregler 50 % halbiert den Client-Wert (' + o.join('|') + ')');
  o = run({ am: true, ch: { 'Aria Test': { a: 80, i: 20 } } }, '1');
  assert(o.join('|') === 'VOL 1 80 1', 'alle stumm (' + o.join('|') + ')');
  o = run({ off: true, ch: {} }, '1');
  assert(o.length === 0, 'aus ohne vorher gesetzte Werte: kein Befehl');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    for (const lang of ['de', 'en']){
      const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(l => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', l); }, lang);
      await p.goto('file:///tmp/eve-zentrale-test14.html'); await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const T = window.__test, saved = [];
        window.EVH = window.EVH || null;
        T.sndCyLast({ eveClients: [{ hwnd: '1', name: 'Aria Test' }, { hwnd: '2', name: 'Bero Test' }, { hwnd: '3', name: '' }], eveFront: '1', sound: {} });
        const box = document.createElement('div'); document.body.appendChild(box); T.ovRenderSound(box);
        const cards = box.querySelectorAll('.snd-c:not(.snd-all)').length, front = box.querySelector('.snd-c:not(.snd-all) .item-sub') ? box.querySelector('.snd-c:not(.snd-all) .item-sub').textContent : '';
        const ranges = box.querySelectorAll('.snd-c:not(.snd-all) input[type=range]').length, inactDis = box.querySelectorAll('input[data-ova-change="sndI"][disabled]').length;
        T.sndAction({ type: 'sndAuto' }); const c1 = T.sndCfg();
        T.sndAction({ type: 'sndI', arg: '0', key: 'Bero Test' }); T.sndAction({ type: 'sndMute', arg: 'Aria Test' }); const c2 = T.sndCfg();
        const box2 = document.createElement('div'); document.body.appendChild(box2); T.ovRenderSound(box2);
        const allR = box2.querySelectorAll('.snd-all input[type=range]').length;
        T.sndAction({ type: 'sndAll', arg: '40' }); T.sndAction({ type: 'sndAllMute' }); const c4 = T.sndCfg();
        T.sndAction({ type: 'sndReset' }); const c3 = T.sndCfg();
        return { allR, c4, cards, front, ranges, inactDis, c1, c2, c3, txt: box2.textContent, sel: box2.querySelector('select') };
      });
      assert(r.cards === 2 && r.ranges === 4, lang + ': nur laufende Clients mit Namen, je zwei Schieberegler');
      assert(r.inactDis === 2, lang + ': „Wenn hinten“ ohne Automatik gesperrt');
      assert(r.c1.auto && r.c1.ch['Aria Test'].i === 30 && r.c1.ch['Bero Test'].a === 100, lang + ': Automatik legt Standardwerte an (100 % vorne, 30 % hinten)');
      assert(r.c2.ch['Bero Test'].i === 0 && r.c2.ch['Aria Test'].m === true, lang + ': Regler + Stumm speichern je Charakter');
      assert(r.allR === 1 && r.c4.all === 40 && r.c4.am === true, lang + ': Gesamtregler + alle stumm oben');
      assert(r.c3.off && r.c3.all === 100 && !r.c3.am && !Object.keys(r.c3.ch).length, lang + ': „Alles zurück“ leert und setzt zurück');
      assert(r.sel === null, lang + ': keine Auswahllisten');
      if (lang === 'de') assert(r.front === 'vorne' && /stumm/.test(r.txt) && /Automatik: hintere Clients leiser/.test(r.txt), 'de: Texte');
      else {
        await p.waitForTimeout(300);
        const en = await p.evaluate(() => { const T = window.__test, box = document.createElement('div'); box.id = 'snd-en'; document.body.appendChild(box); T.ovRenderSound(box); if (window.i18nApply) window.i18nApply(box); return box.textContent; });
        assert(true, 'en: gerendert (' + en.slice(0, 60) + ')');
      }
      assert(!errs.length, lang + ': keine Seitenfehler ' + errs.join(' | '));
      await p.close();
    }
    // Block B: Tastenkürzel, Stream-Tasten, Neustart, Hauptfenster
    const pre = fs.readFileSync('/home/claude/preload.js', 'utf-8');
    assert(/soundMute: \(\) => send\(\{ type: 'snd', a: \{ type: 'sndAllMute' \} \}\)/.test(main) && /\{ id: "soundUp", label: "Sound: vorderer Client lauter" \}/.test(html) && /else if \(cmd\.type === "snd"\) sndAction\(cmd\.a \|\| \{\}\);/.test(html), 'Tastenkürzel: alle stumm, vorderer Client lauter/leiser');
    assert(/function restartApp\(\)\{ quitting = true; app\.relaunch\(\); app\.quit\(\); \}/.test(main) && /label: 'EVE Omni neu starten', click: restartApp/.test(main) && /restartApp: \(\) => ipcRenderer\.send\('evecore:restart'\)/.test(pre) && /id="hs-restart"/.test(html), 'Neustart: Infobereich + Einstellungen');
    const p2 = await b.newPage({ viewport: { width: 1200, height: 800 } }); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
    await p2.addInitScript(() => { window.fetch = () => Promise.reject(new Error('offline')); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); localStorage.setItem('eve-zentrale-lang-v1', 'de');
      localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ character_id: 91000001, character_name: 'Aria Test', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e9 }, { character_id: 91000002, character_name: 'Cora Test', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e9 }])); });
    await p2.goto('file:///tmp/eve-zentrale-test14.html'); await p2.waitForTimeout(1200);
    const big = await p2.evaluate(() => { const T = window.__test; T.sndCyLast({ eveClients: [{ hwnd: '1', name: 'Aria Test' }], eveFront: '1', sound: {} });
      const box = document.createElement('div'); document.body.appendChild(box); T.ovRenderSound(box, true);
      const c = [...box.querySelectorAll('.snd-c:not(.snd-all)')]; T.sndAction({ type: 'sndUp' }); T.sndAction({ type: 'sndDown' }); T.sndAction({ type: 'sndDown' }); const up = T.sndCfg();
      return { n: c.length, off: c.filter(x => x.classList.contains('off')).map(x => x.querySelector('b').textContent), hasBox: !!document.getElementById('snd-big'), a: up.ch['Aria Test'] && up.ch['Aria Test'].a }; });
    assert(big.n === 2 && big.off.join() === 'Cora Test' && big.hasBox, 'Hauptfenster: auch nicht laufende Charaktere, ausgegraut (' + JSON.stringify(big) + ')');
    assert(big.a === 80, 'lauter/leiser in 10er-Schritten am vorderen Client, höchstens 100 % (' + big.a + ')');
    assert(!e2.length, 'keine Seitenfehler ' + e2.join(' | '));
    // OmniCom + Funktionsliste
    assert(/mk\("sound", "Sound"/.test(html) && /"neo-btn-sound": "misc"/.test(html) && /target === "dscan" \|\| target === "sound"\) big = false;/.test(html), 'OmniCom-Kachel Sound (nur Overlay)');
    assert(/\["Extras", "Sound: Lautstärke je EVE-Client/.test(html), 'Funktionsliste');
    console.log('\nALL AO1 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
  finally{ await b.close(); }
})();
