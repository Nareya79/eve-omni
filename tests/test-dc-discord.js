// 14.10.2026: Discord-Chat-Fenster (main.js) – eigene Sitzung, keine Rechte, Links nach außen, Kürzel, OmniCom. Live geprüft per CDP-Testinstanz.
const fs = require('fs');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const m = fs.readFileSync('/home/claude/main.js', 'utf8'), p = fs.readFileSync('/home/claude/preload.js', 'utf8'), h = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
  assert(/partition: 'persist:discord'/.test(m) && /sandbox: true \} \}\);\n  const wc = v\.webContents/.test(m), 'eigene dauerhafte Sitzung, Seite ohne Zugriff aufs Programm');
  assert(/setPermissionRequestHandler\(\(x, perm, cb\) => cb\(perm === 'clipboard-sanitized-write' \|\| perm === 'fullscreen'\)\)/.test(m) && /setPermissionCheckHandler\(\(x, perm\) => perm === 'clipboard-sanitized-write'\)/.test(m), 'kein Mikrofon, keine Kamera, keine Meldungen');
  assert(m.includes("wc.setWindowOpenHandler(({ url }) => { linkOpen(url); return { action: 'deny' }; });") && m.includes('function linkOpen(url){') && m.includes('OWN_SITES.test(url)'), 'TT2: Links aus dem Chat → EVE-Omni-Browser, eigene Seiten → Standard-Browser');
  assert(/discordToggle: ''/.test(m) && /discordToggle: \(\) => toggleDiscord\(\)/.test(m) && /\{ id: "discordToggle", label: "Discord-Chat ein\/aus" \}/.test(h), 'Tastenkürzel: Standard leer, in Einstellungen setzbar');
  assert(/toggleDiscord: \(\) => ipcRenderer\.send\('evecore:toggleDiscord'\)/.test(p) && /ipcMain\.on\('evecore:toggleDiscord'/.test(m), 'Brücke Seite → Programm');
  assert(/w === dwin \? 'discord'/.test(m) && /if \(dwin && !dwin\.isDestroyed\(\) && dwin\.isVisible\(\)\) list\.push\(dwin\)/.test(m) && /discordLook\(\);   \/\/ DC/.test(m), 'Sperren, Einrasten, Durchklicken/Vordergrund wie andere Overlays');
  assert(/id="neo-btn-discord"/.test(h) && /"neo-btn-discord"/.test(h) && /target === "discord"/.test(h), 'OmniCom-Overlay-Symbol');
  assert(/browserHost\.cmd\(id\)/.test(fs.readFileSync('/home/claude/discord.html', 'utf8')), 'Leiste discord.html (Neu laden, Menü, Minimieren, Schließen)');
  // DC2 (14.10.): durchsichtig, Ausblenden statt Schließen, ganz beenden, Titel-Zähler, Griff, Klick auf die Meldung
  assert(m.includes("transparent: true, backgroundColor: '#00000000', thickFrame: false") && m.includes("v.setBackgroundColor('#00000000')"), 'DC2: Fenster durchsichtig angelegt');
  assert(m.includes('function dcBgApply') && m.includes('insertCSS(dcBgCss(b.a)') && m.includes("dcBgState === 'bad' && dcCssKey") && m.includes("'Hintergrund-Deckkraft'") && m.includes("'Hintergrund durchsichtig'"), 'DC2: Hintergrund-CSS mit Prüfung + Rückfall, Schalter + Deckkraft im Menü');
  assert(m.includes("if (type === 'close') dwin.hide()") && m.includes("w.on('close', e => { if (!quitting && !w.__kill){ e.preventDefault(); w.hide(); } })") && m.includes('dwin.hide(); else openDiscord()') && m.includes("'Discord ganz beenden'"), 'DC2: ✕/Kürzel blenden nur aus, „ganz beenden“ zerstört, Programmende schließt');
  assert(m.includes('function dcTitle(t)') && m.includes("page-title-updated', (e, t) => dcTitle(t)") && m.includes("did-navigate', () => { dcUnread = -1; }"), 'DC2: nur die Zahl aus dem Titel, Ausgangsstand je Seite');
  assert(m.includes("act === 'discord') n.on('click', () => openDiscord())") && p.includes('notify: (title, body, act)'), 'DC2: Klick auf die Windows-Meldung öffnet Discord');
  assert(/id="grip"/.test(fs.readFileSync('/home/claude/discord.html', 'utf8')) && m.includes("type === 'size' && !(S.windows.discord || {}).lock"), 'DC2: Griff ⤡ zum Größe ändern (gesperrt = aus)');
  console.log('\nALL DC-DISCORD TESTS PASSED'); process.exit(0);
}catch(e){ console.error(e.message); process.exit(1); }
