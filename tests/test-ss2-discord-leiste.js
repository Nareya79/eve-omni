// SS2 (15.10.2026): Discord-Leiste wie die Overlay-Fenster – Symbol + Titel mittig, ⟳ links, ⌗ 📌 ⚙ 🔓 ⤡ – ✕ rechts,
// Knöpfe schicken top/lock/ct an main.js, Zustand kommt über browser:state { dc } zurück (dcBarPush), EN-Titel
const fs = require('fs');
const { chromium } = require('playwright');
const main = fs.readFileSync('/home/claude/main.js', 'utf8'), bar = '/home/claude/discord.html';
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  ok(/else if \(type === 'top'\) dcSet\(\{ top: !satTop\('discord'\) \}\)/.test(main) && /type === 'lock'\) dcSet/.test(main) && /type === 'ct'\) dcSet/.test(main), 'main.js: Befehle top / lock / ct');
  ok(/function dcBarPush\(\)/.test(main) && /dcBarPush\(\);\n\}/.test(main) && /did-finish-load', dcBarPush/.test(main), 'main.js: Zustand an die Leiste (nach discordLook und beim Laden)');
  ok(/set = dcSet;/.test(main), 'Menü ⚙ nutzt dieselbe Speicherfunktion');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const lang of ['de', 'en']){
    const p = await b.newPage({ viewport: { width: 520, height: 26 } }), sent = [];
    await p.exposeFunction('__sent', (t, a) => sent.push(t));
    await p.addInitScript(() => { let cb = null; window.browserHost = { cmd: (t, a) => window.__sent(t, a), onState: f => { cb = f; } }; window.__push = s => cb && cb(s); });
    await p.goto('file://' + bar + '#' + lang);
    const ids = await p.evaluate(() => [...document.querySelectorAll('.row > button')].map(b => b.id));
    ok(ids.join() === 'reload,ct,top,menu,lock,grip,min,close', lang + ': Knöpfe in Overlay-Reihenfolge (' + ids.join() + ')');
    ok(await p.evaluate(() => !!document.querySelector('.t svg') && document.getElementById('tt').textContent === 'Discord'), lang + ': Symbol + Titel');
    const c = await p.evaluate(() => { const t = document.querySelector('.t').getBoundingClientRect(); return Math.abs(t.left + t.width / 2 - innerWidth / 2); });
    ok(c < 2, lang + ': Titel mittig');
    for (const id of ['top', 'lock', 'ct', 'menu']) await p.click('#' + id);
    ok(sent.join() === 'top,lock,ct,menu', lang + ': Klicks schicken top, lock, ct, menu (' + sent.join() + ')');
    await p.evaluate(() => window.__push({ dc: { ct: false, top: true, lock: true } }));
    const st = await p.evaluate(() => ({ top: document.getElementById('top').getAttribute('aria-pressed'), lock: document.getElementById('lock').getAttribute('aria-pressed'), li: document.getElementById('lock').textContent, grip: document.getElementById('grip').disabled, lt: document.getElementById('lock').title }));
    ok(st.top === 'true' && st.lock === 'true' && /🔒/.test(st.li) && st.grip, lang + ': Zustand angezeigt (📌 an, 🔒 gesperrt, Griff aus)');
    ok(lang === 'en' ? /^Locked/.test(st.lt) && (await p.getAttribute('#menu', 'title')).startsWith('Window options') : /^Gesperrt/.test(st.lt), lang + ': Tooltips in der Sprache');
    await p.evaluate(() => window.__push({ dc: { ct: false, top: true, lock: false } }));
    await p.screenshot({ path: '/tmp/ss2-discord-' + lang + '.png' });
    await p.close();
  }
  await b.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL SS2 TESTS PASSED');
})().catch(e => { console.log('FEHLER ' + e.message); process.exit(1); });
