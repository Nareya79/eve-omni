// Verifies the rebuilt Contracts (Verträge) tab: personal contracts split into "Laufend" (ct-active-*)
// vs "Abgeschlossen" (ct-history-*), corporation contracts merged in and de-duplicated (fetched once per
// corp even when multiple logged-in characters share it), a corp whose contract list ESI call fails
// (missing scope/role) only produces a warning and does not abort the rest of the load, and the
// per-row "Details" button lazily fetches and renders contract items (included vs requested), except
// for loan contracts which have no items and get no button at all. Also verifies the fix for a real bug:
// a personal-contracts fetch failure used to only flash a transient status message that got overwritten
// by the "Löse Corporations auf …" step right after, so a user whose personal contracts silently failed
// to load would see nothing but corp contracts with no explanation. The final status text must now
// persistently mention which character's personal contracts failed and why.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');

const CHAR_INFO = {
  111: { corporation_id: 5001 }, // Alice
  222: { corporation_id: 5001 }, // Bob - same corp as Alice, must not cause a second corp-contracts fetch
  333: { corporation_id: 5002 }, // Carol - alone in her corp, whose contract list will fail (403)
  444: { corporation_id: 5001 }, // Dave - same corp as Alice/Bob (corp fetch succeeds), but HIS personal
                                 // contracts fetch fails (simulates a stale login missing the character-
                                 // contracts scope) - isolates the personal-fetch-failure path from the
                                 // corp-fetch-failure path tested via Carol.
};
const CORP_INFO = { 5001: { name: 'Star Traders' }, 5002: { name: 'Lone Wolves' } };
const STATIONS = {
  60003760: { name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' },
  60008494: { name: 'Amarr VIII (Oris) - Emperor Family Academy' },
};
const TYPES = { 34: 'Tritanium', 35: 'Pyerite', 40520: 'Large Skill Injector' };

const PERSONAL_CONTRACTS = {
  111: [
    { contract_id: 9001, type: 'item_exchange', status: 'outstanding', title: 'Mineral-Paket', price: 5000000,
      start_location_id: 60003760, end_location_id: 60008494, date_issued: '2026-09-20T10:00:00Z', date_expired: '2026-09-27T10:00:00Z' },
    { contract_id: 9002, type: 'courier', status: 'finished_issuer', title: 'Kurierjob', reward: 2000000, price: 0,
      start_location_id: 60003760, end_location_id: 60008494, date_issued: '2026-09-10T10:00:00Z', date_expired: '2026-09-17T10:00:00Z' },
  ],
  222: [
    { contract_id: 9003, type: 'loan', status: 'outstanding', title: 'Darlehen', price: 10000000,
      start_location_id: 60003760, end_location_id: 60003760, date_issued: '2026-09-21T10:00:00Z', date_expired: '2026-09-28T10:00:00Z' },
  ],
  333: [
    { contract_id: 9004, type: 'item_exchange', status: 'finished', title: 'Alter Handel', price: 1000000,
      start_location_id: 60008494, end_location_id: 60008494, date_issued: '2026-08-01T10:00:00Z', date_expired: '2026-08-08T10:00:00Z' },
  ],
};
const CORP_CONTRACTS = {
  5001: [
    { contract_id: 8001, type: 'item_exchange', status: 'outstanding', title: 'Corp-Angebot', price: 30000000,
      start_location_id: 60003760, end_location_id: 60003760, date_issued: '2026-09-19T10:00:00Z', date_expired: '2026-09-26T10:00:00Z' },
  ],
  // 5002 absent on purpose - the mock rejects that corp's contract list (simulates missing role/scope)
};
const ITEMS = {
  'char:111:9001': [
    { type_id: 34, quantity: 100, is_included: true, is_singleton: false, record_id: 1 },
    { type_id: 35, quantity: 50, is_included: false, is_singleton: false, record_id: 2 },
  ],
  'corp:5001:8001': [
    { type_id: 40520, quantity: 1, is_included: true, is_singleton: true, record_id: 1 },
  ],
};

const CHARS = [
  { access_token: 'tokA', refresh_token: 'rA', expires_at: Date.now() + 3600000, character_id: '111', character_name: 'Alice' },
  { access_token: 'tokB', refresh_token: 'rB', expires_at: Date.now() + 3600000, character_id: '222', character_name: 'Bob' },
  { access_token: 'tokC', refresh_token: 'rC', expires_at: Date.now() + 3600000, character_id: '333', character_name: 'Carol' },
  { access_token: 'tokD', refresh_token: 'rD', expires_at: Date.now() + 3600000, character_id: '444', character_name: 'Dave' },
];

let corpContractsCallCount5001 = 0;
let corpContractsCallCount5002 = 0;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://claude.ai/artifact/test',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    window.localStorage.setItem('eve-zentrale-active-char', '111');
    window.fetch = function (url, opts) {
      const u = String(url);
      const auth = opts && opts.headers && opts.headers.Authorization;

      // --- Vertragsinhalte (Items) - vor den allgemeineren Contracts-Listen-Mustern prüfen ---
      let m = u.match(/\/characters\/(\d+)\/contracts\/(\d+)\/items\//);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 401 });
        const items = ITEMS['char:' + m[1] + ':' + m[2]] || [];
        return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(items) });
      }
      m = u.match(/\/corporations\/(\d+)\/contracts\/(\d+)\/items\//);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 401 });
        const items = ITEMS['corp:' + m[1] + ':' + m[2]] || [];
        return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(items) });
      }

      // --- Persönliche Vertragsliste --- (Dave/444: simuliert einen fehlgeschlagenen Abruf, z.B. Scope fehlt)
      m = u.match(/\/characters\/(\d+)\/contracts\/(?:\?|$)/);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 401 });
        if (m[1] === '444') return Promise.resolve({ ok: false, status: 403 });
        return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(PERSONAL_CONTRACTS[m[1]] || []) });
      }

      // --- Corp-Vertragsliste ---
      m = u.match(/\/corporations\/(\d+)\/contracts\/(?:\?|$)/);
      if (m) {
        if (!auth) return Promise.resolve({ ok: false, status: 401 });
        const corpId = m[1];
        if (corpId === '5001') corpContractsCallCount5001++;
        if (corpId === '5002') corpContractsCallCount5002++;
        if (!CORP_CONTRACTS[corpId]) return Promise.resolve({ ok: false, status: 403 });
        return Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(CORP_CONTRACTS[corpId]) });
      }

      // --- Öffentliche Charakter-/Corp-Stammdaten (kein Auth nötig) ---
      m = u.match(/\/characters\/(\d+)\/\?/);
      if (m) {
        const info = CHAR_INFO[m[1]];
        return info ? Promise.resolve({ ok: true, json: () => Promise.resolve(info) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/corporations\/(\d+)\/\?/);
      if (m) {
        const info = CORP_INFO[m[1]];
        return info ? Promise.resolve({ ok: true, json: () => Promise.resolve(info) }) : Promise.resolve({ ok: false, status: 404 });
      }

      m = u.match(/\/universe\/stations\/(\d+)\//);
      if (m) {
        const st = STATIONS[m[1]];
        return st ? Promise.resolve({ ok: true, json: () => Promise.resolve(st) }) : Promise.resolve({ ok: false, status: 404 });
      }
      m = u.match(/\/universe\/types\/(\d+)\//);
      if (m) {
        const name = TYPES[m[1]];
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: name || ('#' + m[1]) }) });
      }

      return Promise.reject(new Error('unexpected fetch: ' + u));
    };
  }
});
const { window } = dom;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

setTimeout(async () => {
  try {
    const doc = window.document;

    // Alle drei Charaktere ankreuzen (per Default schon angehakt, aber zur Sicherheit sicherstellen)
    doc.querySelectorAll('#sso-charlist input[type=checkbox]').forEach(cb => { cb.checked = true; });

    await doc.getElementById('ct-refresh').onclick();

    const status = doc.getElementById('ct-status').textContent;
    assert(status.indexOf('laufend') !== -1, 'Status-Text erwähnt die laufend/abgeschlossen-Aufteilung (' + status + ')');
    assert(status.indexOf('persönlich') !== -1, 'Status-Text zeigt die Aufschlüsselung persönlich vs. Corp, nicht nur eine Gesamtzahl (' + status + ')');
    // Der eigentliche Bugfix: Daves fehlgeschlagener persönlicher Abruf darf NICHT von der
    // "Löse Corporations auf …"-Statusmeldung verschluckt werden, sondern muss im finalen Status stehen.
    assert(status.indexOf('persönliche Verträge fehlgeschlagen bei') !== -1 && status.indexOf('Dave') !== -1,
      'finaler Status nennt persistent, dass Daves persönliche Verträge fehlgeschlagen sind (' + status + ')');

    // --- De-Duplizierung: Alice & Bob teilen sich Corp 5001, dennoch nur EIN ESI-Call für deren Verträge ---
    assert(corpContractsCallCount5001 === 1, 'Corp-5001-Vertragsliste wird trotz zweier Mitglieder (Alice, Bob) nur einmal abgefragt (got ' + corpContractsCallCount5001 + ')');
    assert(corpContractsCallCount5002 === 1, 'Carols Corp (5002) wird genau einmal versucht, schlägt aber fehl (got ' + corpContractsCallCount5002 + ')');

    // --- Laufend: Alice/9001 (outstanding) + Corp 8001 (outstanding, unter Alice's Token geladen) in Alices
    // Gruppe, Bob/9003 (loan, outstanding) in Bobs eigener Gruppe ---
    const activeGroupHeaders = Array.from(doc.querySelectorAll('#ct-active-body tr.ct-group-header'));
    const activeRows = Array.from(doc.querySelectorAll('#ct-active-body tr:not(.ct-detail-row):not(.ct-group-header)'));
    assert(activeRows.length === 3, 'genau 3 laufende Verträge (Alice/9001, Bob/9003 Darlehen, Corp 8001) (got ' + activeRows.length + ')');
    assert(activeRows.some(r => r.textContent.indexOf('Mineral-Paket') !== -1), 'Alice\'s laufender persönlicher Vertrag ist gelistet');
    assert(activeRows.some(r => r.textContent.indexOf('Corp-Angebot') !== -1 && r.textContent.indexOf('Star Traders') !== -1),
      'der laufende Corp-Vertrag ist gelistet und zeigt den Corp-Namen in der Quelle-Spalte');
    assert(activeRows.some(r => r.textContent.indexOf('Darlehen') !== -1), 'Bobs laufendes Darlehen ist gelistet');

    // --- Gruppierung pro Charakter: 2 Gruppen (Alice mit 2 Verträgen, Bob mit 1), alphabetisch sortiert,
    // jeweils mit Charakterbildchen (Portrait-URL) in der Abschnittsüberschrift ---
    assert(activeGroupHeaders.length === 2, 'genau 2 Charakter-Gruppen im Laufend-Tab (Alice, Bob) (got ' + activeGroupHeaders.length + ')');
    assert(activeGroupHeaders[0].textContent.indexOf('Alice') !== -1 && activeGroupHeaders[0].textContent.indexOf('2 Verträge') !== -1,
      'erste Gruppe ist Alice mit 2 Verträgen (alphabetisch vor Bob) (' + activeGroupHeaders[0].textContent + ')');
    assert(activeGroupHeaders[1].textContent.indexOf('Bob') !== -1 && activeGroupHeaders[1].textContent.indexOf('1 Vertrag)') !== -1,
      'zweite Gruppe ist Bob mit 1 Vertrag (' + activeGroupHeaders[1].textContent + ')');
    activeGroupHeaders.forEach(h => {
      const img = h.querySelector('img.ct-char-portrait');
      assert(img && /\/characters\/\d+\/portrait/.test(img.src), 'Gruppenüberschrift zeigt ein Charakter-Portrait-Bildchen (' + (img && img.src) + ')');
    });

    // --- Abgeschlossen: Alice/9002 (finished_issuer), Carol/9004 (finished). Carols Corp fehlt -> keine zusätzliche Zeile ---
    const historyGroupHeaders = Array.from(doc.querySelectorAll('#ct-history-body tr.ct-group-header'));
    const historyRows = Array.from(doc.querySelectorAll('#ct-history-body tr:not(.ct-detail-row):not(.ct-group-header)'));
    assert(historyRows.length === 2, 'genau 2 abgeschlossene Verträge (got ' + historyRows.length + ')');
    assert(historyRows.some(r => r.textContent.indexOf('Kurierjob') !== -1), 'Alice\'s abgeschlossener Kurierauftrag ist im Verlauf');
    assert(historyRows.some(r => r.textContent.indexOf('Alter Handel') !== -1), 'Carols abgeschlossener persönlicher Vertrag ist im Verlauf');
    assert(historyGroupHeaders.length === 2, 'genau 2 Charakter-Gruppen im Abgeschlossen-Tab (Alice, Carol) (got ' + historyGroupHeaders.length + ')');
    assert(historyGroupHeaders[0].textContent.indexOf('Alice') !== -1, 'erste Verlauf-Gruppe ist Alice (alphabetisch vor Carol) (' + historyGroupHeaders[0].textContent + ')');
    assert(historyGroupHeaders[1].textContent.indexOf('Carol') !== -1, 'zweite Verlauf-Gruppe ist Carol (' + historyGroupHeaders[1].textContent + ')');

    // --- Laufend/Abgeschlossen-Subtabs schalten um ---
    assert(!doc.getElementById('ct-active-wrap').hidden, 'Laufend-Ansicht standardmäßig sichtbar');
    assert(doc.getElementById('ct-history-wrap').hidden, 'Abgeschlossen-Ansicht standardmäßig versteckt');
    doc.getElementById('ct-view-history').onclick();
    assert(doc.getElementById('ct-active-wrap').hidden, 'Laufend-Ansicht nach Klick versteckt');
    assert(!doc.getElementById('ct-history-wrap').hidden, 'Abgeschlossen-Ansicht nach Klick sichtbar');
    doc.getElementById('ct-view-active').onclick();

    // --- Details: Alice's persönlicher Vertrag (item_exchange) zeigt enthaltene/angeforderte Items ---
    const aliceRow = activeRows.find(r => r.textContent.indexOf('Mineral-Paket') !== -1);
    const aliceDetailBtn = aliceRow.querySelector('button');
    assert(aliceDetailBtn && aliceDetailBtn.textContent === 'Details', 'Alice\'s Vertrag hat einen Details-Button (item_exchange hat Items)');
    await aliceDetailBtn.onclick();
    const aliceDetailRow = aliceRow.nextElementSibling;
    assert(aliceDetailRow.classList.contains('ct-detail-row') && !aliceDetailRow.hidden, 'Detail-Zeile wird nach Klick eingeblendet');
    const aliceDetailText = aliceDetailRow.textContent;
    assert(aliceDetailText.indexOf('Tritanium') !== -1, 'enthaltenes Item (Tritanium) wird angezeigt');
    assert(aliceDetailText.indexOf('Pyerite') !== -1, 'angefordertes Item (Pyerite) wird angezeigt');
    assert(aliceDetailText.indexOf('Enthalten') !== -1 && aliceDetailText.indexOf('Angefordert') !== -1, 'Items sind in Enthalten/Angefordert gruppiert');
    // Erneuter Klick blendet nur aus, ohne neu zu laden
    await aliceDetailBtn.onclick();
    assert(aliceDetailRow.hidden, 'zweiter Klick blendet die Detail-Zeile wieder aus');

    // --- Details: Corp-Vertrag (8001) zeigt sein Item (Large Skill Injector) ---
    const corpRow = activeRows.find(r => r.textContent.indexOf('Corp-Angebot') !== -1);
    const corpDetailBtn = corpRow.querySelector('button');
    await corpDetailBtn.onclick();
    const corpDetailText = corpRow.nextElementSibling.textContent;
    assert(corpDetailText.indexOf('Large Skill Injector') !== -1, 'Corp-Vertragsinhalt (Large Skill Injector) wird geladen und angezeigt');

    // --- Darlehen (Bob/9003) hat KEINEN Details-Button, da Darlehen keine Items haben ---
    const bobRow = activeRows.find(r => r.textContent.indexOf('Darlehen') !== -1);
    assert(!bobRow.querySelector('button'), 'Darlehens-Vertrag bekommt keinen Details-Button');

    console.log('\\nALL CONTRACTS TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}, 400);
