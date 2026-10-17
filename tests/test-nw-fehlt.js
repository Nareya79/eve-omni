// 14.10.2026: Vermögensverlauf robust – fehlender/fehlerhafter Charakter lässt den Gesamtwert nicht abstürzen, Warnung nennt ihn
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), DAY = 864e5, day = t => new Date(t).toISOString().slice(0, 10);
const tok = (id, n) => ({ access_token: 'a', refresh_token: 'r', expires_at: NOW + 3600000, character_id: id, character_name: n });
const CHARS = [tok('111', 'Taron Velkar'), tok('222', 'Norren Kaslo'), tok('333', 'Alt Char')];
const hist = { d: {}, n: { 111: 'Taron Velkar', 222: 'Norren Kaslo', 333: 'Alt Char' } };
hist.d[day(NOW - 2 * DAY)] = { 111: [1e9, 0, 0, 0, 0], 222: [9.2e8, 0, 0, 6.91e9, 0], 333: [1e8, 0, 0, 0, 0] };
hist.d[day(NOW - DAY)] = { 111: [1e9, 0, 0, 0, 0], 222: [9.2e8, 0, 0, 6.91e9, 0], 333: [1e8, 0, 0, 0, 0] };
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.localStorage.setItem('eve-zentrale-networth-v1', JSON.stringify(hist));
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test, today = day(NOW);
    T.nwPnlSkip();
    // 1) Norren: Kontostand mit ESI 403 – darf nicht als 0 gespeichert werden, Vortag wird übernommen
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.1e9, sell: 0, escrow: 0 }, { id: '222', name: 'Norren Kaslo', bal: null, err: 'ESI 403' }, { id: '333', name: 'Alt Char', bal: 1e8, sell: 0, escrow: 0 }] });
    T.nwSetNetWorth([]);
    assert(T.nwSnap() === true, 'Stand trotz Fehler gespeichert');
    let s = T.nwLoad();
    assert(JSON.stringify(s.d[today]['222']) === JSON.stringify([9.2e8, 0, 0, 6.91e9, 0]), 'Fehler-Charakter: Werte vom Vortag übernommen, nicht 0');
    assert(s.miss[today]['222'].e === 'ESI 403' && s.miss[today]['222'].f === day(NOW - DAY), 'Übernahme gemerkt (Grund + Tag)');
    let ww = T.nwWarn();
    assert(/^⚠ ESI 403 – Wert vom \d\d\.\d\d\.\d{4} übernommen \(7,83 Mrd\. ISK\)$/.test(ww.miss['222']), 'Warnung je Charakter: ' + ww.miss['222']);
    assert(ww.names.join() === 'Norren Kaslo' && !ww.drop, 'Sammelzeile nennt ihn, kein Absturz');
    // 2) Charakter fehlt ganz (nicht in der Liste), aber eingeloggt → ebenfalls übernommen
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.1e9, sell: 0, escrow: 0 }, { id: '333', name: 'Alt Char', bal: 1e8, sell: 0, escrow: 0 }] });
    T.nwSnap(); s = T.nwLoad(); ww = T.nwWarn();
    assert(s.d[today]['222'][3] === 6.91e9 && /nicht geladen – Wert vom/.test(ww.miss['222']), 'fehlender Charakter: Wert übernommen, Grund „nicht geladen“');
    // 3) Wiederkehr: echter Wert ersetzt den übernommenen, Warnung weg
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.1e9, sell: 0, escrow: 0 }, { id: '222', name: 'Norren Kaslo', bal: 1e9, sell: 0, escrow: 0 }, { id: '333', name: 'Alt Char', bal: 1e8, sell: 0, escrow: 0 }] });
    T.nwSnap(); s = T.nwLoad(); ww = T.nwWarn();
    assert(s.d[today]['222'][0] === 1e9 && !s.miss[today]['222'] && !ww.names.length, 'Wiederkehr: echter Wert, keine Warnung');
    // 4) Gesamtwert-Abruf: Fehler → cash null + Grund, Statuszeile/Tabelle zeigen ihn, Summe nicht 0
    T.nwSetNetWorth([{ id: '111', name: 'Taron Velkar', cash: 1.1e9, assetValue: null }, { id: '222', name: 'Norren Kaslo', cash: null, assetValue: null, err: 'ESI 403' }]);
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1.1e9, sell: 0, escrow: 0 }, { id: '333', name: 'Alt Char', bal: 1e8, sell: 0, escrow: 0 }] });
    T.nwSnap(); s = T.nwLoad();
    assert(s.d[today]['222'][0] === 1e9 && s.miss[today]['222'].e === 'ESI 403' && s.miss[today]['222'].f === today, 'früherer echter Wert von heute bleibt, Grund aus Gesamtwert-Abruf');
    assert(/Wert von heute früher übernommen/.test(T.nwWarn().miss['222']), 'Text „heute früher“');
    T.renderNetWorth([{ id: '111', name: 'Taron Velkar', cash: 1.1e9, assetValue: null }, { id: '222', name: 'Norren Kaslo', cash: null, assetValue: null, err: 'ESI 403' }]);
    const tb = d.getElementById('wv-networth-body').textContent;
    assert(/⚠ ESI 403/.test(tb) && /⚠ Ohne aktuellen Wert: Norren Kaslo/.test(tb) && !/NaN/.test(tb), 'Wallet-Reiter: ⚠ in der Zeile + Sammelzeile, kein NaN');
    // 5) Abgemeldet → fällt raus; Absturz > 10 % nennt die größte Änderung
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([CHARS[0], CHARS[2]]));
    const h2 = T.nwLoad(); delete h2.d[today]; delete h2.miss; w.localStorage.setItem('eve-zentrale-networth-v1', JSON.stringify(h2));
    T.nwSetNetWorth([]);
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1e9, sell: 0, escrow: 0 }, { id: '333', name: 'Alt Char', bal: 1e8, sell: 0, escrow: 0 }] });
    T.nwSnap(); s = T.nwLoad(); ww = T.nwWarn();
    assert(!s.d[today]['222'] && !ww.names.length, 'abgemeldeter Charakter wird nicht übernommen');
    assert(/^⚠ Gesamtwert −8\d,\d % zum Vortag – größte Änderungen: Norren Kaslo −7,83 Mrd\. ISK \(fehlt\)$/.test(ww.drop), 'Absturz-Warnung: ' + ww.drop);
    // 6) älter als 7 Tage → nicht mitgezählt
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    const h3 = { d: {}, n: hist.n }; h3.d[day(NOW - 9 * DAY)] = { 111: [1e9, 0, 0, 0, 0], 222: [5e8, 0, 0, 0, 0] };
    w.localStorage.setItem('eve-zentrale-networth-v1', JSON.stringify(h3));
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1e9, sell: 0, escrow: 0 }, { id: '222', name: 'Norren Kaslo', bal: null, err: 'ESI 403' }] });
    T.nwSnap(); s = T.nwLoad(); ww = T.nwWarn();
    assert(!s.d[today]['222'] && ww.miss['222'] === '⚠ ESI 403 – seit 9 Tagen ohne Daten, nicht mitgezählt', '> 7 Tage: ' + ww.miss['222']);
    assert(ww.miss['333'] === '⚠ nicht geladen – noch keine Daten, nicht mitgezählt', 'nie geladen: ' + ww.miss['333']);
    // 7) Overlay-Wallet: ⚠ in der Karte
    T.owWalletSet({ t: NOW, list: [{ id: '111', name: 'Taron Velkar', bal: 1e9, sell: 0, escrow: 0, d24: null }, { id: '222', name: 'Norren Kaslo', bal: null, err: 'ESI 403', sell: null, escrow: null, d24: null }] });
    const box = d.createElement('div'); d.body.appendChild(box); T.ovRenderWallet ? T.ovRenderWallet(box) : null;
    if (T.ovRenderWallet) assert(/⚠ ESI 403 – seit 9 Tagen/.test(box.textContent) && /Ohne aktuellen Wert/.test(box.textContent), 'Overlay: ⚠ in der Karte und oben');
    console.log('\nALL NW-FEHLT TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); console.log('FAILED'); process.exit(1); }
})();
