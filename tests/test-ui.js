// Darstellung: Farbschema + Groesse im Konto, gespeichert, beim Start sofort angewendet.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function mk(store){ return new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ Object.keys(store||{}).forEach(k => w.localStorage.setItem(k, store[k])); w.fetch = () => Promise.reject(new Error('offline')); } }).window; }
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
setTimeout(() => { try{
  const w = mk(), d = w.document, root = d.documentElement;
  assert(root.getAttribute('data-scheme') === 'caldari' && root.style.getPropertyValue('--ui-scale') === '1', 'Standard: Caldari (seit 17.10.), Groesse 100 %');
  const btns = d.querySelectorAll('#ui-schemes .scheme-btn');
  assert(btns.length === 13, '13 Farbschemen (12 Vorlagen + Eigenes) zur Auswahl');   // UU5: + EVE Omni · Homepage   // UU4: + Lila, Neon-Pink, Neon-Grün, Rot, Weiß
  assert(d.querySelector('#ui-schemes [data-scheme="caldari"]').getAttribute('aria-pressed') === 'true', 'Aktives Schema markiert (Standard Caldari)');
  d.querySelector('#ui-schemes [data-scheme="amarr"]').onclick();
  assert(root.getAttribute('data-scheme') === 'amarr' && JSON.parse(w.localStorage.getItem('eve-zentrale-ui-v1')).scheme === 'amarr', 'Amarr angewendet und gespeichert');
  d.querySelector('#ui-schemes [data-scheme="photon"]').onclick();
  assert(!root.hasAttribute('data-scheme'), 'Zurueck auf Photon entfernt das Attribut');
  const r = d.getElementById('ui-scale'); r.value = '1.2'; r.dispatchEvent(new w.Event('input'));
  assert(root.style.getPropertyValue('--ui-scale') === '1.2' && d.getElementById('ui-scale-val').textContent === '120 %', 'Regler setzt Groesse live (120 %)');
  assert(d.querySelectorAll('.scale-steps [data-scale]').length === 8, 'JJ1: 8 Zoom-Stufen 80-200 %');
  d.querySelector('.scale-steps [data-scale="1.5"]').onclick();
  assert(root.style.getPropertyValue('--ui-scale') === '1.5' && !d.querySelector('.scale-steps [data-scale="1.5"]').classList.contains('ghost'), 'Stufe 150 % aktiv markiert');
  const key = (k, c) => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, code: c || '', ctrlKey: true, bubbles: true, cancelable: true }));
  key('+'); assert(root.style.getPropertyValue('--ui-scale') === '1.75', 'JJ1: Strg + = naechste Stufe (175 %)');
  key('-'); key('-'); assert(root.style.getPropertyValue('--ui-scale') === '1.25', 'JJ1: Strg - zweimal = 125 %');
  key('0'); assert(root.style.getPropertyValue('--ui-scale') === '1', 'JJ1: Strg 0 = 100 %');
  const wh = dy => { const e = new w.WheelEvent('wheel', { deltaY: dy, ctrlKey: true, bubbles: true, cancelable: true }); d.dispatchEvent(e); return e.defaultPrevented; };
  assert(wh(-100) && root.style.getPropertyValue('--ui-scale') === '1.1', 'JJ1: Strg + Mausrad hoch = groesser, Browser-Zoom unterdrueckt');
  wh(100); wh(100); wh(100); wh(100); assert(root.style.getPropertyValue('--ui-scale') === '0.8', 'JJ1: Strg + Mausrad runter, unten bei 80 % Schluss');
  root.classList.add('sat-win'); assert(wh(-100) && root.style.getPropertyValue('--ui-scale') === '0.8', 'JJ1: Overlay-Fenster – Strg + Mausrad zoomt nicht das Hauptfenster'); root.classList.remove('sat-win');
  w.__test.applyUi({ scheme:'kaputt', scale: 9 });
  assert(root.getAttribute('data-scheme') === 'caldari' && root.style.getPropertyValue('--ui-scale') === '2', 'Ungueltige Werte werden begrenzt (max. 200 %), unbekanntes Schema = Caldari');
  const w2 = mk({ 'eve-zentrale-ui-v1': JSON.stringify({ scheme:'light', scale:1.15 }) });
  assert(w2.document.documentElement.getAttribute('data-scheme') === 'light' && w2.document.documentElement.style.getPropertyValue('--ui-scale') === '1.15', 'Beim naechsten Start sofort angewendet');
  assert(w2.document.getElementById('ui-scale-val').textContent === '115 %', 'Regler zeigt gespeicherten Wert');
  // JJ2: Startgroesse nach Bildschirm, solange nie selbst gezoomt
  const mkScr = (h, store) => new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ Object.keys(store||{}).forEach(k => w.localStorage.setItem(k, store[k])); Object.defineProperty(w.screen, 'height', { value: h }); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
  const sc = x => x.document.documentElement.style.getPropertyValue('--ui-scale');
  assert(sc(mkScr(1080)) === '1' && sc(mkScr(1440)) === '1.25' && sc(mkScr(2160)) === '1.5', 'JJ2: 1080 -> 100 %, 1440 (auch 3440/5120 breit) -> 125 %, 4K -> 150 %');
  assert(sc(mkScr(2160, { 'eve-zentrale-ui-v1': JSON.stringify({ scale: 1 }) })) === '1.5', 'JJ2: alter Standardwert 100 % wird automatisch angepasst');
  assert(sc(mkScr(1080, { 'eve-zentrale-ui-v1': JSON.stringify({ scale: 1.5, zoomAuto: true }) })) === '1', 'JJ2: automatischer Wert folgt dem Bildschirm');
  assert(sc(mkScr(2160, { 'eve-zentrale-ui-v1': JSON.stringify({ scale: 1.15 }) })) === '1.15', 'JJ2: früher selbst gewählte Größe bleibt');
  const wz = mkScr(2160); wz.document.dispatchEvent(new wz.KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true, cancelable: true }));
  assert(sc(wz) === '1.25' && sc(mkScr(2160, { 'eve-zentrale-ui-v1': wz.localStorage.getItem('eve-zentrale-ui-v1') })) === '1.25', 'JJ2: nach eigenem Zoom (auch 100 %) keine Automatik mehr');
   // JJ4: Overlay-Fenster nehmen den Zoom des Hauptfensters nicht mehr mit
  assert(/html\.sat-boot\{--ui-scale:1 !important\}/.test(html) && !/uiScale/.test(html), 'JJ4: Overlays nur mit eigener Overlay-Skalierung');
  // JJ3: Seitenbreiten in rem (wachsen mit dem Zoom), Fliesstext mit lesbarer Zeilenlaenge
  assert(/max-width:min\(131rem, 96vw\)/.test(html) && !/#(ap|co|spl|mi|radar|wtx|ow)-page\{max-width:\d+px/.test(html) && /\.app-main p\{max-width:120ch\}/.test(html), 'JJ3: Breiten in rem, Text max. 120 Zeichen breit');
 console.log('\nALL UI SETTINGS TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.stack||e); process.exit(1); } }, 500);
