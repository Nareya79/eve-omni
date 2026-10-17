// 4.0.73 (Meldung Reddit: „almost 50% German“): Englisch-Modus über das KOMPLETTE Programm – ganzer DOM (auch versteckte Bereiche),
// Text + title/placeholder/aria-label, mit Demo-Daten UND ohne (Leerzustände, „Login nötig“), alle Bereiche, Unterreiter, Einstellungs-Reiter,
// Overlays und der Erststart-Assistent. Rot, sobald irgendwo ein eindeutig deutsches Wort steht. Liste der Funde: i18n-voll-offen.json (Arbeitsordner).
// Nicht geprüft: Patchnoten (details.skills-more – nur deutsch, im EN-Modus ausgeblendet, englischer Hinweis auf GitHub-Releases) und Elemente mit lang="de" (z. B. Sprachwahl „Deutsch“).
const { chromium } = require('playwright'), fs = require('fs');
const FILE = 'file:///tmp/eve-zentrale-test14.html';
const DE = /[äöüÄÖÜß]|\b(und|nicht|oder|für|wird|werden|einen?|keine?n?|Stück|mit|auf|ist|sind|bei|noch|nach|wenn|nur|zum|zur|vom|auch|schon|jetzt|hier|deine?[nmrs]?|Einstellungen|Gewinn|Mio|Mrd|Tsd|Std|Fehler|Fenster|Waren?|Preise?|Menge|der|das|dem|den|des|Sprung|Ziel|Laden|geladen|Karte|Aktualisieren)\b/;
// Deutscher Wortschatz aus dem Wörterbuch selbst: Wörter der deutschen Seite minus Wörter, die auch auf der englischen stehen
// (fängt Wörter ohne Umlaut wie „Grundwert“, „Laderaum“, die das Muster oben nicht kennt)
const SRC = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
const enBlock = SRC.slice(SRC.indexOf('var EN = {'), SRC.indexOf('var ATTR = ', SRC.indexOf('var EN = {')));
const wds = s => (s.match(/[A-Za-zÄÖÜäöüß]{4,}/g) || []).map(w => w.toLowerCase());
const deW = new Set(), enW = new Set();
for (const m of enBlock.matchAll(/"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g)){ wds(m[1]).forEach(w => deW.add(w)); wds(m[2]).forEach(w => enW.add(w)); }
const VOC = [...deW].filter(w => !enW.has(w) && !/[äöüß]/.test(w));   // Umlaut-Wörter fängt schon DE
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const found = {}, errs = [];
  const scan = async (p, tag) => {
    await p.waitForTimeout(250);
    const list = await p.evaluate(([re, voc]) => {
      const V = new Set(voc), R0 = new RegExp(re), R = { test: s => R0.test(s) || (s.match(/[A-Za-zÄÖÜäöüß]{4,}/g) || []).some(w => V.has(w.toLowerCase())) };
      const out = [], skip = e => e.closest('details.skills-more:not(.sync-more), [lang="de"], script, style, textarea');
      const w = document.createTreeWalker(document.body, 5); let n;
      while ((n = w.nextNode())){
        if (n.nodeType === 1){ if (skip(n)) continue;
          for (const a of ['title', 'placeholder', 'aria-label']){ const v = n.getAttribute(a); if (v && R.test(v)) out.push('@' + a + ': ' + v.replace(/\s+/g, ' ').trim()); }
          continue; }
        const e = n.parentElement; if (!e || skip(e)) continue;
        const s = n.textContent.replace(/\s+/g, ' ').trim(); if (s.length > 1 && R.test(s)) out.push(s);
      }
      return out; }, [DE.source, VOC]);
    list.forEach(s => { s = s.slice(0, 400); if (!found[s]) found[s] = tag; });
  };
  for (const demo of [true, false]){
    const tag0 = demo ? 'demo' : 'leer';
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
    await ctx.route(/^https?:\/\//, r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem('eve-zentrale-lang-v1', 'en'); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE + (demo ? '?demo=1' : '')); await p.waitForTimeout(demo ? 3000 : 1500);
    const click = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
    await scan(p, tag0 + ':start');
    for (const id of await p.evaluate(() => [...document.querySelectorAll('[id^="neo-btn-"]')].map(e => e.id))){
      await click('#' + id); await p.waitForTimeout(500); await scan(p, tag0 + ':' + id);
      for (const s of await p.evaluate(() => [...document.querySelectorAll('section.panel.active [id*="-view-"], section.panel.active [id*="-sub-"]')].filter(e => e.id && e.tagName === 'BUTTON').map(e => '#' + e.id))){
        await click(s); await p.waitForTimeout(400); await scan(p, tag0 + ':' + id + s);
      }
    }
    await click('#neo-btn-settings'); await p.waitForTimeout(300);
    for (const s of await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-set]')].map(e => e.getAttribute('data-set')))])){ await click('[data-set="' + s + '"]'); await scan(p, tag0 + ':settings-' + s); }
    // Patchnoten sind nur deutsch: im EN-Modus ausgeblendet, englischer Hinweis sichtbar, Sync-Aufklapper bleibt
    const pn = await p.evaluate(() => { const d = [...document.querySelectorAll('#set-pane-about details.skills-more')]   /* 13.10.: nur die Patchnoten – Login & Co. müssen im EN-Modus sichtbar bleiben */, n = document.querySelector('.pn-en'), sy = document.querySelector('details.sync-more');
      return [d.length, d.filter(x => getComputedStyle(x).display !== 'none').length, n ? getComputedStyle(n).display : 'fehlt', sy ? getComputedStyle(sy).display : 'fehlt']; });
    if (!(pn[0] > 100 && pn[1] === 0 && pn[2] === 'block' && pn[3] !== 'none')) found['patchnoten im EN-Modus: ' + JSON.stringify(pn)] = tag0;
    for (const v of await p.evaluate(() => Object.keys(window.__test.ovViews()))){
      await p.evaluate(v => { const b = document.createElement('div'); b.id = '__ov'; b.style.cssText = 'position:fixed;left:0;top:0;width:420px;height:900px;overflow:auto;z-index:99999'; document.body.appendChild(b); try{ window.__test.ovRenderViewInto(v, b); }catch(e){} }, v);
      await scan(p, tag0 + ':ov-' + v); await p.evaluate(() => { const e = document.getElementById('__ov'); if (e) e.remove(); });
    }
    await ctx.close();
  }
  // Erststart-Assistent (frisch, Sprache schon EN)
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route(/^https?:\/\//, r => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('eve-zentrale-lang-v1', 'en'));
  const p = await ctx.newPage(); await p.goto(FILE); await p.waitForTimeout(1500); await scan(p, 'willkommen');
  // Dialoge (confirm/alert/prompt) gehen am DOM vorbei – evTr übersetzt sie
  const msgs = []; p.on('dialog', d => { msgs.push(d.message()); d.dismiss().catch(() => {}); });
  await p.evaluate(() => { confirm('Playlist „Chill“ löschen? Die Musikdateien selbst bleiben.'); confirm('„Mining“ laden für Aria Demo, Kael Demo?\nAlle EVE-Clients müssen geschlossen sein. Der jetzige Stand wird vorher gesichert.');
    confirm('„auto-2026-10-05“ löschen?'); confirm('Profil „PvP“ gibt es schon – überschreiben?'); alert('Erst einloggen.'); });
  await p.waitForTimeout(300);
  msgs.forEach(m => { if (DE.test(m)) found['dialog: ' + m] = 'dialog'; });
  if (msgs.length !== 5) found['dialog: nur ' + msgs.length + ' von 5 Dialogen gesehen'] = 'dialog';
  const notif = await p.evaluate(() => window.evTr('EVE Omni: Order überboten') + ' | ' + window.evTr('EVE Omni: Order läuft bald ab'));
  if (DE.test(notif)) found['meldung: ' + notif] = 'meldung';
  await ctx.close();
  // Standardsprache: Neuinstallation folgt der Windows-Sprache, wer schon Daten hat, bleibt bei Deutsch
  for (const [loc, pre, want] of [['en-US', false, 'en'], ['de-DE', false, 'de'], ['fr-FR', false, 'en'], ['en-US', true, 'de']]){
    const c = await b.newContext({ locale: loc }); await c.route(/^https?:\/\//, r => r.abort());
    if (pre) await c.addInitScript(() => { if (!sessionStorage.__x){ sessionStorage.__x = 1; localStorage.clear(); localStorage.setItem('eve-zentrale-welcome-v1', 'done'); } });
    else await c.addInitScript(() => { if (!sessionStorage.__x){ sessionStorage.__x = 1; localStorage.clear(); } });
    const q = await c.newPage(); await q.goto(FILE); await q.waitForTimeout(800);
    const got = await q.evaluate(() => [localStorage.getItem('eve-zentrale-lang-v1'), document.documentElement.lang]);
    if (got[0] !== want || got[1] !== want) found['standardsprache: Windows ' + loc + (pre ? ' (bestehender Nutzer)' : '') + ' → ' + got.join('/') + ' statt ' + want] = 'sprache';
    await c.close();
  }
  await b.close();
  const keys = Object.keys(found);
  fs.writeFileSync('i18n-voll-offen.json', JSON.stringify(keys.map(k => ({ t: k, wo: found[k] })), null, 1));
  keys.slice(0, 25).forEach(k => console.log('DE  [' + found[k] + '] ' + k.slice(0, 140)));
  if (errs.length) console.log('Seitenfehler: ' + errs[0]);
  console.log(keys.length ? '\n' + keys.length + ' DEUTSCHE TEXTE – I18N-VOLL TESTS FAILED' : '\nALL I18N-VOLL TESTS PASSED');
  process.exit(keys.length ? 1 : 0);
})();
