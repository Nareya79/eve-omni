// 14.10.2026: Jukebox-Playlists – Mehrfachauswahl (Kästchen, Alle, Shift-Bereich, Leiste: hinzufügen, entfernen, Favoriten, aufheben, löschen)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
let asked = 0;
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; this.dispatchEvent(new w.Event('pause')); };
    w.HTMLMediaElement.prototype.load = function(){};
    w.confirm = () => { asked++; return true; };
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const store = () => JSON.parse(w.localStorage.getItem('eve-zentrale-jukebox-v1'));
    const ck = row => $('jb-list').rows[row].querySelector('.jb-ck');
    const click = (e, shift) => e.dispatchEvent(new w.MouseEvent('click', { bubbles: true, shiftKey: !!shift }));
    $('neo-btn-music').onclick();
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
    T.jbxSetFiles(names.map((n, i) => ({ name: n + '.mp3', url: 'file:///m/' + i + '.mp3' })), 'C:\\M');
    $('jb-pl-name').value = 'PvP'; $('jb-pl-add').onclick();
    $('jb-list-sel').value = ''; $('jb-list-sel').onchange();
    assert($('jb-selbar').hidden && $('jb-list').rows[0].cells.length === 5, 'Start: Kästchen-Spalte, Leiste versteckt');
    // Einzeln + Shift-Bereich (Liste ist alphabetisch: Alpha, Beta, Delta, Epsilon, Eta, Gamma, Zeta)
    click(ck(0)); click(ck(4), true);
    assert(!$('jb-selbar').hidden && $('jb-sel-n').textContent === '5 ausgewählt' && $('jb-list').rows[2].classList.contains('jb-sel'), 'Klick + Shift-Klick wählt Bereich (5)');
    assert(!T.getJbxIdx || T.getJbxIdx() === -1, 'Kästchen spielt keinen Titel ab');
    assert(/^Zu „PvP“ hinzufügen$/.test($('jb-sel-add').textContent) && !$('jb-sel-add').hidden && $('jb-sel-rm').hidden && $('jb-sel-del').hidden, 'Leiste: Ziel aus „＋ fügt hinzu zu“, Entfernen/Löschen nur in Playlist');
    $('jb-sel-add').click();
    assert(store().lists[0].urls.length === 5 && /^5 Titel zu „PvP“ hinzugefügt\.$/.test($('jb-status').textContent) && $('jb-selbar').hidden, '5 Titel mit einem Klick übernommen, Meldung, Auswahl leer');
    // Suche + „Alle“ nur Treffer; Auswahl bleibt beim Suchen
    click(ck(5));
    T.jbxCommand('q:eta');
    assert($('jb-list').rows.length === 3, 'Suche „eta“: Beta, Eta, Zeta');
    const vis = $('jb-list').rows.length;
    $('jb-sel-all').click();
    T.jbxCommand('q:');
    const sel = [...$('jb-list').rows].filter(r => r.classList.contains('jb-sel')).map(r => r.cells[2].textContent.trim());
    assert(sel.includes('Gamma') && sel.every(x => /eta|Gamma/i.test(x)) && sel.length === vis + 1, '„Alle“ wählt nur die gefilterten Treffer, frühere Auswahl bleibt (' + sel.join(',') + ')');
    $('jb-sel-add').click();
    assert(/waren schon drin/.test($('jb-status').textContent), 'schon enthaltene werden gemeldet: ' + $('jb-status').textContent);
    // Favoriten
    click(ck(0)); click(ck(1));
    $('jb-sel-fav').click();
    assert((store().favs || []).length === 2 && /^2 Titel zu den Favoriten hinzugefügt\.$/.test($('jb-status').textContent), 'Zu Favoriten');
    // Listenwechsel leert die Auswahl; in der Playlist entfernen, laufender Titel bleibt
    click(ck(0));
    $('jb-list-sel').value = 'p0'; $('jb-list-sel').onchange();
    assert($('jb-selbar').hidden, 'Listenwechsel leert die Auswahl');
    const n0 = store().lists[0].urls.length;
    T.jbxPlay(3); const playing = T.jbxTracks()[3].url;
    click(ck(0)); click(ck(1));
    assert(!$('jb-sel-rm').hidden && !$('jb-sel-del').hidden && $('jb-sel-add').hidden, 'in der Playlist: Entfernen + Löschen sichtbar, Hinzufügen zu sich selbst nicht');
    $('jb-sel-rm').click();
    assert(store().lists[0].urls.length === n0 - 2 && /^2 Titel aus „PvP“ entfernt\.$/.test($('jb-status').textContent), 'zwei Titel auf einmal entfernt');
    assert(T.jbxTracks()[T.getJbxIdx()].url === playing, 'laufender Titel bleibt erhalten');
    click(ck(0)); $('jb-sel-none').click();
    assert($('jb-selbar').hidden && !$('jb-list').querySelector('.jb-sel'), 'Auswahl aufheben');
    click(ck(0)); $('jb-sel-del').click();
    assert(asked === 1 && !(store().lists || []).length, 'Playlist löschen mit Rückfrage');
    console.log('\nALL JB-MEHRFACH TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
