// EM (11.10.2026): EVE-Mail – Posteingang aller Charaktere, Ordner, Mail lesen (EVE-Markup sicher), neue Mail melden, schreiben/antworten, Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const tick = ms => new Promise(r => setTimeout(r, ms || 100));
const NOW = Date.now(), iso = t => new Date(t).toISOString();
const jwt = (id, name, scp) => 'x.' + Buffer.from(JSON.stringify({ sub: 'CHARACTER:EVE:' + id, name, scp, exp: Math.floor(NOW / 1000) + 3600 })).toString('base64').replace(/=+$/, '') + '.y';
const ALL = ['esi-mail.read_mail.v1', 'esi-mail.send_mail.v1', 'esi-mail.organize_mail.v1'];
const CH = [{ access_token: jwt(111, 'Eins', ALL), refresh_token: 'r', expires_at: NOW + 36e5, character_id: '111', character_name: 'Eins' },
            { access_token: jwt(222, 'Zwei', ['esi-skills.read_skills.v1']), refresh_token: 'r', expires_at: NOW + 36e5, character_id: '222', character_name: 'Zwei' }];
let heads = [{ mail_id: 1, from: 900, subject: 'Hallo', timestamp: iso(NOW - 6e5), labels: [1], recipients: [{ recipient_id: 111, recipient_type: 'character' }], is_read: false },
             { mail_id: 2, from: 901, subject: 'Corp-Treffen', timestamp: iso(NOW - 9e5), labels: [4], recipients: [{ recipient_id: 98000001, recipient_type: 'corporation' }], is_read: true },
             { mail_id: 3, from: 111, subject: 'Re: Hallo', timestamp: iso(NOW - 3e5), labels: [2], recipients: [{ recipient_id: 900, recipient_type: 'character' }], is_read: true }];
const CALLS = [], notes = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH));
    w.evecoreHost = { notify: (t, b) => notes.push(t + ' ' + b) };
    w.confirm = () => true;
    w.fetch = (url, o) => { url = String(url); o = o || {}; const meth = o.method || 'GET'; CALLS.push(meth + ' ' + url.replace(/\?.*/, '') + (o.body ? ' ' + o.body : ''));
      const json = (x, st) => Promise.resolve({ ok: true, status: st || 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
      if (/characters\/111\/mail\/lists\//.test(url)) return json([{ mailing_list_id: 145, name: 'Jita Traders' }]);
      if (/characters\/111\/mail\/(\?|$)/.test(url)) return meth === 'POST' ? json(77, 201) : json(heads);
      if (/characters\/111\/mail\/1\//.test(url) && meth === 'GET') return json({ body: '<font size="12">Hi <b>du</b><br><a href="showinfo:1377//900">Orvan</a> &lt;script&gt; <a href="https://x.y/">Link</a><script>alert(1)</script></font>' });
      if (/characters\/111\/mail\/\d+\//.test(url)) return json(null, 204);
      if (/universe\/names/.test(url)) return json(JSON.parse(o.body).map(id => ({ id, name: { 900: 'Orvan', 901: 'Bela', 111: 'Eins' }[id] || 'N' + id, category: 'character' })));
      if (/universe\/ids/.test(url)) return json({ characters: [{ id: 900, name: 'Orvan' }] });
      return Promise.reject(new Error('offline')); };
  } }).window;
(async () => {
  await tick(400);
  const d = w.document, T = w.__test;
  await T.emFetch(true); await tick(200);
  let st = T.emState();
  assert(st.t && st.heads.length === 3 && !st.busy, 'EM1: Mails geladen (' + st.heads.length + ', ' + st.err + ', busy ' + st.busy + ')');
  assert(!CALLS.some(c => /characters\/222\/mail/.test(c)), 'EM1: Charakter ohne Mail-Berechtigung wird nicht abgefragt');
  assert(T.emUnread().length === 1, 'EM2: eine ungelesene (gesendete und eigene zählen nicht)');
  d.getElementById('neo-btn-mail').click(); await tick(150);
  const rows = d.querySelectorAll('#em-page .em-r');
  assert(rows.length === 1 && /Hallo/.test(rows[0].textContent) && /Orvan/.test(rows[0].textContent) && /Zwei/.test(d.getElementById('em-page').textContent), 'EM1: Ordner Eingang zeigt die eine Mail, Hinweis neu einloggen für Zwei (' + d.getElementById('em-page').textContent.slice(0, 200) + ')');
  assert(/1/.test((d.querySelector('#neo-btn-mail .neo-cnt') || {}).textContent || ''), 'EM2: Zähler am OmniCom-Symbol');
  await T.emAction({ type: 'emTab', arg: 'corp' }); await tick(50);
  assert(/Corp-Treffen/.test(d.getElementById('em-page').textContent) && !/Hallo/.test((d.querySelector('#em-page .em-list') || {}).textContent || 'Hallo'), 'EM1: Ordner Corp');
  await T.emAction({ type: 'emTab', arg: 'in' }); await T.emAction({ type: 'emOpen', arg: '1' }); await tick(150);
  const txt = d.querySelector('#em-page .em-txt');
  assert(txt && !txt.querySelector('script,b,font') && /Hi du/.test(txt.textContent) && txt.querySelector('a[href="https://x.y/"]') && txt.querySelector('.em-si[data-arg="900"]') && /<script>/.test(txt.textContent), 'EM1: Text sicher (nur Links + Umbrüche, kein Skript)');
  assert(CALLS.some(c => /^PUT .*mail\/1\/ .*"read":true/.test(c)), 'EM1: als gelesen markiert');
  heads = [{ mail_id: 4, from: 900, subject: 'Neu!', timestamp: iso(NOW), labels: [1], recipients: [{ recipient_id: 111, recipient_type: 'character' }], is_read: false }].concat(heads);
  await T.emFetch(false); await tick(100);
  assert(notes.length === 1 && /Neu!/.test(notes[0]) && /Orvan/.test(notes[0]), 'EM2: Windows-Meldung bei neuer Mail (' + notes.join('|') + ')');
  await T.emFetch(false); await tick(50);
  assert(notes.length === 1, 'EM2: dieselbe Mail nicht zweimal melden');
  await T.emAction({ type: 'emRe', arg: '1' }); await tick(50);
  st = T.emState();
  assert(st.nw && st.nw.to === 'Orvan' && st.nw.subject === 'Re: Hallo' && /Hi du/.test(st.nw.body), 'EM3: Antworten füllt Empfänger, Betreff, Zitat');
  await T.emAction({ type: 'emSend', form: { emfrom: '111', emto: 'Orvan, Jita Traders', emsubj: 'Re: Hallo', embody: 'Danke\n<o7>' } }); await tick(100);
  const post = CALLS.filter(c => /^POST .*characters\/111\/mail\//.test(c)).pop() || '';
  assert(/"recipient_id":145,"recipient_type":"mailing_list"/.test(post) && /"recipient_id":900,"recipient_type":"character"/.test(post) && /Danke<br>&lt;o7>/.test(post) && !T.emState().nw, 'EM3: gesendet an Charakter + Mailingliste (' + post.slice(0, 220) + ')');
  await T.emAction({ type: 'emDel', arg: '1' }); await tick(50);
  assert(CALLS.some(c => /^DELETE .*mail\/1\//.test(c)) && !T.emState().heads.some(m => m.id === 1), 'EM3: löschen');
  const ob = d.createElement('div'); T.ovRenderMail(ob);
  assert(ob.querySelector('.em-r') && ob.querySelector('[data-ova="emNew"]'), 'EM4: Overlay mit Liste und „Neue Mail“');
  assert(ob.querySelector('.em-r .em-c img[src*="/characters/111/portrait"]') && /Eins/.test(ob.querySelector('.em-r .em-c').textContent), 'EM4: Overlay zeigt, an welchen eigenen Charakter die Mail ging (mit Porträt)');
  assert(/mail: "Mail"/.test(html) && /mail: \["mail"\]/.test(html) && /SSO_MAIL_SCOPES = "esi-mail\.read_mail\.v1 esi-mail\.send_mail\.v1 esi-mail\.organize_mail\.v1"/.test(html), 'EM4: Overlay + OmniCom-Symbol + Berechtigungen angemeldet');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})();
